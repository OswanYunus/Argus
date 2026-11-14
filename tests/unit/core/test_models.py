"""Unit tests for ARGUS core domain models and DTOs."""

from __future__ import annotations

import json
from datetime import datetime, timezone
import pytest
from pydantic import ValidationError

from argus.core.models import (
    CollectedDocument,
    CreateInvestigationRequest,
    Direction,
    DiscoveredUrl,
    Finding,
    FindingResponse,
    FindingSource,
    FindingType,
    Identity,
    IdentityLink,
    IdentityResponse,
    IdentitySignal,
    IdentityType,
    Investigation,
    InvestigationResponse,
    InvestigationRun,
    InvestigationStatus,
    InvestigationSummary,
    LinkType,
    PipelineProgress,
    PipelineTask,
    PipelineTaskStatus,
    PipelineTaskType,
    QueryType,
    Relationship,
    ResourceType,
    ResourceUsage,
    RunStatus,
    SearchQuery,
    SignalType,
    SourceCheckLog,
    SourceType,
    TaskStatus,
    TemporalPrecision,
    UrlStatus,
    VerificationStatus,
    generate_id,
    hash_content,
    hash_url,
    utc_now,
)


def test_investigation_create():
    """Factory method produces valid model with proper defaults."""
    inv = Investigation.create(
        name="Target Footprint",
        target_name="Jane Doe",
        description="Authorized audit",
        target_signals={"emails": ["jane@example.com"], "usernames": ["jdoe"]},
        config={"max_depth": 2},
        encryption_key_id="key-123",
    )
    assert inv.id is not None
    assert inv.name == "Target Footprint"
    assert inv.target_name == "Jane Doe"
    assert inv.status == InvestigationStatus.CREATED
    assert inv.target_signals["emails"] == ["jane@example.com"]
    assert isinstance(inv.created_at, datetime)
    assert isinstance(inv.updated_at, datetime)
    assert inv.deleted_at is None


def test_investigation_status_enum():
    """All enum values accepted, invalid rejected."""
    valid_statuses = [
        "created", "running", "paused", "completed", "archived", "purged"
    ]
    for s in valid_statuses:
        inv = Investigation.create(
            name="Test",
            target_name="Test",
            encryption_key_id="k",
            status=InvestigationStatus(s),
        )
        assert inv.status == s

    with pytest.raises(ValueError):
        InvestigationStatus("unknown_status")


def test_confidence_bounds():
    """0.0 and 1.0 accepted, < 0.0 and > 1.0 rejected."""
    # Valid bounds
    id_low = Identity.create(
        investigation_id="inv-1",
        identity_type=IdentityType.USERNAME,
        canonical_value="alice",
        confidence=0.0,
    )
    assert id_low.confidence == 0.0

    id_high = Identity.create(
        investigation_id="inv-1",
        identity_type=IdentityType.USERNAME,
        canonical_value="alice",
        confidence=1.0,
    )
    assert id_high.confidence == 1.0

    # Invalid bounds
    with pytest.raises(ValidationError):
        Identity.create(
            investigation_id="inv-1",
            identity_type=IdentityType.USERNAME,
            canonical_value="alice",
            confidence=-0.1,
        )

    with pytest.raises(ValidationError):
        Identity.create(
            investigation_id="inv-1",
            identity_type=IdentityType.USERNAME,
            canonical_value="alice",
            confidence=1.01,
        )


def test_identity_link_ordering():
    """identity_a_id < identity_b_id is enforced and auto-sorted."""
    link = IdentityLink.create(
        investigation_id="inv-1",
        identity_a_id="uuid-z",
        identity_b_id="uuid-a",
        link_type=LinkType.SAME_PERSON,
        confidence=0.85,
    )
    assert link.identity_a_id == "uuid-a"
    assert link.identity_b_id == "uuid-z"

    # Same IDs should be rejected
    with pytest.raises(ValidationError):
        IdentityLink.create(
            investigation_id="inv-1",
            identity_a_id="uuid-same",
            identity_b_id="uuid-same",
            link_type=LinkType.SAME_PERSON,
            confidence=0.85,
        )


def test_url_hash_generation():
    """hash_url normalizes URLs and hashes consistently."""
    h1 = hash_url("https://Example.COM/Path/Index.html/")
    h2 = hash_url("https://example.com/Path/Index.html")
    assert h1 == h2
    assert len(h1) == 64  # SHA-256 hex


def test_content_hash():
    """hash_content produces consistent SHA-256."""
    b = b"OSINT Evidence Content"
    h = hash_content(b)
    assert len(h) == 64
    assert h == hash_content(b)
    assert h != hash_content(b"Different content")


def test_frozen_models():
    """Models cannot be mutated after creation."""
    inv = Investigation.create(
        name="Target",
        target_name="Target",
        encryption_key_id="k",
    )
    with pytest.raises(ValidationError):
        inv.name = "Modified"  # type: ignore


def test_api_dto_serialization():
    """CreateInvestigationRequest round-trips through JSON."""
    req = CreateInvestigationRequest(
        name="Self Investigation",
        description="Testing authorized scan",
        target_name="John Public",
        target_signals={"emails": ["john@example.org"]},
        config={"max_depth": 1},
    )
    serialized = req.model_dump_json()
    deserialized = CreateInvestigationRequest.model_validate_json(serialized)
    assert deserialized.name == req.name
    assert deserialized.target_signals == req.target_signals


def test_finding_with_sources():
    """FindingResponse embeds sources properly."""
    src = FindingSource.create(
        finding_id="find-1",
        document_id="doc-1",
        url="https://example.com/profile",
        excerpt="John Public is a security researcher.",
    )
    finding_resp = FindingResponse(
        id="find-1",
        investigation_id="inv-1",
        identity_id="id-1",
        finding_type=FindingType.FACT,
        category="professional",
        summary="Security researcher",
        detail="Listed on company page",
        confidence=0.9,
        confidence_explanation="Direct quote from verified domain",
        temporal_date=None,
        temporal_precision=None,
        is_new=True,
        supersedes_id=None,
        created_at=utc_now(),
        updated_at=utc_now(),
        sources=[src],
    )
    assert len(finding_resp.sources) == 1
    assert finding_resp.sources[0].url == "https://example.com/profile"


def test_all_enums_match_schema():
    """Enum values match the DB CHECK constraints."""
    assert InvestigationStatus.CREATED == "created"
    assert QueryType.EXACT_NAME == "exact_name"
    assert TaskStatus.PENDING == "pending"
    assert UrlStatus.ROBOTS_BLOCKED == "robots_blocked"
    assert SourceType.SEARCH_RESULT == "search_result"
    assert IdentityType.PERSON == "person"
    assert VerificationStatus.VERIFIED == "verified"
    assert SignalType.USERNAME_MATCH == "username_match"
    assert LinkType.SAME_PERSON == "same_person"
    assert Direction.DIRECTED == "directed"
    assert FindingType.FACT == "fact"
    assert TemporalPrecision.EXACT == "exact"
    assert PipelineTaskType.SEARCH == "search"
    assert PipelineTaskStatus.COMPLETED == "completed"
    assert ResourceType.HTTP_REQUEST == "http_request"
    assert RunStatus.RUNNING == "running"


def test_pipeline_progress():
    """PipelineProgress computed accurately."""
    prog = PipelineProgress(
        investigation_id="inv-1",
        run_number=1,
        total_tasks=10,
        completed_tasks=7,
        failed_tasks=1,
        task_breakdown={"search": {"completed": 2, "pending": 0}},
    )
    assert prog.total_tasks == 10
    assert prog.completed_tasks == 7
    assert prog.task_breakdown["search"]["completed"] == 2


def test_optional_fields():
    """Optional fields accept None and defaults work."""
    doc = CollectedDocument.create(
        investigation_id="inv-1",
        url_id="url-1",
        content_hash="abc",
        robots_compliant=True,
    )
    assert doc.content_type is None
    assert doc.encrypted_path is None
    assert doc.previous_version_id is None
    assert doc.changed_since_last is None
    assert doc.robots_compliant is True
