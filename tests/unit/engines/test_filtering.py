"""Unit tests for the Filtering and Deduplication Engine."""

from __future__ import annotations

import pytest

from argus.core.db import Database, DocumentRepository, InvestigationRepository, UrlRepository
from argus.core.models import (
    CollectedDocument,
    DiscoveredUrl,
    Investigation,
    SourceType,
    UrlStatus,
)
from argus.engines.filtering import FilteringEngine


@pytest.fixture
async def test_db():
    db = Database(":memory:", wal_mode=False)
    await db.connect()
    try:
        yield db
    finally:
        await db.disconnect()


@pytest.mark.asyncio
async def test_filter_relevance_matching(test_db: Database):
    """Test target signal matching against document text."""
    engine = FilteringEngine(db=test_db, min_relevance_threshold=0.3)
    inv_repo = InvestigationRepository(test_db)
    url_repo = UrlRepository(test_db)
    doc_repo = DocumentRepository(test_db)

    inv = Investigation.create(
        name="Filter Test",
        target_name="Jane Doe",
        target_signals={"emails": ["jane@osint.io"], "usernames": ["jdoe_sec"]},
    )
    await inv_repo.create(inv)

    url_rec = DiscoveredUrl.create(
        investigation_id=inv.id,
        url="https://example.com/relevant",
        source_type=SourceType.SEARCH_RESULT,
    )
    await url_repo.create(url_rec)

    doc = CollectedDocument.create(
        investigation_id=inv.id,
        url_id=url_rec.id,
        content_hash="unique_hash_1",
        robots_compliant=True,
    )
    await doc_repo.create(doc)

    # Relevant text containing target name and email
    rel_text = "Jane Doe has published research. Contact via jane@osint.io"
    result = await engine.filter_document(doc, inv, rel_text)
    assert result.passed is True
    assert result.relevance_score >= 0.5
    assert "name:Jane Doe" in result.matched_signals
    assert "email:jane@osint.io" in result.matched_signals

    # Verify URL status updated to FILTERED
    updated_url = await url_repo.get(url_rec.id)
    assert updated_url.status == UrlStatus.FILTERED


@pytest.mark.asyncio
async def test_filter_rejects_irrelevant(test_db: Database):
    """Test rejection of pages with zero target signals."""
    engine = FilteringEngine(db=test_db, min_relevance_threshold=0.3)
    inv_repo = InvestigationRepository(test_db)
    url_repo = UrlRepository(test_db)
    doc_repo = DocumentRepository(test_db)

    inv = Investigation.create(
        name="Filter Test",
        target_name="Jane Doe",
        target_signals={"emails": ["jane@osint.io"]},
    )
    await inv_repo.create(inv)

    url_rec = DiscoveredUrl.create(
        investigation_id=inv.id,
        url="https://example.com/recipes",
        source_type=SourceType.SEARCH_RESULT,
    )
    await url_repo.create(url_rec)

    doc = CollectedDocument.create(
        investigation_id=inv.id,
        url_id=url_rec.id,
        content_hash="unique_hash_2",
        robots_compliant=True,
    )
    await doc_repo.create(doc)

    irrelevant_text = "Today we will bake classic chocolate chip cookies with organic butter."
    result = await engine.filter_document(doc, inv, irrelevant_text)
    assert result.passed is False
    assert result.relevance_score == 0.0
    assert "Low relevance score" in result.rejection_reason

    updated_url = await url_repo.get(url_rec.id)
    assert updated_url.status == UrlStatus.REJECTED
    assert updated_url.rejection_reason is not None


@pytest.mark.asyncio
async def test_filter_deduplicates_identical_content(test_db: Database):
    """Test rejection when content_hash matches an already indexed document."""
    engine = FilteringEngine(db=test_db)
    inv_repo = InvestigationRepository(test_db)
    url_repo = UrlRepository(test_db)
    doc_repo = DocumentRepository(test_db)

    inv = Investigation.create(name="Dedup Test", target_name="Target")
    await inv_repo.create(inv)

    # First doc
    u1 = DiscoveredUrl.create(
        investigation_id=inv.id,
        url="https://mirror1.example/page",
        source_type=SourceType.SEARCH_RESULT,
    )
    await url_repo.create(u1)
    d1 = CollectedDocument.create(
        investigation_id=inv.id,
        url_id=u1.id,
        content_hash="identical_hash_123",
        robots_compliant=True,
    )
    await doc_repo.create(d1)

    # Second doc with same content hash
    u2 = DiscoveredUrl.create(
        investigation_id=inv.id,
        url="https://mirror2.example/page",
        source_type=SourceType.SEARCH_RESULT,
    )
    await url_repo.create(u2)
    d2 = CollectedDocument.create(
        investigation_id=inv.id,
        url_id=u2.id,
        content_hash="identical_hash_123",
        robots_compliant=True,
    )
    # Don't save d2 to doc_repo yet, filtering checks before or during
    result = await engine.filter_document(d2, inv, "Sample text")
    assert result.passed is False
    assert "Duplicate content" in result.rejection_reason


@pytest.mark.asyncio
async def test_filter_accepts_social_profile_with_empty_extracted_text(test_db: Database):
    """Test that JS-rendered profiles (e.g. Instagram) pass filtering via URL/snippet even when body text is empty."""
    engine = FilteringEngine(db=test_db)
    inv_repo = InvestigationRepository(test_db)
    url_repo = UrlRepository(test_db)
    doc_repo = DocumentRepository(test_db)

    inv = Investigation.create(
        name="Target Username Only",
        target_name="_feliciakwame",
        target_signals={"usernames": ["_feliciakwame"]},
    )
    await inv_repo.create(inv)

    url_rec = DiscoveredUrl.create(
        investigation_id=inv.id,
        url="https://www.instagram.com/_feliciakwame/",
        title="(@_feliciakwame) • Instagram photos and videos",
        snippet="2,150 Followers, 520 Following, 8 Posts - @_feliciakwame on Instagram: Software engineer Ciao Milano",
        source_type=SourceType.SEARCH_RESULT,
    )
    await url_repo.create(url_rec)

    doc = CollectedDocument.create(
        investigation_id=inv.id,
        url_id=url_rec.id,
        content_hash="instagram_shell_hash",
        robots_compliant=True,
    )
    await doc_repo.create(doc)

    # Empty extracted text from JS shell
    result = await engine.filter_document(doc, inv, "")
    assert result.passed is True
    assert result.relevance_score >= 0.4
    assert "username:_feliciakwame" in result.matched_signals

