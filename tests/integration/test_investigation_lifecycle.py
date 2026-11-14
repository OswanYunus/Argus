"""Integration tests for investigation lifecycle, creation, execution, and purging."""

from __future__ import annotations

from pathlib import Path
import pytest
from pytest_httpx import HTTPXMock

from argus.core.crypto import KeyManager
from argus.core.db import Database, InvestigationRepository, RunRepository
from argus.core.models import InvestigationStatus, RunStatus
from argus.integration.search_adapters.base import SearchAdapter, SearchResult
from argus.orchestration.investigation import InvestigationManager


class MockAdapter(SearchAdapter):
    @property
    def name(self) -> str:
        return "mock"

    async def search(self, query: str, max_results: int = 50) -> list[SearchResult]:
        return [
            SearchResult(
                url="https://target.example/about",
                title="Target About",
                snippet="Software engineer Jane Doe",
                source_provider="mock",
            )
        ]


@pytest.fixture
async def test_env(tmp_path: Path):
    db = Database(":memory:", wal_mode=False)
    await db.connect()
    key_manager = KeyManager(KeyManager.generate_key())
    yield db, tmp_path, key_manager
    await db.disconnect()


@pytest.mark.asyncio
async def test_investigation_full_lifecycle_and_purge(test_env, httpx_mock: HTTPXMock):
    """Test full cycle: create -> run -> verify artifacts -> purge."""
    db, storage_dir, key_manager = test_env
    adapter = MockAdapter()

    manager = InvestigationManager(
        db=db,
        storage_base_dir=storage_dir,
        key_manager=key_manager,
        search_adapters=[adapter],
        enable_live_probes=False,
    )

    # 1. Create investigation
    inv = await manager.create_investigation(
        name="Lifecycle Target",
        target_name="Jane Doe",
        target_signals={"emails": ["jane@example.com"]},
    )
    assert inv.status == InvestigationStatus.CREATED

    # Mock HTTP response for document collection
    httpx_mock.add_response(
        url="https://target.example/robots.txt",
        text="User-agent: *\nAllow: /",
        status_code=200,
        is_reusable=True,
    )
    httpx_mock.add_response(
        url="https://target.example/about",
        text="<html><body><h1>Jane Doe</h1><p>Contact: jane@example.com</p></body></html>",
        headers={"content-type": "text/html; charset=utf-8"},
        status_code=200,
    )

    # 2. Run investigation
    run_result = await manager.run_investigation(inv.id)
    assert run_result.status == RunStatus.COMPLETED
    assert run_result.stats["urls_discovered"] == 1
    assert run_result.stats["docs_collected"] == 1

    # Verify encrypted storage folder created
    inv_dir = storage_dir / inv.id
    assert inv_dir.exists()

    # 3. Purge investigation
    await manager.purge_investigation(inv.id)

    # Verify filesystem files securely wiped
    assert not inv_dir.exists()

    # Verify DB records deleted
    inv_repo = InvestigationRepository(db)
    assert await inv_repo.get(inv.id) is None
