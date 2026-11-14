"""ARGUS OSINT Platform — Pydantic v2 domain models and API DTOs.

This module is the single source of truth for data validation across the
platform.  Every model mirrors the database schema exactly and is frozen
(immutable) after construction.
"""

from __future__ import annotations

import enum
import hashlib
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ============================================================
# Utility functions
# ============================================================

def generate_id() -> str:
    """Return a new random UUID as a string."""
    return str(uuid4())


def utc_now() -> datetime:
    """Return the current UTC datetime (timezone-aware)."""
    return datetime.now(timezone.utc)


def hash_url(url: str) -> str:
    """Normalize *url* and return its SHA-256 hex digest."""
    parsed = urlparse(url)
    # Normalize: lowercase scheme + host, strip trailing slash from path
    normalized = (
        f"{(parsed.scheme or 'https').lower()}://"
        f"{(parsed.netloc or '').lower()}"
        f"{parsed.path.rstrip('/') or '/'}"
    )
    if parsed.query:
        normalized += f"?{parsed.query}"
    if parsed.fragment:
        normalized += f"#{parsed.fragment}"
    return hashlib.sha256(normalized.encode()).hexdigest()


def hash_content(content: bytes) -> str:
    """Return the SHA-256 hex digest of *content*."""
    return hashlib.sha256(content).hexdigest()


# ============================================================
# ENUMS — must match database CHECK constraints exactly
# ============================================================

class InvestigationStatus(str, enum.Enum):
    CREATED = "created"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"
    PURGED = "purged"


class QueryType(str, enum.Enum):
    EXACT_NAME = "exact_name"
    USERNAME = "username"
    EMAIL = "email"
    DOMAIN = "domain"
    URL = "url"
    FREETEXT = "freetext"
    PROFILE_URL = "profile_url"


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class UrlStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    COLLECTED = "collected"
    FILTERED = "filtered"
    REJECTED = "rejected"
    ERROR = "error"
    ROBOTS_BLOCKED = "robots_blocked"


class SourceType(str, enum.Enum):
    SEARCH_RESULT = "search_result"
    EXTRACTED_LINK = "extracted_link"
    MANUAL = "manual"
    RESCAN = "rescan"
    DIRECT_SEED = "direct_seed"


class IdentityType(str, enum.Enum):
    PERSON = "person"
    USERNAME = "username"
    EMAIL = "email"
    DOMAIN = "domain"
    ORGANIZATION = "organization"
    PHONE = "phone"
    OTHER = "other"


class VerificationStatus(str, enum.Enum):
    UNVERIFIED = "unverified"
    LIKELY = "likely"
    VERIFIED = "verified"
    REJECTED = "rejected"
    AMBIGUOUS = "ambiguous"


class SignalType(str, enum.Enum):
    USERNAME_MATCH = "username_match"
    EMAIL_MATCH = "email_match"
    NAME_MATCH = "name_match"
    BIO_REFERENCE = "bio_reference"
    CROSS_LINK = "cross_link"
    DOMAIN_WHOIS = "domain_whois"
    WRITING_STYLE = "writing_style"
    AVATAR_MATCH = "avatar_match"
    TEMPORAL_CORRELATION = "temporal_correlation"
    PROFILE_DATA = "profile_data"
    LLM_ANALYSIS = "llm_analysis"


class LinkType(str, enum.Enum):
    SAME_PERSON = "same_person"
    ALIAS = "alias"
    ASSOCIATED = "associated"
    MENTIONED_TOGETHER = "mentioned_together"
    CONTRADICTS = "contradicts"


class Direction(str, enum.Enum):
    DIRECTED = "directed"
    UNDIRECTED = "undirected"


class FindingType(str, enum.Enum):
    FACT = "fact"
    INFERENCE = "inference"
    CONTRADICTION = "contradiction"
    UNCERTAINTY = "uncertainty"
    TIMELINE_EVENT = "timeline_event"


class TemporalPrecision(str, enum.Enum):
    EXACT = "exact"
    MONTH = "month"
    YEAR = "year"
    DECADE = "decade"
    APPROXIMATE = "approximate"


class PipelineTaskType(str, enum.Enum):
    SEARCH = "search"
    COLLECT = "collect"
    EXTRACT = "extract"
    FILTER = "filter"
    RESOLVE = "resolve"
    ANALYZE = "analyze"
    DISCOVER_RELATIONSHIPS = "discover_relationships"


class PipelineTaskStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    BUDGET_EXCEEDED = "budget_exceeded"


class ResourceType(str, enum.Enum):
    HTTP_REQUEST = "http_request"
    LLM_TOKEN_INPUT = "llm_token_input"
    LLM_TOKEN_OUTPUT = "llm_token_output"
    LLM_CALL = "llm_call"
    DOCUMENT_BYTES = "document_bytes"
    SEARCH_QUERY = "search_query"
    CPU_SECONDS = "cpu_seconds"


class RunStatus(str, enum.Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# ============================================================
# Confidence validator mixin
# ============================================================

def _validate_confidence(value: float) -> float:
    if not 0.0 <= value <= 1.0:
        raise ValueError("confidence must be between 0.0 and 1.0")
    return value


# ============================================================
# Domain Models
# ============================================================

class Investigation(BaseModel):
    """Top-level investigation."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=generate_id)
    name: str
    description: str = ""
    target_name: str
    target_signals: dict[str, object] = Field(default_factory=dict)
    config: dict[str, object] = Field(default_factory=dict)
    encryption_key_id: str = ""
    status: InvestigationStatus = InvestigationStatus.CREATED
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    deleted_at: Optional[datetime] = None

    @classmethod
    def create(
        cls,
        *,
        name: str,
        target_name: str,
        description: str = "",
        target_signals: Optional[dict[str, object]] = None,
        config: Optional[dict[str, object]] = None,
        encryption_key_id: str = "",
        status: InvestigationStatus = InvestigationStatus.CREATED,
    ) -> "Investigation":
        now = utc_now()
        return cls(
            id=generate_id(),
            name=name,
            description=description,
            target_name=target_name,
            target_signals=target_signals or {},
            config=config or {},
            encryption_key_id=encryption_key_id,
            status=status,
            created_at=now,
            updated_at=now,
        )


class SearchQuery(BaseModel):
    """A search query executed within an investigation."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=generate_id)
    investigation_id: str
    query_text: str
    query_type: QueryType
    provider: str
    depth_level: int = 0
    parent_source_id: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
    result_count: Optional[int] = None
    executed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utc_now)

    @classmethod
    def create(
        cls,
        *,
        investigation_id: str,
        query_text: str,
        query_type: QueryType,
        provider: str,
        depth_level: int = 0,
        parent_source_id: Optional[str] = None,
    ) -> "SearchQuery":
        return cls(
            id=generate_id(),
            investigation_id=investigation_id,
            query_text=query_text,
            query_type=query_type,
            provider=provider,
            depth_level=depth_level,
            parent_source_id=parent_source_id,
            status=TaskStatus.PENDING,
            created_at=utc_now(),
        )


class DiscoveredUrl(BaseModel):
    """A URL discovered during search or link extraction."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=generate_id)
    investigation_id: str
    url: str
    url_hash: str = ""
    source_query_id: Optional[str] = None
    source_type: SourceType
    title: Optional[str] = None
    snippet: Optional[str] = None
    relevance_score: Optional[float] = None
    status: UrlStatus = UrlStatus.PENDING
    rejection_reason: Optional[str] = None
    first_seen_at: datetime = Field(default_factory=utc_now)
    last_checked_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utc_now)

    @field_validator("relevance_score")
    @classmethod
    def _check_relevance(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            _validate_confidence(v)
        return v

    @model_validator(mode="after")
    def _auto_hash(self) -> "DiscoveredUrl":
        if not self.url_hash:
            object.__setattr__(self, "url_hash", hash_url(self.url))
        return self

    @classmethod
    def create(
        cls,
        *,
        investigation_id: str,
        url: str,
        source_type: SourceType,
        source_query_id: Optional[str] = None,
        title: Optional[str] = None,
        snippet: Optional[str] = None,
        relevance_score: Optional[float] = None,
        status: UrlStatus = UrlStatus.PENDING,
        rejection_reason: Optional[str] = None,
    ) -> "DiscoveredUrl":
        now = utc_now()
        return cls(
            id=generate_id(),
            investigation_id=investigation_id,
            url=url,
            url_hash=hash_url(url),
            source_query_id=source_query_id,
            source_type=source_type,
            title=title,
            snippet=snippet,
            relevance_score=relevance_score,
            status=status,
            rejection_reason=rejection_reason,
            first_seen_at=now,
            created_at=now,
        )


class CollectedDocument(BaseModel):
    """Raw document collected from a URL."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=generate_id)
    investigation_id: str
    url_id: str
    content_hash: str
    content_type: Optional[str] = None
    content_length: Optional[int] = None
    encrypted_path: Optional[str] = None
    extracted_text_hash: Optional[str] = None
    extraction_method: Optional[str] = None
    http_status: Optional[int] = None
    http_headers: Optional[dict[str, str]] = None
    robots_compliant: bool = True
    collected_at: datetime = Field(default_factory=utc_now)
    previous_version_id: Optional[str] = None
    changed_since_last: Optional[bool] = None
    created_at: datetime = Field(default_factory=utc_now)

    @classmethod
    def create(
        cls,
        *,
        investigation_id: str,
        url_id: str,
        content_hash: str,
        content_type: Optional[str] = None,
        content_length: Optional[int] = None,
        encrypted_path: Optional[str] = None,
        extracted_text_hash: Optional[str] = None,
        extraction_method: Optional[str] = None,
        http_status: Optional[int] = None,
        http_headers: Optional[dict[str, str]] = None,
        robots_compliant: bool = True,
        previous_version_id: Optional[str] = None,
        changed_since_last: Optional[bool] = None,
    ) -> "CollectedDocument":
        now = utc_now()
        return cls(
            id=generate_id(),
            investigation_id=investigation_id,
            url_id=url_id,
            content_hash=content_hash,
            content_type=content_type,
            content_length=content_length,
            encrypted_path=encrypted_path,
            extracted_text_hash=extracted_text_hash,
            extraction_method=extraction_method,
            http_status=http_status,
            http_headers=http_headers,
            robots_compliant=robots_compliant,
            previous_version_id=previous_version_id,
            changed_since_last=changed_since_last,
            collected_at=now,
            created_at=now,
        )


class Identity(BaseModel):
    """A resolved or candidate identity."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=generate_id)
    investigation_id: str
    identity_type: IdentityType
    canonical_value: str
    display_name: Optional[str] = None
    is_target: bool = False
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    confidence_explanation: Optional[str] = None
    verification_status: VerificationStatus = VerificationStatus.UNVERIFIED
    first_seen_at: datetime = Field(default_factory=utc_now)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    @field_validator("confidence")
    @classmethod
    def _check_confidence(cls, v: float) -> float:
        return _validate_confidence(v)

    @classmethod
    def create(
        cls,
        *,
        investigation_id: str,
        identity_type: IdentityType,
        canonical_value: str,
        display_name: Optional[str] = None,
        is_target: bool = False,
        confidence: float = 0.0,
        confidence_explanation: Optional[str] = None,
        verification_status: VerificationStatus = VerificationStatus.UNVERIFIED,
    ) -> "Identity":
        now = utc_now()
        return cls(
            id=generate_id(),
            investigation_id=investigation_id,
            identity_type=identity_type,
            canonical_value=canonical_value,
            display_name=display_name,
            is_target=is_target,
            confidence=confidence,
            confidence_explanation=confidence_explanation,
            verification_status=verification_status,
            first_seen_at=now,
            created_at=now,
            updated_at=now,
        )


class IdentitySignal(BaseModel):
    """Evidence supporting an identity resolution."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=generate_id)
    identity_id: str
    signal_type: SignalType
    signal_value: str
    signal_strength: float = Field(default=0.0, ge=0.0, le=1.0)
    source_document_id: Optional[str] = None
    source_url: Optional[str] = None
    raw_evidence: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)

    @field_validator("signal_strength")
    @classmethod
    def _check_strength(cls, v: float) -> float:
        return _validate_confidence(v)

    @classmethod
    def create(
        cls,
        *,
        identity_id: str,
        signal_type: SignalType,
        signal_value: str,
        signal_strength: float = 0.5,
        source_document_id: Optional[str] = None,
        source_url: Optional[str] = None,
        raw_evidence: Optional[str] = None,
    ) -> "IdentitySignal":
        return cls(
            id=generate_id(),
            identity_id=identity_id,
            signal_type=signal_type,
            signal_value=signal_value,
            signal_strength=signal_strength,
            source_document_id=source_document_id,
            source_url=source_url,
            raw_evidence=raw_evidence,
            created_at=utc_now(),
        )


class IdentityLink(BaseModel):
    """Link between two identities (undirected)."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=generate_id)
    investigation_id: str
    identity_a_id: str
    identity_b_id: str
    link_type: LinkType
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    evidence_summary: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)

    @field_validator("confidence")
    @classmethod
    def _check_confidence(cls, v: float) -> float:
        return _validate_confidence(v)

    @model_validator(mode="after")
    def _enforce_ordering(self) -> "IdentityLink":
        if self.identity_a_id >= self.identity_b_id:
            raise ValueError(
                "identity_a_id must be strictly less than identity_b_id "
                f"(got a={self.identity_a_id!r}, b={self.identity_b_id!r})"
            )
        return self

    @classmethod
    def create(
        cls,
        *,
        investigation_id: str,
        identity_a_id: str,
        identity_b_id: str,
        link_type: LinkType,
        confidence: float = 0.5,
        evidence_summary: Optional[str] = None,
    ) -> "IdentityLink":
        # Auto-sort so callers don't need to worry about ordering
        a, b = sorted([identity_a_id, identity_b_id])
        return cls(
            id=generate_id(),
            investigation_id=investigation_id,
            identity_a_id=a,
            identity_b_id=b,
            link_type=link_type,
            confidence=confidence,
            evidence_summary=evidence_summary,
            created_at=utc_now(),
        )


class Relationship(BaseModel):
    """Directed or undirected relationship between identities."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=generate_id)
    investigation_id: str
    source_identity_id: str
    target_identity_id: str
    relationship_type: str
    direction: Direction
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    evidence_summary: Optional[str] = None
    source_document_id: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)

    @field_validator("confidence")
    @classmethod
    def _check_confidence(cls, v: float) -> float:
        return _validate_confidence(v)

    @classmethod
    def create(
        cls,
        *,
        investigation_id: str,
        source_identity_id: str,
        target_identity_id: str,
        relationship_type: str,
        direction: Direction = Direction.DIRECTED,
        confidence: float = 0.5,
        evidence_summary: Optional[str] = None,
        source_document_id: Optional[str] = None,
    ) -> "Relationship":
        return cls(
            id=generate_id(),
            investigation_id=investigation_id,
            source_identity_id=source_identity_id,
            target_identity_id=target_identity_id,
            relationship_type=relationship_type,
            direction=direction,
            confidence=confidence,
            evidence_summary=evidence_summary,
            source_document_id=source_document_id,
            created_at=utc_now(),
        )


class Finding(BaseModel):
    """An analytical finding or fact."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=generate_id)
    investigation_id: str
    identity_id: Optional[str] = None
    finding_type: FindingType
    category: str
    summary: str
    detail: Optional[str] = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    confidence_explanation: Optional[str] = None
    temporal_date: Optional[datetime] = None
    temporal_precision: Optional[TemporalPrecision] = None
    is_new: bool = True
    supersedes_id: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    @field_validator("confidence")
    @classmethod
    def _check_confidence(cls, v: float) -> float:
        return _validate_confidence(v)

    @classmethod
    def create(
        cls,
        *,
        investigation_id: str,
        finding_type: FindingType,
        category: str,
        summary: str,
        detail: Optional[str] = None,
        confidence: float = 0.5,
        confidence_explanation: Optional[str] = None,
        temporal_date: Optional[datetime] = None,
        temporal_precision: Optional[TemporalPrecision] = None,
        is_new: bool = True,
        identity_id: Optional[str] = None,
        supersedes_id: Optional[str] = None,
    ) -> "Finding":
        now = utc_now()
        return cls(
            id=generate_id(),
            investigation_id=investigation_id,
            identity_id=identity_id,
            finding_type=finding_type,
            category=category,
            summary=summary,
            detail=detail,
            confidence=confidence,
            confidence_explanation=confidence_explanation,
            temporal_date=temporal_date,
            temporal_precision=temporal_precision,
            is_new=is_new,
            supersedes_id=supersedes_id,
            created_at=now,
            updated_at=now,
        )


class FindingSource(BaseModel):
    """Source reference for a finding."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=generate_id)
    finding_id: str
    document_id: str
    url: str
    excerpt: Optional[str] = None
    page_or_section: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)

    @classmethod
    def create(
        cls,
        *,
        finding_id: str,
        document_id: str,
        url: str,
        excerpt: Optional[str] = None,
        page_or_section: Optional[str] = None,
    ) -> "FindingSource":
        return cls(
            id=generate_id(),
            finding_id=finding_id,
            document_id=document_id,
            url=url,
            excerpt=excerpt,
            page_or_section=page_or_section,
            created_at=utc_now(),
        )


class InvestigationRun(BaseModel):
    """A single execution run of an investigation pipeline."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=generate_id)
    investigation_id: str
    run_number: int
    status: RunStatus
    config_snapshot: dict[str, object] = Field(default_factory=dict)
    stats: dict[str, object] = Field(default_factory=dict)
    started_at: datetime = Field(default_factory=utc_now)
    completed_at: Optional[datetime] = None

    @classmethod
    def create(
        cls,
        *,
        investigation_id: str,
        run_number: int,
        config_snapshot: Optional[dict[str, object]] = None,
        status: RunStatus = RunStatus.RUNNING,
        stats: Optional[dict[str, object]] = None,
    ) -> "InvestigationRun":
        return cls(
            id=generate_id(),
            investigation_id=investigation_id,
            run_number=run_number,
            status=status,
            config_snapshot=config_snapshot or {},
            stats=stats or {},
            started_at=utc_now(),
        )


class SourceCheckLog(BaseModel):
    """Log entry for a source re-check."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=generate_id)
    investigation_id: str
    run_id: str
    url_id: str
    previous_content_hash: Optional[str] = None
    new_content_hash: Optional[str] = None
    changed: Optional[bool] = None
    checked_at: datetime = Field(default_factory=utc_now)

    @classmethod
    def create(
        cls,
        *,
        investigation_id: str,
        run_id: str,
        url_id: str,
        previous_content_hash: Optional[str] = None,
        new_content_hash: Optional[str] = None,
        changed: Optional[bool] = None,
    ) -> "SourceCheckLog":
        return cls(
            id=generate_id(),
            investigation_id=investigation_id,
            run_id=run_id,
            url_id=url_id,
            previous_content_hash=previous_content_hash,
            new_content_hash=new_content_hash,
            changed=changed,
            checked_at=utc_now(),
        )


class PipelineTask(BaseModel):
    """A single task within the processing pipeline."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=generate_id)
    investigation_id: str
    run_id: Optional[str] = None
    task_type: PipelineTaskType
    priority: int = 0
    status: PipelineTaskStatus = PipelineTaskStatus.PENDING
    input_data: Optional[dict[str, object]] = None
    output_data: Optional[dict[str, object]] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    created_at: datetime = Field(default_factory=utc_now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    @classmethod
    def create(
        cls,
        *,
        investigation_id: str,
        task_type: PipelineTaskType,
        priority: int = 0,
        run_id: Optional[str] = None,
        input_data: Optional[dict[str, object]] = None,
        max_retries: int = 3,
    ) -> "PipelineTask":
        return cls(
            id=generate_id(),
            investigation_id=investigation_id,
            run_id=run_id,
            task_type=task_type,
            priority=priority,
            status=PipelineTaskStatus.PENDING,
            input_data=input_data,
            retry_count=0,
            max_retries=max_retries,
            created_at=utc_now(),
        )


class ResourceUsage(BaseModel):
    """Tracks consumption of a budgeted resource."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=generate_id)
    investigation_id: str
    run_id: Optional[str] = None
    resource_type: ResourceType
    amount: float
    unit: str
    context: Optional[dict[str, object]] = None
    recorded_at: datetime = Field(default_factory=utc_now)

    @classmethod
    def create(
        cls,
        *,
        investigation_id: str,
        resource_type: ResourceType,
        amount: float,
        unit: str,
        run_id: Optional[str] = None,
        context: Optional[dict[str, object]] = None,
    ) -> "ResourceUsage":
        return cls(
            id=generate_id(),
            investigation_id=investigation_id,
            run_id=run_id,
            resource_type=resource_type,
            amount=amount,
            unit=unit,
            context=context,
            recorded_at=utc_now(),
        )


# ============================================================
# API DTOs — Request / Response schemas
# ============================================================

class CreateInvestigationRequest(BaseModel):
    """DTO for creating a new investigation."""

    model_config = ConfigDict(frozen=True)

    name: str
    description: Optional[str] = None
    target_name: str
    target_signals: dict[str, object] = Field(default_factory=dict)
    config: Optional[dict[str, object]] = None


class InvestigationResponse(BaseModel):
    """Full investigation representation for API responses."""

    model_config = ConfigDict(frozen=True)

    id: str
    name: str
    description: str
    target_name: str
    target_signals: dict[str, object]
    config: dict[str, object]
    encryption_key_id: str
    status: InvestigationStatus
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None


class InvestigationSummary(BaseModel):
    """Lightweight investigation info for list views."""

    model_config = ConfigDict(frozen=True)

    id: str
    name: str
    target_name: str
    status: InvestigationStatus
    created_at: datetime
    updated_at: datetime


class FindingResponse(BaseModel):
    """Finding with embedded sources."""

    model_config = ConfigDict(frozen=True)

    id: str
    investigation_id: str
    identity_id: Optional[str] = None
    finding_type: FindingType
    category: str
    summary: str
    detail: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0)
    confidence_explanation: Optional[str] = None
    temporal_date: Optional[datetime] = None
    temporal_precision: Optional[TemporalPrecision] = None
    is_new: bool
    supersedes_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    sources: list[FindingSource] = Field(default_factory=list)


class IdentityResponse(BaseModel):
    """Identity with aggregated counts."""

    model_config = ConfigDict(frozen=True)

    id: str
    investigation_id: str
    identity_type: IdentityType
    canonical_value: str
    display_name: Optional[str] = None
    is_target: bool
    confidence: float = Field(ge=0.0, le=1.0)
    confidence_explanation: Optional[str] = None
    verification_status: VerificationStatus
    first_seen_at: datetime
    created_at: datetime
    updated_at: datetime
    signal_count: int = 0
    link_count: int = 0


class PipelineProgress(BaseModel):
    """Real-time pipeline execution progress."""

    model_config = ConfigDict(frozen=True)

    investigation_id: str
    run_number: int
    total_tasks: int
    completed_tasks: int
    failed_tasks: int
    task_breakdown: dict[str, dict[str, int]] = Field(default_factory=dict)
