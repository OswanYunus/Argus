"""Unit and adversarial tests for the Entity Resolution Engine."""

from __future__ import annotations

import pytest

from argus.core.db import Database, IdentityRepository, InvestigationRepository
from argus.core.models import (
    Identity,
    IdentitySignal,
    IdentityType,
    Investigation,
    SignalType,
    VerificationStatus,
)
from argus.engines.entity_resolution import (
    EntityResolutionEngine,
    ExtractedSignal,
)


@pytest.fixture
async def test_db():
    db = Database(":memory:", wal_mode=False)
    await db.connect()
    try:
        yield db
    finally:
        await db.disconnect()


@pytest.mark.asyncio
async def test_single_signal_remains_unverified(test_db: Database):
    """
    CRITICAL RULE: A single signal (e.g. username match alone) must NEVER
    result in verified attribution and confidence must be <= 0.40.
    """
    engine = EntityResolutionEngine(test_db)
    inv_repo = InvestigationRepository(test_db)

    inv = Investigation.create(name="ER Test", target_name="Alex River")
    await inv_repo.create(inv)

    # Only one username signal from one source
    single_signal = [
        ExtractedSignal(
            signal_type=SignalType.USERNAME_MATCH,
            value="ariver",
            strength=0.7,
            source_url="https://github.com/ariver",
            raw_evidence="GitHub user ariver",
        )
    ]

    decision = await engine.resolve_target_identity(inv, single_signal)
    assert decision.status == VerificationStatus.UNVERIFIED
    assert decision.identity.confidence <= 0.40
    assert "UNVERIFIED" in decision.confidence_explanation
    assert "Single signal dimension insufficient" in decision.confidence_explanation


@pytest.mark.asyncio
async def test_multiple_independent_signals_promote_to_verified(test_db: Database):
    """
    Corroboration across 3 independent signal types and multiple sources
    promotes the identity to VERIFIED.
    """
    engine = EntityResolutionEngine(test_db)
    inv_repo = InvestigationRepository(test_db)

    inv = Investigation.create(name="ER Test 2", target_name="Alex River")
    await inv_repo.create(inv)

    signals = [
        ExtractedSignal(
            signal_type=SignalType.USERNAME_MATCH,
            value="ariver",
            strength=0.7,
            source_url="https://github.com/ariver",
            raw_evidence="GitHub user ariver",
        ),
        ExtractedSignal(
            signal_type=SignalType.EMAIL_MATCH,
            value="alex.river@sec.org",
            strength=0.95,
            source_url="https://personal.ariver.org/about",
            raw_evidence="Email: alex.river@sec.org",
        ),
        ExtractedSignal(
            signal_type=SignalType.CROSS_LINK,
            value="https://personal.ariver.org/about",
            strength=0.8,
            source_url="https://linkedin.com/in/ariver-sec",
            raw_evidence="Links to personal site",
        ),
    ]

    decision = await engine.resolve_target_identity(inv, signals)
    assert decision.status == VerificationStatus.VERIFIED
    assert decision.identity.confidence >= 0.85
    assert "VERIFIED" in decision.confidence_explanation


@pytest.mark.asyncio
async def test_adversarial_contradictory_signals_marked_ambiguous(test_db: Database):
    """
    Contradictory signals (e.g. conflicting location or credentials)
    prevent auto-attribution and flag the identity as AMBIGUOUS.
    """
    engine = EntityResolutionEngine(test_db)
    signals = [
        IdentitySignal.create(
            identity_id="id-1",
            signal_type=SignalType.USERNAME_MATCH,
            signal_value="ariver",
            signal_strength=0.7,
            source_url="https://github.com/ariver",
        ),
        IdentitySignal.create(
            identity_id="id-1",
            signal_type=SignalType.NAME_MATCH,
            signal_value="Alex River",
            signal_strength=0.8,
            source_url="https://another.com/profile",
        ),
    ]

    contradictions = ["Target is in London UK, observed subject profile is in Tokyo Japan"]
    conf, status, expl = engine.evaluate_identity_confidence(signals, contradictions)

    assert status == VerificationStatus.AMBIGUOUS
    assert conf <= 0.40
    assert "AMBIGUOUS" in expl
    assert "conflicting signals" in expl
