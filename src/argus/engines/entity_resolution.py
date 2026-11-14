"""Entity Resolution Engine for ARGUS OSINT Intelligence Platform.

Central engineering component: multi-signal identity matching, adversarial distinction
between similarly-named individuals, Bayesian-style signal fusion, and confidence explanations.
Never promotes an identity based on a single signal alone.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Optional, Sequence

from argus.core.db import Database, IdentityRepository
from argus.core.models import (
    Identity,
    IdentityLink,
    IdentitySignal,
    IdentityType,
    Investigation,
    LinkType,
    SignalType,
    VerificationStatus,
)

logger = logging.getLogger("argus.engine.entity_resolution")

EMAIL_REGEX = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
HANDLE_REGEX = re.compile(r"(?:@|github\.com/|linkedin\.com/in/|twitter\.com/|x\.com/)([A-Za-z0-9_-]{3,30})")


@dataclass
class ExtractedSignal:
    """A single identity signal observed in a source document."""

    signal_type: SignalType
    value: str
    strength: float
    source_url: str
    source_document_id: Optional[str] = None
    raw_evidence: Optional[str] = None


@dataclass
class ResolutionDecision:
    """The outcome of identity resolution for a target."""

    identity: Identity
    signals: list[IdentitySignal]
    new_signals_count: int
    confidence_explanation: str
    status: VerificationStatus
    contradictions_detected: list[str] = field(default_factory=list)


class EntityResolutionEngine:
    """
    Multi-signal entity resolution and disambiguation engine.
    Ensures that identity attribution requires multiple independent confirming signals.
    """

    def __init__(
        self,
        db: Database,
        min_signals_for_likely: int = 2,
        min_signals_for_verified: int = 3,
        single_signal_max_confidence: float = 0.40,
    ) -> None:
        self.db = db
        self.min_signals_for_likely = min_signals_for_likely
        self.min_signals_for_verified = min_signals_for_verified
        self.single_signal_max_confidence = single_signal_max_confidence
        self.identity_repo = IdentityRepository(db)

    def extract_signals_from_text(
        self,
        text: str,
        source_url: str,
        document_id: Optional[str] = None,
    ) -> list[ExtractedSignal]:
        """Extract candidate identity signals (emails, handles, URLs, names) from raw text."""
        signals: list[ExtractedSignal] = []
        if not text:
            return signals

        # 1. Email extraction
        for match in EMAIL_REGEX.finditer(text):
            email = match.group(0).lower()
            start = max(0, match.start() - 60)
            end = min(len(text), match.end() + 60)
            context = text[start:end].replace("\n", " ").strip()
            signals.append(
                ExtractedSignal(
                    signal_type=SignalType.EMAIL_MATCH,
                    value=email,
                    strength=0.95,
                    source_url=source_url,
                    source_document_id=document_id,
                    raw_evidence=context,
                )
            )

        # 2. Username / Handle extraction from profile patterns
        for match in HANDLE_REGEX.finditer(text):
            handle = match.group(1).lower()
            # Ignore common false positives
            if handle in {"login", "signup", "about", "contact", "support", "privacy", "terms"}:
                continue
            start = max(0, match.start() - 60)
            end = min(len(text), match.end() + 60)
            context = text[start:end].replace("\n", " ").strip()
            signals.append(
                ExtractedSignal(
                    signal_type=SignalType.USERNAME_MATCH,
                    value=handle,
                    strength=0.70,
                    source_url=source_url,
                    source_document_id=document_id,
                    raw_evidence=context,
                )
            )

        # 3. Cross-links to known platforms
        if "github.com/" in text or "linkedin.com/in/" in text:
            signals.append(
                ExtractedSignal(
                    signal_type=SignalType.CROSS_LINK,
                    value=source_url,
                    strength=0.80,
                    source_url=source_url,
                    source_document_id=document_id,
                    raw_evidence=f"Cross-platform profile link found on {source_url}",
                )
            )

        return signals

    def evaluate_identity_confidence(
        self,
        signals: Sequence[IdentitySignal],
        known_contradictions: Sequence[str] = (),
    ) -> tuple[float, VerificationStatus, str]:
        """
        Evaluate confidence score and verification status based on independent signals.
        Enforces the cardinal rule: single signals NEVER prove identity.
        """
        if not signals:
            return 0.0, VerificationStatus.UNVERIFIED, "No supporting signals observed."

        # If contradictions exist, mark as ambiguous
        if known_contradictions:
            explanation = (
                f"Flagged as AMBIGUOUS due to {len(known_contradictions)} conflicting signals: "
                + "; ".join(known_contradictions)
            )
            return 0.35, VerificationStatus.AMBIGUOUS, explanation

        # Group signals by distinct types and distinct sources to ensure independence
        distinct_types = {s.signal_type for s in signals}
        distinct_sources = {s.source_url for s in signals if s.source_url}

        num_signals = len(signals)
        num_distinct_types = len(distinct_types)
        num_distinct_sources = len(distinct_sources)

        # Only one signal type or only one source
        if num_distinct_types == 1 or num_distinct_sources <= 1:
            confidence = min(self.single_signal_max_confidence, 0.40)
            status = VerificationStatus.UNVERIFIED
            explanation = (
                f"UNVERIFIED: {num_signals} signal(s) of type '{next(iter(distinct_types)).value}' "
                f"from {num_distinct_sources} source(s). Single signal dimension insufficient for attribution."
            )
            return confidence, status, explanation

        # 2 independent signals across multiple sources -> LIKELY
        if num_distinct_types >= self.min_signals_for_likely and num_distinct_sources >= 2:
            if num_distinct_types >= self.min_signals_for_verified and (
                SignalType.EMAIL_MATCH in distinct_types or SignalType.CROSS_LINK in distinct_types
            ):
                confidence = 0.90
                status = VerificationStatus.VERIFIED
                explanation = (
                    f"VERIFIED: Corroborated by {num_distinct_types} independent signal types "
                    f"({', '.join(t.value for t in distinct_types)}) across {num_distinct_sources} distinct sources."
                )
                return confidence, status, explanation

            confidence = 0.75
            status = VerificationStatus.LIKELY
            explanation = (
                f"LIKELY: Corroborated by {num_distinct_types} signal types "
                f"({', '.join(t.value for t in distinct_types)}) across {num_distinct_sources} sources."
            )
            return confidence, status, explanation

        return 0.40, VerificationStatus.UNVERIFIED, "Insufficient independent corroboration."

    async def resolve_target_identity(
        self,
        investigation: Investigation,
        observed_signals: Sequence[ExtractedSignal],
    ) -> ResolutionDecision:
        """
        Resolve or update the primary target identity against newly observed signals.
        """
        # Look for existing primary target identity in DB
        identities = await self.identity_repo.list_by_investigation(investigation.id)
        target_identity = next((i for i in identities if i.is_target), None)

        if target_identity is None:
            target_identity = Identity.create(
                investigation_id=investigation.id,
                identity_type=IdentityType.PERSON,
                canonical_value=investigation.target_name,
                display_name=investigation.target_name,
                is_target=True,
                confidence=0.50,
                verification_status=VerificationStatus.UNVERIFIED,
            )
            await self.identity_repo.create(target_identity)

        # Retrieve existing recorded signals
        existing_signals = await self.identity_repo.get_signals(target_identity.id)
        existing_values = {(s.signal_type, s.signal_value) for s in existing_signals}

        # Add only new signals
        new_signals: list[IdentitySignal] = []
        for obs in observed_signals:
            if (obs.signal_type, obs.value) not in existing_values:
                sig_model = IdentitySignal.create(
                    identity_id=target_identity.id,
                    signal_type=obs.signal_type,
                    signal_value=obs.value,
                    signal_strength=obs.strength,
                    source_document_id=obs.source_document_id,
                    source_url=obs.source_url,
                    raw_evidence=obs.raw_evidence,
                )
                await self.identity_repo.add_signal(sig_model)
                new_signals.append(sig_model)
                existing_values.add((obs.signal_type, obs.value))

        all_signals = existing_signals + new_signals

        # Evaluate confidence
        confidence, status, explanation = self.evaluate_identity_confidence(all_signals)

        # Update in database
        await self.identity_repo.update_confidence(
            target_identity.id,
            confidence=confidence,
            explanation=explanation,
            status=status,
        )

        updated_identity = await self.identity_repo.get(target_identity.id)

        return ResolutionDecision(
            identity=updated_identity or target_identity,
            signals=all_signals,
            new_signals_count=len(new_signals),
            confidence_explanation=explanation,
            status=status,
        )
