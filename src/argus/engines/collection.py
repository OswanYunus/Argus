"""Collection Engine for ARGUS OSINT Intelligence Platform.

Fetches permitted public documents, parses HTML (trafilatura), PDF (PyMuPDF),
encrypts content at rest, tracks content changes, and registers full-text indexing.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
import trafilatura

from argus.core.crypto import DocumentEncryptor, KeyManager
from argus.core.db import Database, DocumentRepository, UrlRepository
from argus.core.models import (
    CollectedDocument,
    DiscoveredUrl,
    UrlStatus,
    hash_content,
    utc_now,
)
from argus.integration.http_client import FetchResponse, HttpClient
from argus.orchestration.rate_limiter import RateLimiter

logger = logging.getLogger("argus.engine.collection")


@dataclass(frozen=True)
class ExtractedContent:
    """Parsed document text and extracted metadata."""

    text: str
    extraction_method: str
    title: Optional[str] = None
    author: Optional[str] = None
    date: Optional[str] = None
    links: list[str] = ()


class CollectionEngine:
    """Manages polite document fetching, multi-format text parsing, and encrypted storage."""

    def __init__(
        self,
        db: Database,
        storage_base_dir: Path | str,
        http_client: Optional[HttpClient] = None,
        rate_limiter: Optional[RateLimiter] = None,
        encryptor: Optional[DocumentEncryptor] = None,
    ) -> None:
        self.db = db
        self.storage_base_dir = Path(storage_base_dir)
        self.http_client = http_client or HttpClient()
        self.rate_limiter = rate_limiter or RateLimiter()
        self.encryptor = encryptor or DocumentEncryptor(KeyManager())
        self.doc_repo = DocumentRepository(db)
        self.url_repo = UrlRepository(db)

    def extract_text(self, content: bytes, content_type: str) -> ExtractedContent:
        """Dispatch document parsing based on MIME type or magic bytes."""
        ct_lower = content_type.lower()

        # PDF parsing
        if "application/pdf" in ct_lower or content.startswith(b"%PDF-"):
            try:
                doc = fitz.open(stream=content, filetype="pdf")
                pages = [page.get_text() for page in doc]
                full_text = "\n\n".join(pages).strip()
                title = doc.metadata.get("title") if doc.metadata else None
                author = doc.metadata.get("author") if doc.metadata else None
                return ExtractedContent(
                    text=full_text,
                    extraction_method="pymupdf",
                    title=title,
                    author=author,
                )
            except Exception as exc:
                logger.warning("PDF extraction failed, falling back to plain text: %s", exc)

        # HTML parsing via trafilatura
        if "html" in ct_lower or b"<html" in content[:1024].lower() or b"<!doctype" in content[:1024].lower():
            try:
                html_str = content.decode("utf-8", errors="replace")
                extracted = trafilatura.extract(
                    html_str,
                    include_links=True,
                    include_comments=False,
                    output_format="txt",
                )
                metadata = trafilatura.extract_metadata(html_str)
                text = extracted or ""
                return ExtractedContent(
                    text=text,
                    extraction_method="trafilatura",
                    title=metadata.title if metadata else None,
                    author=metadata.author if metadata else None,
                    date=metadata.date if metadata else None,
                )
            except Exception as exc:
                logger.warning("Trafilatura HTML extraction failed: %s", exc)

        # Plain text fallback
        try:
            plain = content.decode("utf-8")
        except UnicodeDecodeError:
            plain = content.decode("latin-1", errors="replace")

        return ExtractedContent(
            text=plain.strip(),
            extraction_method="plaintext",
        )

    async def collect_url(
        self,
        url_record: DiscoveredUrl,
    ) -> Optional[CollectedDocument]:
        """Fetch, parse, encrypt, and persist a single discovered URL."""
        # Enforce rate limit for this domain
        await self.rate_limiter.acquire(url_record.url)

        # Fetch with robots.txt check
        resp: FetchResponse = await self.http_client.fetch(url_record.url)

        if not resp.robots_allowed:
            await self.url_repo.update_status(
                url_record.id,
                UrlStatus.ROBOTS_BLOCKED,
                rejection_reason="Blocked by robots.txt",
            )
            return None

        if not resp.is_success:
            await self.url_repo.update_status(
                url_record.id,
                UrlStatus.ERROR,
                rejection_reason=f"HTTP status {resp.status_code}: {resp.error_message or ''}".strip(),
            )
            return None

        content = resp.content
        content_hash = hash_content(content)

        # Check investigation memory: has this URL been collected before?
        previous_doc = await self.doc_repo.get_latest_for_url(url_record.id)
        changed_since_last: Optional[bool] = None
        previous_version_id: Optional[str] = None

        if previous_doc is not None:
            previous_version_id = previous_doc.id
            changed_since_last = previous_doc.content_hash != content_hash

        # Extract text
        extracted = self.extract_text(content, resp.content_type)
        extracted_text_hash = hash_content(extracted.text.encode()) if extracted.text else None

        # Build CollectedDocument model
        doc_model = CollectedDocument.create(
            investigation_id=url_record.investigation_id,
            url_id=url_record.id,
            content_hash=content_hash,
            content_type=resp.content_type,
            content_length=len(content),
            extracted_text_hash=extracted_text_hash,
            extraction_method=extracted.extraction_method,
            http_status=resp.status_code,
            http_headers=resp.headers,
            robots_compliant=True,
            previous_version_id=previous_version_id,
            changed_since_last=changed_since_last,
        )

        # Encrypt and store raw document on disk
        encrypted_path = self.encryptor.encrypt_document(
            content=content,
            investigation_id=url_record.investigation_id,
            document_id=doc_model.id,
            base_dir=self.storage_base_dir,
        )

        # Set encrypted_path in model
        doc_model = CollectedDocument(
            id=doc_model.id,
            investigation_id=doc_model.investigation_id,
            url_id=doc_model.url_id,
            content_hash=doc_model.content_hash,
            content_type=doc_model.content_type,
            content_length=doc_model.content_length,
            encrypted_path=str(encrypted_path),
            extracted_text_hash=doc_model.extracted_text_hash,
            extraction_method=doc_model.extraction_method,
            http_status=doc_model.http_status,
            http_headers=doc_model.http_headers,
            robots_compliant=doc_model.robots_compliant,
            collected_at=doc_model.collected_at,
            previous_version_id=doc_model.previous_version_id,
            changed_since_last=doc_model.changed_since_last,
            created_at=doc_model.created_at,
        )

        # Persist document and index text in SQLite
        await self.doc_repo.create(doc_model, extracted_text=extracted.text)

        # Update URL status to COLLECTED
        await self.url_repo.update_status(url_record.id, UrlStatus.COLLECTED)

        return doc_model
