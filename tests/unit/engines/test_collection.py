"""Unit tests for the Collection Engine."""

from __future__ import annotations

from pathlib import Path
import pytest
from pytest_httpx import HTTPXMock

from argus.core.crypto import DocumentEncryptor, KeyManager
from argus.core.db import Database, DocumentRepository, InvestigationRepository, UrlRepository
from argus.core.models import (
    DiscoveredUrl,
    Investigation,
    SourceType,
    UrlStatus,
)
from argus.engines.collection import CollectionEngine
from argus.integration.http_client import HttpClient


@pytest.fixture
async def test_env(tmp_path: Path):
    db = Database(":memory:", wal_mode=False)
    await db.connect()
    key_manager = KeyManager(KeyManager.generate_key())
    encryptor = DocumentEncryptor(key_manager)
    yield db, tmp_path, encryptor
    await db.disconnect()


@pytest.mark.asyncio
async def test_html_collection_and_encryption(test_env, httpx_mock: HTTPXMock):
    """Test HTML parsing with trafilatura, encryption at rest, and DB indexing."""
    db, storage_dir, encryptor = test_env
    inv_repo = InvestigationRepository(db)
    url_repo = UrlRepository(db)
    doc_repo = DocumentRepository(db)

    inv = Investigation.create(name="Collection Test", target_name="Target")
    await inv_repo.create(inv)

    url_str = "https://example.com/target-profile"
    url_record = DiscoveredUrl.create(
        investigation_id=inv.id,
        url=url_str,
        source_type=SourceType.SEARCH_RESULT,
    )
    await url_repo.create(url_record)

    httpx_mock.add_response(
        url="https://example.com/robots.txt",
        text="User-agent: *\nAllow: /",
        status_code=200,
    )
    httpx_mock.add_response(
        url=url_str,
        text="""
        <!DOCTYPE html>
        <html>
        <head><title>Profile of Alice</title></head>
        <body>
            <article>
                <h1>Alice Smith</h1>
                <p>Senior Cybersecurity Researcher specializing in intelligence analysis.</p>
            </article>
        </body>
        </html>
        """,
        headers={"content-type": "text/html; charset=utf-8"},
        status_code=200,
    )

    http_client = HttpClient()
    engine = CollectionEngine(
        db=db,
        storage_base_dir=storage_dir,
        http_client=http_client,
        encryptor=encryptor,
    )

    try:
        doc = await engine.collect_url(url_record)
        assert doc is not None
        assert doc.extraction_method == "trafilatura"
        assert doc.robots_compliant is True
        assert doc.encrypted_path is not None

        # Verify file exists on disk and is encrypted (cannot find raw plaintext)
        enc_file = Path(doc.encrypted_path)
        assert enc_file.exists()
        raw_bytes = enc_file.read_bytes()
        assert b"Cybersecurity Researcher" not in raw_bytes

        # Decrypt through DocumentEncryptor
        decrypted = encryptor.decrypt_document(enc_file, inv.id)
        assert b"Cybersecurity Researcher" in decrypted

        # Verify FTS search index contains text
        fts_hits = await doc_repo.search_text(inv.id, "Cybersecurity")
        assert len(fts_hits) == 1
        assert fts_hits[0]["id"] == doc.id
    finally:
        await http_client.close()


@pytest.mark.asyncio
async def test_robots_blocked_collection(test_env, httpx_mock: HTTPXMock):
    """Test that blocked URLs are not fetched and status is updated to ROBOTS_BLOCKED."""
    db, storage_dir, encryptor = test_env
    inv_repo = InvestigationRepository(db)
    url_repo = UrlRepository(db)

    inv = Investigation.create(name="Robots Test", target_name="Target")
    await inv_repo.create(inv)

    url_str = "https://restricted.example/private"
    url_record = DiscoveredUrl.create(
        investigation_id=inv.id,
        url=url_str,
        source_type=SourceType.SEARCH_RESULT,
    )
    await url_repo.create(url_record)

    httpx_mock.add_response(
        url="https://restricted.example/robots.txt",
        text="User-agent: *\nDisallow: /private",
        status_code=200,
    )

    http_client = HttpClient(respect_robots=True)
    engine = CollectionEngine(
        db=db,
        storage_base_dir=storage_dir,
        http_client=http_client,
        encryptor=encryptor,
    )

    try:
        doc = await engine.collect_url(url_record)
        assert doc is None
        updated_url = await url_repo.get(url_record.id)
        assert updated_url.status == UrlStatus.ROBOTS_BLOCKED
    finally:
        await http_client.close()
