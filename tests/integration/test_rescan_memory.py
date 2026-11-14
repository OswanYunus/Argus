"""Integration tests for Investigation Memory and Differential Rescan."""

from __future__ import annotations

from pathlib import Path
import pytest
from pytest_httpx import HTTPXMock

from argus.core.crypto import KeyManager
from argus.core.db import Database, DocumentRepository, IdentityRepository, UrlRepository
from argus.core.models import IdentityType, VerificationStatus, hash_url
from argus.integration.search_adapters.base import SearchAdapter, SearchResult
from argus.orchestration.investigation import InvestigationManager


class DynamicMockAdapter(SearchAdapter):
    """Adapter whose search results can change between rescans."""

    def __init__(self):
        self.results: list[SearchResult] = [
            SearchResult(
                url="https://site.example/page1",
                title="Page 1",
                snippet="Initial Footprint",
                source_provider="dynamic",
            )
        ]

    @property
    def name(self) -> str:
        return "dynamic"

    async def search(self, query: str, max_results: int = 50) -> list[SearchResult]:
        return self.results


@pytest.fixture
async def test_env(tmp_path: Path):
    db = Database(":memory:", wal_mode=False)
    await db.connect()
    key_manager = KeyManager(KeyManager.generate_key())
    yield db, tmp_path, key_manager
    await db.disconnect()


@pytest.mark.asyncio
async def test_investigation_memory_rescan_detects_changes(test_env, httpx_mock: HTTPXMock):
    """
    Test Investigation Memory:
    1. Run 1 establishes initial documents and identities.
    2. Rescan checks existing sources: unchanged sources are recorded as unchanged,
       changed sources produce new document versions, and new sources are ingested.
    """
    db, storage_dir, key_manager = test_env
    adapter = DynamicMockAdapter()

    manager = InvestigationManager(
        db=db,
        storage_base_dir=storage_dir,
        key_manager=key_manager,
        search_adapters=[adapter],
        enable_live_probes=False,
    )

    inv = await manager.create_investigation(
        name="Memory Test Target",
        target_name="Subject Alpha",
        target_signals={"emails": ["alpha@sec.net"]},
    )

    # Initial page response
    httpx_mock.add_response(
        url="https://site.example/robots.txt",
        text="User-agent: *\nAllow: /",
        status_code=200,
        is_reusable=True,
    )
    httpx_mock.add_response(
        url="https://site.example/page1",
        text="<html><body><h1>Subject Alpha</h1><p>alpha@sec.net</p></body></html>",
        status_code=200,
    )

    # --- RUN 1 ---
    run1 = await manager.run_investigation(inv.id)
    assert run1.stats["docs_collected"] == 1

    id_repo = IdentityRepository(db)
    identities = await id_repo.list_by_investigation(inv.id)
    assert len(identities) >= 1
    assert identities[0].canonical_value == "Subject Alpha"

    # --- RESCAN 1: Content Unchanged ---
    httpx_mock.add_response(
        url="https://site.example/page1",
        text="<html><body><h1>Subject Alpha</h1><p>alpha@sec.net</p></body></html>",
        status_code=200,
    )

    rescan1_stats = await manager.rescan_investigation(inv.id)
    assert rescan1_stats["total_monitored_urls"] == 1
    assert rescan1_stats["unchanged_sources"] == 1
    assert rescan1_stats["changed_sources"] == 0

    # Verify source_check_log table recorded unchanged=0
    log_row = await db.fetch_one("SELECT * FROM source_check_log WHERE investigation_id = ?", (inv.id,))
    assert log_row is not None
    assert log_row["changed"] == 0

    # --- RESCAN 2: Content Changed & New Source Discovered ---
    # Add a new search result to adapter
    adapter.results.append(
        SearchResult(
            url="https://site.example/page2_new",
            title="Page 2 New Finding",
            snippet="Newly indexed article",
            source_provider="dynamic",
        )
    )

    # Content on page1 has changed
    httpx_mock.add_response(
        url="https://site.example/page1",
        text="<html><body><h1>Subject Alpha - UPDATED</h1><p>Promoted to Director</p></body></html>",
        status_code=200,
        is_reusable=True,
    )
    # Page2 response
    httpx_mock.add_response(
        url="https://site.example/page2_new",
        text="<html><body><h1>Article mentioning Subject Alpha</h1></body></html>",
        status_code=200,
        is_reusable=True,
    )

    rescan2_stats = await manager.rescan_investigation(inv.id)
    assert rescan2_stats["changed_sources"] == 1
    assert rescan2_stats["new_sources_discovered"] == 1

    # Verify latest document version points to previous version id
    doc_repo = DocumentRepository(db)
    url_repo = UrlRepository(db)
    u1 = await url_repo.get_by_hash(inv.id, hash_url("https://site.example/page1"))
    assert u1 is not None
    latest_doc = await doc_repo.get_latest_for_url(u1.id)
    assert latest_doc is not None
    assert latest_doc.previous_version_id is not None
    assert latest_doc.changed_since_last is True
