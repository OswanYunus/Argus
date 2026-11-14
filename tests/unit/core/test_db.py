"""Unit tests for ARGUS database manager, migrations, and repositories."""

from __future__ import annotations

import asyncio
from pathlib import Path
import pytest
import aiosqlite

from argus.core.db import (
    Database,
    DocumentRepository,
    FindingRepository,
    IdentityRepository,
    InvestigationRepository,
    PipelineTaskRepository,
    ResourceUsageRepository,
    RunRepository,
    UrlRepository,
    close_db,
    get_db,
    init_db,
)
from argus.core.models import (
    CollectedDocument,
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
    ResourceUsage,
    ResourceType,
    RunStatus,
    SignalType,
    SourceType,
    UrlStatus,
    VerificationStatus,
    utc_now,
)


@pytest.fixture
async def mem_db():
    """Create and connect an in-memory test database."""
    db = Database(":memory:", wal_mode=False)
    await db.connect()
    try:
        yield db
    finally:
        await db.disconnect()


@pytest.mark.asyncio
async def test_connect_creates_db_file(tmp_path: Path):
    """Connecting to a non-existent path creates the file and parent dirs."""
    db_file = tmp_path / "nested" / "sub" / "argus_test.db"
    assert not db_file.exists()
    db = Database(db_file, wal_mode=False)
    await db.connect()
    assert db.is_connected
    assert db_file.exists()
    await db.disconnect()


@pytest.mark.asyncio
async def test_schema_migration_v1(mem_db: Database):
    """After connect, all core tables and FTS5 exist."""
    tables = [
        "schema_version",
        "investigations",
        "search_queries",
        "discovered_urls",
        "collected_documents",
        "documents_fts",
        "identities",
        "identity_signals",
        "identity_links",
        "relationships",
        "findings",
        "finding_sources",
        "investigation_runs",
        "source_check_log",
        "pipeline_tasks",
        "resource_usage",
    ]
    for tbl in tables:
        val = await mem_db.fetch_val(
            "SELECT name FROM sqlite_master WHERE name = ?", (tbl,)
        )
        assert val == tbl, f"Table {tbl} was not found"


@pytest.mark.asyncio
async def test_schema_version_recorded(mem_db: Database):
    """schema_version table records version=1."""
    ver = await mem_db.fetch_val("SELECT MAX(version) FROM schema_version")
    assert ver == 1


@pytest.mark.asyncio
async def test_wal_mode_enabled(tmp_path: Path):
    """PRAGMA journal_mode returns 'wal' for file-based DBs."""
    db_file = tmp_path / "wal_test.db"
    db = Database(db_file, wal_mode=True)
    await db.connect()
    mode = await db.fetch_val("PRAGMA journal_mode;")
    assert mode.lower() == "wal"
    await db.disconnect()


@pytest.mark.asyncio
async def test_foreign_keys_enabled(mem_db: Database):
    """Foreign keys pragma is active."""
    fk = await mem_db.fetch_val("PRAGMA foreign_keys;")
    assert fk == 1


@pytest.mark.asyncio
async def test_investigation_crud(mem_db: Database):
    """Investigation create, get, list, update_status, soft_delete."""
    repo = InvestigationRepository(mem_db)
    inv = Investigation.create(
        name="Target 1",
        target_name="Subject Alpha",
        description="OSINT Audit",
        target_signals={"emails": ["alpha@sec.org"]},
    )
    await repo.create(inv)

    fetched = await repo.get(inv.id)
    assert fetched is not None
    assert fetched.name == "Target 1"
    assert fetched.target_name == "Subject Alpha"

    # List all
    all_invs = await repo.list_all()
    assert len(all_invs) == 1

    # Update status
    await repo.update_status(inv.id, InvestigationStatus.RUNNING)
    updated = await repo.get(inv.id)
    assert updated.status == InvestigationStatus.RUNNING

    # Soft delete
    await repo.soft_delete(inv.id)
    active = await repo.list_all(include_deleted=False)
    assert len(active) == 0
    all_including_deleted = await repo.list_all(include_deleted=True)
    assert len(all_including_deleted) == 1
    assert all_including_deleted[0].deleted_at is not None


@pytest.mark.asyncio
async def test_investigation_hard_delete_cascades(mem_db: Database):
    """Hard delete removes investigation and all related records."""
    inv_repo = InvestigationRepository(mem_db)
    url_repo = UrlRepository(mem_db)
    doc_repo = DocumentRepository(mem_db)

    inv = Investigation.create(name="Delete Me", target_name="Target")
    await inv_repo.create(inv)

    url = DiscoveredUrl.create(
        investigation_id=inv.id,
        url="https://example.com/test",
        source_type=SourceType.MANUAL,
    )
    await url_repo.create(url)

    doc = CollectedDocument.create(
        investigation_id=inv.id,
        url_id=url.id,
        content_hash="abc123hash",
        robots_compliant=True,
    )
    await doc_repo.create(doc, extracted_text="Some searchable intelligence")

    # Hard delete
    await inv_repo.hard_delete(inv.id)

    assert await inv_repo.get(inv.id) is None
    assert await url_repo.get(url.id) is None
    assert await doc_repo.get(doc.id) is None


@pytest.mark.asyncio
async def test_url_create_dedup(mem_db: Database):
    """Inserting duplicate url_hash in same investigation does not raise."""
    inv_repo = InvestigationRepository(mem_db)
    url_repo = UrlRepository(mem_db)

    inv = Investigation.create(name="Inv", target_name="Target")
    await inv_repo.create(inv)

    url1 = DiscoveredUrl.create(
        investigation_id=inv.id,
        url="https://example.com/page",
        source_type=SourceType.SEARCH_RESULT,
    )
    await url_repo.create(url1)

    url2 = DiscoveredUrl.create(
        investigation_id=inv.id,
        url="https://example.com/page",  # Same URL and hash
        source_type=SourceType.SEARCH_RESULT,
    )
    await url_repo.create(url2)

    count = await url_repo.count_by_investigation(inv.id)
    assert count == 1


@pytest.mark.asyncio
async def test_url_list_by_status(mem_db: Database):
    """Filtering URLs by status functions correctly."""
    inv_repo = InvestigationRepository(mem_db)
    url_repo = UrlRepository(mem_db)

    inv = Investigation.create(name="Inv", target_name="Target")
    await inv_repo.create(inv)

    u1 = DiscoveredUrl.create(
        investigation_id=inv.id,
        url="https://example.com/pending",
        source_type=SourceType.SEARCH_RESULT,
        status=UrlStatus.PENDING,
    )
    u2 = DiscoveredUrl.create(
        investigation_id=inv.id,
        url="https://example.com/collected",
        source_type=SourceType.SEARCH_RESULT,
        status=UrlStatus.COLLECTED,
    )
    await url_repo.create(u1)
    await url_repo.create(u2)

    pending_list = await url_repo.list_by_status(inv.id, UrlStatus.PENDING)
    assert len(pending_list) == 1
    assert pending_list[0].url == "https://example.com/pending"


@pytest.mark.asyncio
async def test_document_create_and_get(mem_db: Database):
    """Document insert and get operations."""
    inv_repo = InvestigationRepository(mem_db)
    url_repo = UrlRepository(mem_db)
    doc_repo = DocumentRepository(mem_db)

    inv = Investigation.create(name="Inv", target_name="Target")
    await inv_repo.create(inv)
    url = DiscoveredUrl.create(
        investigation_id=inv.id,
        url="https://example.com/doc",
        source_type=SourceType.SEARCH_RESULT,
    )
    await url_repo.create(url)

    doc = CollectedDocument.create(
        investigation_id=inv.id,
        url_id=url.id,
        content_hash="contenthash001",
        content_type="text/html",
        content_length=1024,
        robots_compliant=True,
    )
    await doc_repo.create(doc)

    fetched = await doc_repo.get(doc.id)
    assert fetched is not None
    assert fetched.content_hash == "contenthash001"
    assert fetched.content_length == 1024


@pytest.mark.asyncio
async def test_document_content_hash_lookup(mem_db: Database):
    """get_by_content_hash finds existing duplicate document."""
    inv_repo = InvestigationRepository(mem_db)
    url_repo = UrlRepository(mem_db)
    doc_repo = DocumentRepository(mem_db)

    inv = Investigation.create(name="Inv", target_name="Target")
    await inv_repo.create(inv)
    url = DiscoveredUrl.create(
        investigation_id=inv.id,
        url="https://example.com/doc",
        source_type=SourceType.SEARCH_RESULT,
    )
    await url_repo.create(url)

    doc = CollectedDocument.create(
        investigation_id=inv.id,
        url_id=url.id,
        content_hash="sha256duplicate",
        robots_compliant=True,
    )
    await doc_repo.create(doc)

    found = await doc_repo.get_by_content_hash(inv.id, "sha256duplicate")
    assert found is not None
    assert found.id == doc.id


@pytest.mark.asyncio
async def test_fts_search(mem_db: Database):
    """Full-text search indexed content matches queries."""
    inv_repo = InvestigationRepository(mem_db)
    url_repo = UrlRepository(mem_db)
    doc_repo = DocumentRepository(mem_db)

    inv = Investigation.create(name="Inv", target_name="Target")
    await inv_repo.create(inv)
    url = DiscoveredUrl.create(
        investigation_id=inv.id,
        url="https://example.com/article",
        source_type=SourceType.SEARCH_RESULT,
    )
    await url_repo.create(url)

    doc = CollectedDocument.create(
        investigation_id=inv.id,
        url_id=url.id,
        content_hash="hash_article",
        robots_compliant=True,
    )
    await doc_repo.create(
        doc,
        extracted_text="Jane Doe presented a paper on cybersecurity vulnerabilities in embedded firmware.",
    )

    results = await doc_repo.search_text(inv.id, "cybersecurity")
    assert len(results) == 1
    assert results[0]["id"] == doc.id

    no_results = await doc_repo.search_text(inv.id, "astronomy")
    assert len(no_results) == 0


@pytest.mark.asyncio
async def test_fetch_one_returns_none(mem_db: Database):
    """Querying non-existent record returns None."""
    res = await mem_db.fetch_one("SELECT * FROM investigations WHERE id = ?", ("non-existent",))
    assert res is None


@pytest.mark.asyncio
async def test_fetch_all_empty(mem_db: Database):
    """Querying empty table returns empty list."""
    res = await mem_db.fetch_all("SELECT * FROM investigations WHERE 1=0")
    assert res == []


@pytest.mark.asyncio
async def test_transaction_commit(mem_db: Database):
    """Transaction commit persists data."""
    inv = Investigation.create(name="Tx Commit", target_name="Target")
    async with mem_db.transaction():
        await mem_db.execute(
            "INSERT INTO investigations (id, name, description, target_name, encryption_key_id, status) VALUES (?, ?, ?, ?, ?, ?)",
            (inv.id, inv.name, "", inv.target_name, "", "created"),
        )
    row = await mem_db.fetch_one("SELECT * FROM investigations WHERE id = ?", (inv.id,))
    assert row is not None


@pytest.mark.asyncio
async def test_transaction_rollback(mem_db: Database):
    """Transaction error rolls back all operations in block."""
    inv = Investigation.create(name="Tx Rollback", target_name="Target")
    with pytest.raises(RuntimeError):
        async with mem_db.transaction():
            await mem_db.execute(
                "INSERT INTO investigations (id, name, description, target_name, encryption_key_id, status) VALUES (?, ?, ?, ?, ?, ?)",
                (inv.id, inv.name, "", inv.target_name, "", "created"),
            )
            raise RuntimeError("Intentional abort")

    row = await mem_db.fetch_one("SELECT * FROM investigations WHERE id = ?", (inv.id,))
    assert row is None


@pytest.mark.asyncio
async def test_concurrent_access(mem_db: Database):
    """Multiple concurrent reads execute without locking or conflict."""
    inv_repo = InvestigationRepository(mem_db)
    inv = Investigation.create(name="Concurrent", target_name="Target")
    await inv_repo.create(inv)

    async def read_worker():
        for _ in range(20):
            res = await inv_repo.get(inv.id)
            assert res is not None

    tasks = [asyncio.create_task(read_worker()) for _ in range(5)]
    await asyncio.gather(*tasks)


@pytest.mark.asyncio
async def test_migrate_idempotent(mem_db: Database):
    """Calling migrate() multiple times is safe and maintains version=1."""
    await mem_db.migrate()
    await mem_db.migrate()
    ver = await mem_db.fetch_val("SELECT MAX(version) FROM schema_version")
    assert ver == 1
