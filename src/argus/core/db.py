"""Async SQLite database manager and repository implementations for ARGUS.

Handles database connection management, WAL mode, foreign key enforcement,
FTS5 full text indexing, schema migration, and typed repositories.
"""

from __future__ import annotations

import contextlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncContextManager, AsyncGenerator, Optional

import aiosqlite

from argus.core.models import (
    CollectedDocument,
    Direction,
    DiscoveredUrl,
    Finding,
    FindingSource,
    FindingType,
    Identity,
    IdentityLink,
    IdentitySignal,
    IdentityType,
    Investigation,
    InvestigationRun,
    InvestigationStatus,
    LinkType,
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
    utc_now,
)

logger = logging.getLogger("argus.db")

SCHEMA_VERSION = 1

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS investigations (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    target_name     TEXT NOT NULL,
    target_signals  TEXT NOT NULL DEFAULT '{}',
    config          TEXT NOT NULL DEFAULT '{}',
    encryption_key_id TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'created'
                    CHECK(status IN ('created','running','paused','completed','archived','purged')),
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    deleted_at      TEXT
);

CREATE TABLE IF NOT EXISTS search_queries (
    id              TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL REFERENCES investigations(id),
    query_text      TEXT NOT NULL,
    query_type      TEXT NOT NULL
                    CHECK(query_type IN ('exact_name','username','email','domain','url','freetext','profile_url')),
    provider        TEXT NOT NULL,
    depth_level     INTEGER NOT NULL DEFAULT 0,
    parent_source_id TEXT,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','running','completed','failed','skipped')),
    result_count    INTEGER,
    executed_at     TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS discovered_urls (
    id              TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL REFERENCES investigations(id),
    url             TEXT NOT NULL,
    url_hash        TEXT NOT NULL,
    source_query_id TEXT REFERENCES search_queries(id),
    source_type     TEXT NOT NULL
                    CHECK(source_type IN ('search_result','extracted_link','manual','rescan','direct_seed')),
    title           TEXT,
    snippet         TEXT,
    relevance_score REAL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','queued','collected','filtered','rejected','error','robots_blocked')),
    rejection_reason TEXT,
    first_seen_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_checked_at TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(investigation_id, url_hash)
);

CREATE TABLE IF NOT EXISTS collected_documents (
    id              TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL REFERENCES investigations(id),
    url_id          TEXT NOT NULL REFERENCES discovered_urls(id),
    content_hash    TEXT NOT NULL,
    content_type    TEXT,
    content_length  INTEGER,
    encrypted_path  TEXT,
    extracted_text_hash TEXT,
    extraction_method TEXT,
    http_status     INTEGER,
    http_headers    TEXT,
    robots_compliant BOOLEAN NOT NULL DEFAULT 1,
    collected_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    previous_version_id TEXT REFERENCES collected_documents(id),
    changed_since_last BOOLEAN,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
    document_id,
    extracted_text
);

CREATE TABLE IF NOT EXISTS identities (
    id              TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL REFERENCES investigations(id),
    identity_type   TEXT NOT NULL
                    CHECK(identity_type IN ('person','username','email','domain','organization','phone','other')),
    canonical_value TEXT NOT NULL,
    display_name    TEXT,
    is_target       BOOLEAN NOT NULL DEFAULT 0,
    confidence      REAL NOT NULL DEFAULT 0.0
                    CHECK(confidence >= 0.0 AND confidence <= 1.0),
    confidence_explanation TEXT,
    verification_status TEXT NOT NULL DEFAULT 'unverified'
                    CHECK(verification_status IN ('unverified','likely','verified','rejected','ambiguous')),
    first_seen_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS identity_signals (
    id              TEXT PRIMARY KEY,
    identity_id     TEXT NOT NULL REFERENCES identities(id),
    signal_type     TEXT NOT NULL
                    CHECK(signal_type IN ('username_match','email_match','name_match',
                        'bio_reference','cross_link','domain_whois','writing_style',
                        'avatar_match','temporal_correlation','profile_data','llm_analysis')),
    signal_value    TEXT NOT NULL,
    signal_strength REAL NOT NULL
                    CHECK(signal_strength >= 0.0 AND signal_strength <= 1.0),
    source_document_id TEXT REFERENCES collected_documents(id),
    source_url      TEXT,
    raw_evidence    TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS identity_links (
    id              TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL REFERENCES investigations(id),
    identity_a_id   TEXT NOT NULL REFERENCES identities(id),
    identity_b_id   TEXT NOT NULL REFERENCES identities(id),
    link_type       TEXT NOT NULL
                    CHECK(link_type IN ('same_person','alias','associated','mentioned_together','contradicts')),
    confidence      REAL NOT NULL
                    CHECK(confidence >= 0.0 AND confidence <= 1.0),
    evidence_summary TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CHECK(identity_a_id < identity_b_id)
);

CREATE TABLE IF NOT EXISTS relationships (
    id              TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL REFERENCES investigations(id),
    source_identity_id TEXT NOT NULL REFERENCES identities(id),
    target_identity_id TEXT NOT NULL REFERENCES identities(id),
    relationship_type TEXT NOT NULL,
    direction       TEXT NOT NULL DEFAULT 'undirected'
                    CHECK(direction IN ('directed','undirected')),
    confidence      REAL NOT NULL
                    CHECK(confidence >= 0.0 AND confidence <= 1.0),
    evidence_summary TEXT,
    source_document_id TEXT REFERENCES collected_documents(id),
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS findings (
    id              TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL REFERENCES investigations(id),
    identity_id     TEXT REFERENCES identities(id),
    finding_type    TEXT NOT NULL
                    CHECK(finding_type IN ('fact','inference','contradiction','uncertainty','timeline_event')),
    category        TEXT NOT NULL,
    summary         TEXT NOT NULL,
    detail          TEXT,
    confidence      REAL NOT NULL
                    CHECK(confidence >= 0.0 AND confidence <= 1.0),
    confidence_explanation TEXT,
    temporal_date   TEXT,
    temporal_precision TEXT
                    CHECK(temporal_precision IN ('exact','month','year','decade','approximate')),
    is_new          BOOLEAN NOT NULL DEFAULT 1,
    supersedes_id   TEXT REFERENCES findings(id),
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS finding_sources (
    id              TEXT PRIMARY KEY,
    finding_id      TEXT NOT NULL REFERENCES findings(id),
    document_id     TEXT NOT NULL REFERENCES collected_documents(id),
    url             TEXT NOT NULL,
    excerpt         TEXT,
    page_or_section TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS investigation_runs (
    id              TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL REFERENCES investigations(id),
    run_number      INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'running'
                    CHECK(status IN ('running','completed','failed','cancelled')),
    config_snapshot TEXT NOT NULL,
    stats           TEXT NOT NULL DEFAULT '{}',
    started_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    completed_at    TEXT,
    UNIQUE(investigation_id, run_number)
);

CREATE TABLE IF NOT EXISTS source_check_log (
    id              TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL REFERENCES investigations(id),
    run_id          TEXT NOT NULL REFERENCES investigation_runs(id),
    url_id          TEXT NOT NULL REFERENCES discovered_urls(id),
    previous_content_hash TEXT,
    new_content_hash TEXT,
    changed         BOOLEAN,
    checked_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS pipeline_tasks (
    id              TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL REFERENCES investigations(id),
    run_id          TEXT REFERENCES investigation_runs(id),
    task_type       TEXT NOT NULL
                    CHECK(task_type IN ('search','collect','extract','filter','resolve','analyze','discover_relationships')),
    priority        INTEGER NOT NULL DEFAULT 5,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','queued','running','completed','failed','cancelled','budget_exceeded')),
    input_data      TEXT,
    output_data     TEXT,
    error_message   TEXT,
    retry_count     INTEGER NOT NULL DEFAULT 0,
    max_retries     INTEGER NOT NULL DEFAULT 3,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    started_at      TEXT,
    completed_at    TEXT
);

CREATE TABLE IF NOT EXISTS resource_usage (
    id              TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL REFERENCES investigations(id),
    run_id          TEXT REFERENCES investigation_runs(id),
    resource_type   TEXT NOT NULL
                    CHECK(resource_type IN ('http_request','llm_token_input','llm_token_output',
                        'llm_call','document_bytes','search_query','cpu_seconds')),
    amount          REAL NOT NULL,
    unit            TEXT NOT NULL,
    context         TEXT,
    recorded_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_urls_investigation ON discovered_urls(investigation_id, status);
CREATE INDEX IF NOT EXISTS idx_urls_hash ON discovered_urls(url_hash);
CREATE INDEX IF NOT EXISTS idx_docs_investigation ON collected_documents(investigation_id);
CREATE INDEX IF NOT EXISTS idx_docs_content_hash ON collected_documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_docs_url ON collected_documents(url_id);
CREATE INDEX IF NOT EXISTS idx_identities_investigation ON identities(investigation_id, identity_type);
CREATE INDEX IF NOT EXISTS idx_signals_identity ON identity_signals(identity_id);
CREATE INDEX IF NOT EXISTS idx_findings_investigation ON findings(investigation_id, finding_type);
CREATE INDEX IF NOT EXISTS idx_findings_identity ON findings(identity_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON pipeline_tasks(investigation_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_source_check ON source_check_log(investigation_id, url_id);
CREATE INDEX IF NOT EXISTS idx_resource_usage ON resource_usage(investigation_id, resource_type);
"""


def _iso(dt: Optional[datetime]) -> Optional[str]:
    """Convert datetime to ISO 8601 string in UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    """Parse ISO 8601 string into timezone-aware datetime."""
    if s is None:
        return None
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None


class Database:
    """Async SQLite database manager with WAL mode, foreign keys, and connection pooling."""

    def __init__(
        self,
        db_path: str | Path,
        wal_mode: bool = True,
        busy_timeout_ms: int = 5000,
    ) -> None:
        self.db_path = Path(db_path)
        self.wal_mode = wal_mode
        self.busy_timeout_ms = busy_timeout_ms
        self._connection: Optional[aiosqlite.Connection] = None
        self._in_transaction: bool = False

    async def connect(self) -> None:
        """Open the database connection, configure pragmas, and run migrations."""
        if str(self.db_path) != ":memory:":
            self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self._connection = await aiosqlite.connect(self.db_path)
        self._connection.row_factory = aiosqlite.Row

        # Pragmas
        await self._connection.execute("PRAGMA foreign_keys = ON;")
        await self._connection.execute(f"PRAGMA busy_timeout = {self.busy_timeout_ms};")
        if self.wal_mode and str(self.db_path) != ":memory:":
            await self._connection.execute("PRAGMA journal_mode = WAL;")

        await self._connection.commit()
        await self.migrate()

    async def disconnect(self) -> None:
        """Close the database connection gracefully."""
        if self._connection is not None:
            await self._connection.close()
            self._connection = None

    @property
    def is_connected(self) -> bool:
        """Check if connection is open."""
        return self._connection is not None

    def _require_connection(self) -> aiosqlite.Connection:
        if self._connection is None:
            raise RuntimeError("Database is not connected. Call connect() first.")
        return self._connection

    async def execute(
        self, sql: str, params: tuple[Any, ...] | dict[str, Any] | None = None
    ) -> aiosqlite.Cursor:
        """Execute a single SQL statement."""
        conn = self._require_connection()
        if params is not None:
            cursor = await conn.execute(sql, params)
        else:
            cursor = await conn.execute(sql)
        if not self._in_transaction:
            await conn.commit()
        return cursor

    async def execute_many(
        self, sql: str, params_seq: list[tuple[Any, ...] | dict[str, Any]]
    ) -> None:
        """Execute a statement with multiple parameter sets."""
        conn = self._require_connection()
        await conn.executemany(sql, params_seq)
        if not self._in_transaction:
            await conn.commit()

    async def fetch_one(
        self, sql: str, params: tuple[Any, ...] | dict[str, Any] | None = None
    ) -> Optional[dict[str, Any]]:
        """Fetch a single row as a dictionary. Returns None if no row."""
        conn = self._require_connection()
        async with conn.execute(sql, params or ()) as cursor:
            row = await cursor.fetchone()
            if row is None:
                return None
            return dict(row)

    async def fetch_all(
        self, sql: str, params: tuple[Any, ...] | dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        """Fetch all rows as a list of dictionaries."""
        conn = self._require_connection()
        async with conn.execute(sql, params or ()) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def fetch_val(
        self, sql: str, params: tuple[Any, ...] | dict[str, Any] | None = None
    ) -> Any:
        """Fetch a single scalar value."""
        conn = self._require_connection()
        async with conn.execute(sql, params or ()) as cursor:
            row = await cursor.fetchone()
            if row is None:
                return None
            return row[0]

    @contextlib.asynccontextmanager
    async def transaction(self) -> AsyncGenerator[None, None]:
        """Async context manager for explicit transactions (BEGIN ... COMMIT/ROLLBACK)."""
        conn = self._require_connection()
        self._in_transaction = True
        try:
            yield
            await conn.commit()
        except Exception:
            await conn.rollback()
            raise
        finally:
            self._in_transaction = False

    async def migrate(self) -> None:
        """Run schema migrations up to SCHEMA_VERSION."""
        conn = self._require_connection()

        # Check if schema_version exists
        async with conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
        ) as cursor:
            has_version_tbl = await cursor.fetchone() is not None

        current_version = 0
        if has_version_tbl:
            async with conn.execute("SELECT MAX(version) FROM schema_version") as cursor:
                row = await cursor.fetchone()
                if row and row[0] is not None:
                    current_version = row[0]

        if current_version < 1:
            await conn.executescript(SCHEMA_SQL)
            await conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (?, ?)",
                (1, utc_now().isoformat()),
            )
            await conn.commit()
            logger.info("Applied database migration to schema version 1")


# ============================================================
# Repositories
# ============================================================

class InvestigationRepository:
    """CRUD operations for investigations."""

    def __init__(self, db: Database) -> None:
        self.db = db

    async def create(self, inv: Investigation) -> Investigation:
        """Insert a new investigation."""
        sql = """
        INSERT INTO investigations (
            id, name, description, target_name, target_signals,
            config, encryption_key_id, status, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        await self.db.execute(
            sql,
            (
                inv.id,
                inv.name,
                inv.description,
                inv.target_name,
                json.dumps(inv.target_signals),
                json.dumps(inv.config),
                inv.encryption_key_id,
                inv.status.value,
                _iso(inv.created_at),
                _iso(inv.updated_at),
                _iso(inv.deleted_at),
            ),
        )
        return inv

    async def get(self, investigation_id: str) -> Optional[Investigation]:
        """Get an investigation by ID."""
        row = await self.db.fetch_one(
            "SELECT * FROM investigations WHERE id = ?", (investigation_id,)
        )
        if not row:
            return None
        return self._to_model(row)

    async def list_all(self, include_deleted: bool = False) -> list[Investigation]:
        """List all investigations."""
        if include_deleted:
            rows = await self.db.fetch_all("SELECT * FROM investigations ORDER BY created_at DESC")
        else:
            rows = await self.db.fetch_all(
                "SELECT * FROM investigations WHERE deleted_at IS NULL ORDER BY created_at DESC"
            )
        return [self._to_model(r) for r in rows]

    async def update_status(self, investigation_id: str, status: InvestigationStatus) -> None:
        """Update investigation status and updated_at."""
        await self.db.execute(
            "UPDATE investigations SET status = ?, updated_at = ? WHERE id = ?",
            (status.value, utc_now().isoformat(), investigation_id),
        )

    async def soft_delete(self, investigation_id: str) -> None:
        """Soft delete investigation by setting deleted_at."""
        now = utc_now().isoformat()
        await self.db.execute(
            "UPDATE investigations SET deleted_at = ?, updated_at = ? WHERE id = ?",
            (now, now, investigation_id),
        )

    async def hard_delete(self, investigation_id: str) -> None:
        """Permanently delete investigation and all cascading dependent data in reverse FK order."""
        async with self.db.transaction():
            # Delete in leaf-to-root order
            await self.db.execute("DELETE FROM resource_usage WHERE investigation_id = ?", (investigation_id,))
            await self.db.execute("DELETE FROM pipeline_tasks WHERE investigation_id = ?", (investigation_id,))
            await self.db.execute("DELETE FROM source_check_log WHERE investigation_id = ?", (investigation_id,))
            await self.db.execute("DELETE FROM investigation_runs WHERE investigation_id = ?", (investigation_id,))
            await self.db.execute(
                "DELETE FROM finding_sources WHERE finding_id IN (SELECT id FROM findings WHERE investigation_id = ?)",
                (investigation_id,),
            )
            await self.db.execute("DELETE FROM findings WHERE investigation_id = ?", (investigation_id,))
            await self.db.execute("DELETE FROM relationships WHERE investigation_id = ?", (investigation_id,))
            await self.db.execute("DELETE FROM identity_links WHERE investigation_id = ?", (investigation_id,))
            await self.db.execute(
                "DELETE FROM identity_signals WHERE identity_id IN (SELECT id FROM identities WHERE investigation_id = ?)",
                (investigation_id,),
            )
            await self.db.execute("DELETE FROM identities WHERE investigation_id = ?", (investigation_id,))
            await self.db.execute(
                "DELETE FROM documents_fts WHERE document_id IN (SELECT id FROM collected_documents WHERE investigation_id = ?)",
                (investigation_id,),
            )
            await self.db.execute("DELETE FROM collected_documents WHERE investigation_id = ?", (investigation_id,))
            await self.db.execute("DELETE FROM discovered_urls WHERE investigation_id = ?", (investigation_id,))
            await self.db.execute("DELETE FROM search_queries WHERE investigation_id = ?", (investigation_id,))
            await self.db.execute("DELETE FROM investigations WHERE id = ?", (investigation_id,))

    @staticmethod
    def _to_model(row: dict[str, Any]) -> Investigation:
        return Investigation(
            id=row["id"],
            name=row["name"],
            description=row["description"] or "",
            target_name=row["target_name"],
            target_signals=json.loads(row["target_signals"] or "{}"),
            config=json.loads(row["config"] or "{}"),
            encryption_key_id=row["encryption_key_id"] or "",
            status=InvestigationStatus(row["status"]),
            created_at=_parse_iso(row["created_at"]) or utc_now(),
            updated_at=_parse_iso(row["updated_at"]) or utc_now(),
            deleted_at=_parse_iso(row["deleted_at"]),
        )


class UrlRepository:
    """CRUD operations for discovered URLs."""

    def __init__(self, db: Database) -> None:
        self.db = db

    async def create(self, url_obj: DiscoveredUrl) -> DiscoveredUrl:
        """Insert or ignore a discovered URL (deduplicated by investigation_id + url_hash)."""
        sql = """
        INSERT OR IGNORE INTO discovered_urls (
            id, investigation_id, url, url_hash, source_query_id,
            source_type, title, snippet, relevance_score, status,
            rejection_reason, first_seen_at, last_checked_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        await self.db.execute(
            sql,
            (
                url_obj.id,
                url_obj.investigation_id,
                url_obj.url,
                url_obj.url_hash,
                url_obj.source_query_id,
                url_obj.source_type.value,
                url_obj.title,
                url_obj.snippet,
                url_obj.relevance_score,
                url_obj.status.value,
                url_obj.rejection_reason,
                _iso(url_obj.first_seen_at),
                _iso(url_obj.last_checked_at),
                _iso(url_obj.created_at),
            ),
        )
        return url_obj

    async def get(self, url_id: str) -> Optional[DiscoveredUrl]:
        """Get URL by ID."""
        row = await self.db.fetch_one("SELECT * FROM discovered_urls WHERE id = ?", (url_id,))
        if not row:
            return None
        return self._to_model(row)

    async def get_by_hash(self, investigation_id: str, url_hash: str) -> Optional[DiscoveredUrl]:
        """Get URL by investigation_id and url_hash."""
        row = await self.db.fetch_one(
            "SELECT * FROM discovered_urls WHERE investigation_id = ? AND url_hash = ?",
            (investigation_id, url_hash),
        )
        if not row:
            return None
        return self._to_model(row)

    async def list_by_status(self, investigation_id: str, status: UrlStatus) -> list[DiscoveredUrl]:
        """List URLs for an investigation filtered by status."""
        rows = await self.db.fetch_all(
            "SELECT * FROM discovered_urls WHERE investigation_id = ? AND status = ? ORDER BY first_seen_at DESC",
            (investigation_id, status.value),
        )
        return [self._to_model(r) for r in rows]

    async def update_status(
        self, url_id: str, status: UrlStatus, rejection_reason: Optional[str] = None
    ) -> None:
        """Update URL status and rejection reason."""
        now = utc_now().isoformat()
        await self.db.execute(
            "UPDATE discovered_urls SET status = ?, rejection_reason = ?, last_checked_at = ? WHERE id = ?",
            (status.value, rejection_reason, now, url_id),
        )

    async def count_by_investigation(self, investigation_id: str) -> int:
        """Count total URLs for an investigation."""
        val = await self.db.fetch_val(
            "SELECT COUNT(*) FROM discovered_urls WHERE investigation_id = ?",
            (investigation_id,),
        )
        return int(val or 0)

    @staticmethod
    def _to_model(row: dict[str, Any]) -> DiscoveredUrl:
        return DiscoveredUrl(
            id=row["id"],
            investigation_id=row["investigation_id"],
            url=row["url"],
            url_hash=row["url_hash"],
            source_query_id=row["source_query_id"],
            source_type=SourceType(row["source_type"]),
            title=row["title"],
            snippet=row["snippet"],
            relevance_score=row["relevance_score"],
            status=UrlStatus(row["status"]),
            rejection_reason=row["rejection_reason"],
            first_seen_at=_parse_iso(row["first_seen_at"]) or utc_now(),
            last_checked_at=_parse_iso(row["last_checked_at"]),
            created_at=_parse_iso(row["created_at"]) or utc_now(),
        )


class DocumentRepository:
    """CRUD operations for collected documents and full-text search."""

    def __init__(self, db: Database) -> None:
        self.db = db

    async def create(
        self, doc: CollectedDocument, extracted_text: Optional[str] = None
    ) -> CollectedDocument:
        """Insert a collected document and optionally update FTS index."""
        sql = """
        INSERT INTO collected_documents (
            id, investigation_id, url_id, content_hash, content_type,
            content_length, encrypted_path, extracted_text_hash,
            extraction_method, http_status, http_headers, robots_compliant,
            collected_at, previous_version_id, changed_since_last, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        async with self.db.transaction():
            await self.db.execute(
                sql,
                (
                    doc.id,
                    doc.investigation_id,
                    doc.url_id,
                    doc.content_hash,
                    doc.content_type,
                    doc.content_length,
                    doc.encrypted_path,
                    doc.extracted_text_hash,
                    doc.extraction_method,
                    doc.http_status,
                    json.dumps(doc.http_headers) if doc.http_headers is not None else None,
                    1 if doc.robots_compliant else 0,
                    _iso(doc.collected_at),
                    doc.previous_version_id,
                    doc.changed_since_last,
                    _iso(doc.created_at),
                ),
            )
            if extracted_text:
                await self.db.execute(
                    "INSERT INTO documents_fts (document_id, extracted_text) VALUES (?, ?)",
                    (doc.id, extracted_text),
                )
        return doc

    async def get(self, doc_id: str) -> Optional[CollectedDocument]:
        """Get document by ID."""
        row = await self.db.fetch_one("SELECT * FROM collected_documents WHERE id = ?", (doc_id,))
        if not row:
            return None
        return self._to_model(row)

    async def get_by_content_hash(
        self, investigation_id: str, content_hash: str
    ) -> Optional[CollectedDocument]:
        """Find existing document in investigation with same content hash."""
        row = await self.db.fetch_one(
            "SELECT * FROM collected_documents WHERE investigation_id = ? AND content_hash = ?",
            (investigation_id, content_hash),
        )
        if not row:
            return None
        return self._to_model(row)

    async def get_latest_for_url(self, url_id: str) -> Optional[CollectedDocument]:
        """Get the most recently collected document for a URL."""
        row = await self.db.fetch_one(
            "SELECT * FROM collected_documents WHERE url_id = ? ORDER BY collected_at DESC LIMIT 1",
            (url_id,),
        )
        if not row:
            return None
        return self._to_model(row)

    async def search_text(
        self, investigation_id: str, query: str, limit: int = 20
    ) -> list[dict[str, Any]]:
        """Perform full-text search against indexed documents."""
        sql = """
        SELECT d.*, snippet(documents_fts, 1, '<b>', '</b>', '...', 15) as match_snippet
        FROM documents_fts fts
        JOIN collected_documents d ON fts.document_id = d.id
        WHERE d.investigation_id = ? AND documents_fts MATCH ?
        ORDER BY rank
        LIMIT ?
        """
        return await self.db.fetch_all(sql, (investigation_id, query, limit))

    @staticmethod
    def _to_model(row: dict[str, Any]) -> CollectedDocument:
        return CollectedDocument(
            id=row["id"],
            investigation_id=row["investigation_id"],
            url_id=row["url_id"],
            content_hash=row["content_hash"],
            content_type=row["content_type"],
            content_length=row["content_length"],
            encrypted_path=row["encrypted_path"],
            extracted_text_hash=row["extracted_text_hash"],
            extraction_method=row["extraction_method"],
            http_status=row["http_status"],
            http_headers=json.loads(row["http_headers"]) if row["http_headers"] else None,
            robots_compliant=bool(row["robots_compliant"]),
            collected_at=_parse_iso(row["collected_at"]) or utc_now(),
            previous_version_id=row["previous_version_id"],
            changed_since_last=bool(row["changed_since_last"]) if row["changed_since_last"] is not None else None,
            created_at=_parse_iso(row["created_at"]) or utc_now(),
        )


class IdentityRepository:
    """Operations for identities, signals, and identity links."""

    def __init__(self, db: Database) -> None:
        self.db = db

    async def create(self, identity: Identity) -> Identity:
        """Insert an identity."""
        sql = """
        INSERT INTO identities (
            id, investigation_id, identity_type, canonical_value,
            display_name, is_target, confidence, confidence_explanation,
            verification_status, first_seen_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        await self.db.execute(
            sql,
            (
                identity.id,
                identity.investigation_id,
                identity.identity_type.value,
                identity.canonical_value,
                identity.display_name,
                1 if identity.is_target else 0,
                identity.confidence,
                identity.confidence_explanation,
                identity.verification_status.value,
                _iso(identity.first_seen_at),
                _iso(identity.created_at),
                _iso(identity.updated_at),
            ),
        )
        return identity

    async def get(self, identity_id: str) -> Optional[Identity]:
        """Get identity by ID."""
        row = await self.db.fetch_one("SELECT * FROM identities WHERE id = ?", (identity_id,))
        if not row:
            return None
        return self._to_model(row)

    async def list_by_investigation(self, investigation_id: str) -> list[Identity]:
        """List all identities for an investigation."""
        rows = await self.db.fetch_all(
            "SELECT * FROM identities WHERE investigation_id = ? ORDER BY confidence DESC",
            (investigation_id,),
        )
        return [self._to_model(r) for r in rows]

    async def update_confidence(
        self, identity_id: str, confidence: float, explanation: str, status: VerificationStatus
    ) -> None:
        """Update identity confidence score and verification status."""
        await self.db.execute(
            "UPDATE identities SET confidence = ?, confidence_explanation = ?, verification_status = ?, updated_at = ? WHERE id = ?",
            (confidence, explanation, status.value, utc_now().isoformat(), identity_id),
        )

    async def add_signal(self, signal: IdentitySignal) -> IdentitySignal:
        """Add an evidence signal to an identity."""
        sql = """
        INSERT INTO identity_signals (
            id, identity_id, signal_type, signal_value, signal_strength,
            source_document_id, source_url, raw_evidence, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        await self.db.execute(
            sql,
            (
                signal.id,
                signal.identity_id,
                signal.signal_type.value,
                signal.signal_value,
                signal.signal_strength,
                signal.source_document_id,
                signal.source_url,
                signal.raw_evidence,
                _iso(signal.created_at),
            ),
        )
        return signal

    async def get_signals(self, identity_id: str) -> list[IdentitySignal]:
        """Get all signals attached to an identity."""
        rows = await self.db.fetch_all(
            "SELECT * FROM identity_signals WHERE identity_id = ? ORDER BY signal_strength DESC",
            (identity_id,),
        )
        return [
            IdentitySignal(
                id=r["id"],
                identity_id=r["identity_id"],
                signal_type=SignalType(r["signal_type"]),
                signal_value=r["signal_value"],
                signal_strength=r["signal_strength"],
                source_document_id=r["source_document_id"],
                source_url=r["source_url"],
                raw_evidence=r["raw_evidence"],
                created_at=_parse_iso(r["created_at"]) or utc_now(),
            )
            for r in rows
        ]

    async def create_link(self, link: IdentityLink) -> IdentityLink:
        """Link two identities with a relationship type and confidence."""
        sql = """
        INSERT INTO identity_links (
            id, investigation_id, identity_a_id, identity_b_id,
            link_type, confidence, evidence_summary, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        await self.db.execute(
            sql,
            (
                link.id,
                link.investigation_id,
                link.identity_a_id,
                link.identity_b_id,
                link.link_type.value,
                link.confidence,
                link.evidence_summary,
                _iso(link.created_at),
            ),
        )
        return link

    async def get_links(self, investigation_id: str) -> list[IdentityLink]:
        """Get all identity links in an investigation."""
        rows = await self.db.fetch_all(
            "SELECT * FROM identity_links WHERE investigation_id = ?", (investigation_id,)
        )
        return [
            IdentityLink(
                id=r["id"],
                investigation_id=r["investigation_id"],
                identity_a_id=r["identity_a_id"],
                identity_b_id=r["identity_b_id"],
                link_type=LinkType(r["link_type"]),
                confidence=r["confidence"],
                evidence_summary=r["evidence_summary"],
                created_at=_parse_iso(r["created_at"]) or utc_now(),
            )
            for r in rows
        ]

    @staticmethod
    def _to_model(row: dict[str, Any]) -> Identity:
        return Identity(
            id=row["id"],
            investigation_id=row["investigation_id"],
            identity_type=IdentityType(row["identity_type"]),
            canonical_value=row["canonical_value"],
            display_name=row["display_name"],
            is_target=bool(row["is_target"]),
            confidence=row["confidence"],
            confidence_explanation=row["confidence_explanation"],
            verification_status=VerificationStatus(row["verification_status"]),
            first_seen_at=_parse_iso(row["first_seen_at"]) or utc_now(),
            created_at=_parse_iso(row["created_at"]) or utc_now(),
            updated_at=_parse_iso(row["updated_at"]) or utc_now(),
        )


class FindingRepository:
    """Operations for intelligence findings and evidence source citations."""

    def __init__(self, db: Database) -> None:
        self.db = db

    async def create(self, finding: Finding) -> Finding:
        """Insert a finding."""
        sql = """
        INSERT INTO findings (
            id, investigation_id, identity_id, finding_type, category,
            summary, detail, confidence, confidence_explanation,
            temporal_date, temporal_precision, is_new, supersedes_id,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        await self.db.execute(
            sql,
            (
                finding.id,
                finding.investigation_id,
                finding.identity_id,
                finding.finding_type.value,
                finding.category,
                finding.summary,
                finding.detail,
                finding.confidence,
                finding.confidence_explanation,
                _iso(finding.temporal_date),
                finding.temporal_precision.value if finding.temporal_precision else None,
                1 if finding.is_new else 0,
                finding.supersedes_id,
                _iso(finding.created_at),
                _iso(finding.updated_at),
            ),
        )
        return finding

    async def get(self, finding_id: str) -> Optional[Finding]:
        """Get finding by ID."""
        row = await self.db.fetch_one("SELECT * FROM findings WHERE id = ?", (finding_id,))
        if not row:
            return None
        return self._to_model(row)

    async def list_by_investigation(
        self, investigation_id: str, identity_id: Optional[str] = None
    ) -> list[Finding]:
        """List findings for an investigation."""
        if identity_id:
            rows = await self.db.fetch_all(
                "SELECT * FROM findings WHERE investigation_id = ? AND identity_id = ? ORDER BY confidence DESC",
                (investigation_id, identity_id),
            )
        else:
            rows = await self.db.fetch_all(
                "SELECT * FROM findings WHERE investigation_id = ? ORDER BY confidence DESC",
                (investigation_id,),
            )
        return [self._to_model(r) for r in rows]

    async def add_source(self, source: FindingSource) -> FindingSource:
        """Attach a source citation to a finding."""
        sql = """
        INSERT INTO finding_sources (
            id, finding_id, document_id, url, excerpt, page_or_section, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        await self.db.execute(
            sql,
            (
                source.id,
                source.finding_id,
                source.document_id,
                source.url,
                source.excerpt,
                source.page_or_section,
                _iso(source.created_at),
            ),
        )
        return source

    async def get_sources(self, finding_id: str) -> list[FindingSource]:
        """Get all source citations for a finding."""
        rows = await self.db.fetch_all(
            "SELECT * FROM finding_sources WHERE finding_id = ?", (finding_id,)
        )
        return [
            FindingSource(
                id=r["id"],
                finding_id=r["finding_id"],
                document_id=r["document_id"],
                url=r["url"],
                excerpt=r["excerpt"],
                page_or_section=r["page_or_section"],
                created_at=_parse_iso(r["created_at"]) or utc_now(),
            )
            for r in rows
        ]

    @staticmethod
    def _to_model(row: dict[str, Any]) -> Finding:
        return Finding(
            id=row["id"],
            investigation_id=row["investigation_id"],
            identity_id=row["identity_id"],
            finding_type=FindingType(row["finding_type"]),
            category=row["category"],
            summary=row["summary"],
            detail=row["detail"],
            confidence=row["confidence"],
            confidence_explanation=row["confidence_explanation"],
            temporal_date=_parse_iso(row["temporal_date"]),
            temporal_precision=TemporalPrecision(row["temporal_precision"]) if row["temporal_precision"] else None,
            is_new=bool(row["is_new"]),
            supersedes_id=row["supersedes_id"],
            created_at=_parse_iso(row["created_at"]) or utc_now(),
            updated_at=_parse_iso(row["updated_at"]) or utc_now(),
        )


class PipelineTaskRepository:
    """Task queue storage and status tracking."""

    def __init__(self, db: Database) -> None:
        self.db = db

    async def create(self, task: PipelineTask) -> PipelineTask:
        """Insert a pipeline task."""
        sql = """
        INSERT INTO pipeline_tasks (
            id, investigation_id, run_id, task_type, priority,
            status, input_data, output_data, error_message,
            retry_count, max_retries, created_at, started_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        await self.db.execute(
            sql,
            (
                task.id,
                task.investigation_id,
                task.run_id,
                task.task_type.value,
                task.priority,
                task.status.value,
                json.dumps(task.input_data) if task.input_data is not None else None,
                json.dumps(task.output_data) if task.output_data is not None else None,
                task.error_message,
                task.retry_count,
                task.max_retries,
                _iso(task.created_at),
                _iso(task.started_at),
                _iso(task.completed_at),
            ),
        )
        return task

    async def get(self, task_id: str) -> Optional[PipelineTask]:
        """Get task by ID."""
        row = await self.db.fetch_one("SELECT * FROM pipeline_tasks WHERE id = ?", (task_id,))
        if not row:
            return None
        return self._to_model(row)

    async def list_by_status(
        self, investigation_id: str, status: PipelineTaskStatus
    ) -> list[PipelineTask]:
        """List tasks by status, ordered by priority."""
        rows = await self.db.fetch_all(
            "SELECT * FROM pipeline_tasks WHERE investigation_id = ? AND status = ? ORDER BY priority ASC, created_at ASC",
            (investigation_id, status.value),
        )
        return [self._to_model(r) for r in rows]

    async def update_status(
        self,
        task_id: str,
        status: PipelineTaskStatus,
        output_data: Optional[dict[str, Any]] = None,
        error_message: Optional[str] = None,
    ) -> None:
        """Update task status and completion metadata."""
        now = utc_now().isoformat()
        if status in (
            PipelineTaskStatus.COMPLETED,
            PipelineTaskStatus.FAILED,
            PipelineTaskStatus.CANCELLED,
            PipelineTaskStatus.BUDGET_EXCEEDED,
        ):
            await self.db.execute(
                "UPDATE pipeline_tasks SET status = ?, output_data = ?, error_message = ?, completed_at = ? WHERE id = ?",
                (status.value, json.dumps(output_data) if output_data else None, error_message, now, task_id),
            )
        elif status == PipelineTaskStatus.RUNNING:
            await self.db.execute(
                "UPDATE pipeline_tasks SET status = ?, started_at = ? WHERE id = ?",
                (status.value, now, task_id),
            )
        else:
            await self.db.execute(
                "UPDATE pipeline_tasks SET status = ? WHERE id = ?",
                (status.value, task_id),
            )

    @staticmethod
    def _to_model(row: dict[str, Any]) -> PipelineTask:
        return PipelineTask(
            id=row["id"],
            investigation_id=row["investigation_id"],
            run_id=row["run_id"],
            task_type=PipelineTaskType(row["task_type"]),
            priority=row["priority"],
            status=PipelineTaskStatus(row["status"]),
            input_data=json.loads(row["input_data"]) if row["input_data"] else None,
            output_data=json.loads(row["output_data"]) if row["output_data"] else None,
            error_message=row["error_message"],
            retry_count=row["retry_count"],
            max_retries=row["max_retries"],
            created_at=_parse_iso(row["created_at"]) or utc_now(),
            started_at=_parse_iso(row["started_at"]),
            completed_at=_parse_iso(row["completed_at"]),
        )


class RunRepository:
    """Operations for investigation runs (memory and rescan support)."""

    def __init__(self, db: Database) -> None:
        self.db = db

    async def create(self, run: InvestigationRun) -> InvestigationRun:
        """Insert a new run."""
        sql = """
        INSERT INTO investigation_runs (
            id, investigation_id, run_number, status, config_snapshot, stats, started_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        await self.db.execute(
            sql,
            (
                run.id,
                run.investigation_id,
                run.run_number,
                run.status.value,
                json.dumps(run.config_snapshot),
                json.dumps(run.stats),
                _iso(run.started_at),
                _iso(run.completed_at),
            ),
        )
        return run

    async def get(self, run_id: str) -> Optional[InvestigationRun]:
        """Get run by ID."""
        row = await self.db.fetch_one("SELECT * FROM investigation_runs WHERE id = ?", (run_id,))
        if not row:
            return None
        return self._to_model(row)

    async def get_latest(self, investigation_id: str) -> Optional[InvestigationRun]:
        """Get the latest run for an investigation."""
        row = await self.db.fetch_one(
            "SELECT * FROM investigation_runs WHERE investigation_id = ? ORDER BY run_number DESC LIMIT 1",
            (investigation_id,),
        )
        if not row:
            return None
        return self._to_model(row)

    async def update_status_and_stats(
        self, run_id: str, status: RunStatus, stats: Optional[dict[str, Any]] = None
    ) -> None:
        """Update run status and metrics upon completion."""
        now = utc_now().isoformat()
        if stats is not None:
            await self.db.execute(
                "UPDATE investigation_runs SET status = ?, stats = ?, completed_at = ? WHERE id = ?",
                (status.value, json.dumps(stats), now, run_id),
            )
        else:
            await self.db.execute(
                "UPDATE investigation_runs SET status = ?, completed_at = ? WHERE id = ?",
                (status.value, now, run_id),
            )

    @staticmethod
    def _to_model(row: dict[str, Any]) -> InvestigationRun:
        return InvestigationRun(
            id=row["id"],
            investigation_id=row["investigation_id"],
            run_number=row["run_number"],
            status=RunStatus(row["status"]),
            config_snapshot=json.loads(row["config_snapshot"]),
            stats=json.loads(row["stats"] or "{}"),
            started_at=_parse_iso(row["started_at"]) or utc_now(),
            completed_at=_parse_iso(row["completed_at"]),
        )


class ResourceUsageRepository:
    """Operations for resource and budget consumption tracking."""

    def __init__(self, db: Database) -> None:
        self.db = db

    async def record(self, usage: ResourceUsage) -> ResourceUsage:
        """Record an atomic unit of resource consumption."""
        sql = """
        INSERT INTO resource_usage (
            id, investigation_id, run_id, resource_type, amount, unit, context, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        await self.db.execute(
            sql,
            (
                usage.id,
                usage.investigation_id,
                usage.run_id,
                usage.resource_type.value,
                usage.amount,
                usage.unit,
                json.dumps(usage.context) if usage.context is not None else None,
                _iso(usage.recorded_at),
            ),
        )
        return usage

    async def get_summary_by_investigation(
        self, investigation_id: str
    ) -> dict[str, float]:
        """Aggregate total resource usage by resource_type."""
        rows = await self.db.fetch_all(
            "SELECT resource_type, SUM(amount) as total FROM resource_usage WHERE investigation_id = ? GROUP BY resource_type",
            (investigation_id,),
        )
        return {r["resource_type"]: float(r["total"]) for r in rows}


# ============================================================
# Module-level convenience functions
# ============================================================

_database: Optional[Database] = None


async def init_db(
    db_path: str | Path,
    wal_mode: bool = True,
    busy_timeout_ms: int = 5000,
) -> Database:
    """Initialize and connect to the database singleton."""
    global _database
    db = Database(db_path, wal_mode=wal_mode, busy_timeout_ms=busy_timeout_ms)
    await db.connect()
    _database = db
    return db


async def get_db() -> Database:
    """Get the active database singleton. Raises if not initialized."""
    if _database is None or not _database.is_connected:
        raise RuntimeError("Database is not initialized. Call init_db() first.")
    return _database


async def close_db() -> None:
    """Close the database singleton."""
    global _database
    if _database is not None:
        await _database.disconnect()
        _database = None
