"""Intelligent Filtering and Deduplication Engine for ARGUS OSINT Intelligence Platform.

Performs deterministic multi-stage filtering: content deduplication, target signal matching,
relevance thresholding, and rejection tracking before expensive intelligence analysis.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Optional

from argus.core.db import Database, DocumentRepository, UrlRepository
from argus.core.models import (
    CollectedDocument,
    DiscoveredUrl,
    Investigation,
    UrlStatus,
)

logger = logging.getLogger("argus.engine.filtering")


@dataclass(frozen=True)
class FilterResult:
    """Outcome of filtering a document against investigation targets."""

    passed: bool
    relevance_score: float
    matched_signals: list[str]
    rejection_reason: Optional[str] = None


class FilteringEngine:
    """Pre-analysis filter to eliminate noise, duplicates, and irrelevant content."""

    def __init__(
        self,
        db: Database,
        min_relevance_threshold: float = 0.3,
    ) -> None:
        self.db = db
        self.min_relevance_threshold = min_relevance_threshold
        self.doc_repo = DocumentRepository(db)
        self.url_repo = UrlRepository(db)

    def compute_signal_relevance(
        self,
        text: str,
        investigation: Investigation,
    ) -> tuple[float, list[str]]:
        """
        Evaluate deterministic target signals against extracted text.
        Returns a relevance score (0.0 - 1.0) and list of matched signals.
        """
        if not text:
            return 0.0, []

        text_lower = text.lower()
        matched: list[str] = []
        score = 0.0

        # 1. Target Name (Strong indicator)
        target_name = (investigation.target_name or "").strip().lower()
        if target_name and target_name in text_lower:
            matched.append(f"name:{investigation.target_name}")
            score += 0.5

        signals = investigation.target_signals or {}

        # 2. Known Emails (Very strong indicator)
        emails = signals.get("emails", [])
        if isinstance(emails, str):
            emails = [emails]
        for email in emails:
            e_clean = email.strip().lower()
            if e_clean and e_clean in text_lower:
                matched.append(f"email:{email}")
                score += 0.4

        # 3. Known Usernames
        usernames = signals.get("usernames", [])
        if isinstance(usernames, str):
            usernames = [usernames]
        for uname in usernames:
            u_clean = uname.strip().lower()
            # Look for boundary matching for usernames to avoid false substring matches
            if u_clean and re.search(r"\b" + re.escape(u_clean) + r"\b", text_lower):
                matched.append(f"username:{uname}")
                score += 0.3

        # 4. Known Domains
        domains = signals.get("domains", [])
        if isinstance(domains, str):
            domains = [domains]
        for dom in domains:
            d_clean = dom.strip().lower()
            if d_clean and d_clean in text_lower:
                matched.append(f"domain:{dom}")
                score += 0.2

        # Cap score at 1.0
        final_score = min(1.0, score)
        return final_score, matched

    async def filter_document(
        self,
        document: CollectedDocument,
        investigation: Investigation,
        extracted_text: str,
    ) -> FilterResult:
        """Evaluate document for duplication and target relevance."""
        # Check 1: Content Deduplication
        existing = await self.doc_repo.get_by_content_hash(
            investigation.id, document.content_hash
        )
        if existing and existing.id != document.id:
            reason = f"Duplicate content identical to document {existing.id}"
            await self.url_repo.update_status(
                document.url_id, UrlStatus.REJECTED, rejection_reason=reason
            )
            return FilterResult(
                passed=False,
                relevance_score=0.0,
                matched_signals=[],
                rejection_reason=reason,
            )

        # Check 2: Target Signal Matching & Relevance Scoring
        score, matches = self.compute_signal_relevance(extracted_text, investigation)

        if score < self.min_relevance_threshold:
            reason = f"Low relevance score ({score:.2f} < {self.min_relevance_threshold}): no sufficient target signals found"
            await self.url_repo.update_status(
                document.url_id, UrlStatus.REJECTED, rejection_reason=reason
            )
            return FilterResult(
                passed=False,
                relevance_score=score,
                matched_signals=matches,
                rejection_reason=reason,
            )

        # Passed all checks -> Accept for intelligence analysis
        await self.url_repo.update_status(document.url_id, UrlStatus.FILTERED)
        return FilterResult(
            passed=True,
            relevance_score=score,
            matched_signals=matches,
        )
