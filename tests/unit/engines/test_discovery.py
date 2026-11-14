"""Unit tests for the ARGUS Discovery Engine."""

from __future__ import annotations

import pytest

from argus.core.db import Database, InvestigationRepository, UrlRepository
from argus.core.models import (
    Investigation,
    QueryType,
    SearchQuery,
    UrlStatus,
)
from argus.engines.discovery import DiscoveryEngine
from argus.integration.search_adapters.base import SearchAdapter, SearchResult


class MockSearchAdapter(SearchAdapter):
    """Deterministic mock adapter for unit testing discovery engine."""

    def __init__(self, name: str = "mock_provider") -> None:
        self._name = name

    @property
    def name(self) -> str:
        return self._name

    async def search(self, query: str, max_results: int = 50) -> list[SearchResult]:
        if "Alice" in query:
            return [
                SearchResult(
                    url="https://github.com/alice",
                    title="Alice on GitHub",
                    snippet="Security engineer profile",
                    source_provider=self.name,
                ),
                SearchResult(
                    url="https://alice.dev/about",
                    title="About Alice",
                    snippet="Personal tech blog",
                    source_provider=self.name,
                ),
            ]
        elif "alice@sec.org" in query:
            return [
                SearchResult(
                    url="https://alice.dev/about",  # duplicate URL across queries
                    title="About Alice - Contact",
                    snippet="Contact me at alice@sec.org",
                    source_provider=self.name,
                ),
                SearchResult(
                    url="https://alice.dev/contact",  # new unique URL
                    title="Contact Page",
                    snippet="Direct email",
                    source_provider=self.name,
                ),
            ]
        return []


@pytest.fixture
async def db_instance():
    db = Database(":memory:", wal_mode=False)
    await db.connect()
    try:
        yield db
    finally:
        await db.disconnect()


def test_generate_seed_queries(db_instance: Database):
    """Verify seed query expansion for various target signal types."""
    engine = DiscoveryEngine(db=db_instance, adapters=[MockSearchAdapter()])
    inv = Investigation.create(
        name="Target Scan",
        target_name="Alice Smith",
        target_signals={
            "emails": ["alice@sec.org"],
            "usernames": ["alice99"],
            "domains": ["alice.dev"],
        },
    )

    queries = engine.generate_seed_queries(inv)
    # 1 exact name + 1 email + 1 domain + 1 username + 4 targeted social dorks = 8 queries
    assert len(queries) == 8
    texts = [q.query_text for q in queries]
    types = [q.query_type for q in queries]

    assert '"Alice Smith"' in texts
    assert QueryType.EXACT_NAME in types
    assert '"alice@sec.org"' in texts
    assert QueryType.EMAIL in types
    assert "alice99" in texts
    assert QueryType.USERNAME in types
    assert any("site:instagram.com" in t for t in texts)
    assert any("site:tiktok.com" in t for t in texts)
    assert "site:alice.dev" in texts
    assert QueryType.DOMAIN in types


@pytest.mark.asyncio
async def test_execute_query_and_deduplicate(db_instance: Database):
    """Verify execution writes query record, stores discovered URLs, and handles deduplication."""
    adapter = MockSearchAdapter()
    engine = DiscoveryEngine(db=db_instance, adapters=[adapter])
    inv_repo = InvestigationRepository(db_instance)
    url_repo = UrlRepository(db_instance)

    inv = Investigation.create(name="Investigation", target_name="Alice")
    await inv_repo.create(inv)

    q = SearchQuery.create(
        investigation_id=inv.id,
        query_text='"Alice"',
        query_type=QueryType.EXACT_NAME,
        provider=adapter.name,
    )

    discovered = await engine.execute_query(q)
    assert len(discovered) == 2

    # Check search_queries row in DB
    q_row = await db_instance.fetch_one("SELECT * FROM search_queries WHERE id = ?", (q.id,))
    assert q_row is not None
    assert q_row["status"] == "completed"
    assert q_row["result_count"] == 2

    # Total in DB
    count = await url_repo.count_by_investigation(inv.id)
    assert count == 2

    # Execute second query returning one duplicate URL
    q2 = SearchQuery.create(
        investigation_id=inv.id,
        query_text='"alice@sec.org"',
        query_type=QueryType.EMAIL,
        provider=adapter.name,
    )
    discovered_2 = await engine.execute_query(q2)
    assert len(discovered_2) == 1

    # Total URLs in DB should be 3 (2 from q1 + 1 new from q2; duplicate ignored)
    count_after = await url_repo.count_by_investigation(inv.id)
    assert count_after == 3


@pytest.mark.asyncio
async def test_run_discovery_end_to_end(db_instance: Database):
    """Verify end-to-end multi-query discovery for an investigation."""
    adapter = MockSearchAdapter()
    engine = DiscoveryEngine(db=db_instance, adapters=[adapter])
    inv_repo = InvestigationRepository(db_instance)

    inv = Investigation.create(
        name="Auto Footprint",
        target_name="Alice",
        target_signals={"emails": ["alice@sec.org"]},
    )
    await inv_repo.create(inv)

    results = await engine.run_discovery(inv)
    assert len(results) >= 2
