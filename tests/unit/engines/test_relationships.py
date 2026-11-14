"""Unit tests for the Relationship Discovery and Graph Engine."""

from __future__ import annotations

import pytest

from argus.core.db import Database, IdentityRepository, InvestigationRepository
from argus.core.models import (
    Identity,
    IdentityLink,
    IdentityType,
    Investigation,
    LinkType,
    QueryType,
    VerificationStatus,
)
from argus.engines.relationships import RelationshipEngine


@pytest.fixture
async def test_db():
    db = Database(":memory:", wal_mode=False)
    await db.connect()
    try:
        yield db
    finally:
        await db.disconnect()


@pytest.mark.asyncio
async def test_cytoscape_graph_export(test_db: Database):
    """Test graph construction and formatting into Cytoscape.js JSON elements."""
    engine = RelationshipEngine(test_db)
    inv_repo = InvestigationRepository(test_db)
    id_repo = IdentityRepository(test_db)

    inv = Investigation.create(name="Graph Test", target_name="Target")
    await inv_repo.create(inv)

    id1 = Identity.create(
        investigation_id=inv.id,
        identity_type=IdentityType.PERSON,
        canonical_value="Alice Smith",
        is_target=True,
        confidence=0.9,
        verification_status=VerificationStatus.VERIFIED,
    )
    id2 = Identity.create(
        investigation_id=inv.id,
        identity_type=IdentityType.USERNAME,
        canonical_value="asmith_dev",
        is_target=False,
        confidence=0.8,
        verification_status=VerificationStatus.LIKELY,
    )
    await id_repo.create(id1)
    await id_repo.create(id2)

    link = IdentityLink.create(
        investigation_id=inv.id,
        identity_a_id=id1.id,
        identity_b_id=id2.id,
        link_type=LinkType.ALIAS,
        confidence=0.85,
        evidence_summary="Verified cross-link",
    )
    await id_repo.create_link(link)

    elements = await engine.get_cytoscape_elements(inv.id)
    nodes = [e for e in elements if "target" not in e["data"]]
    edges = [e for e in elements if "target" in e["data"]]

    assert len(nodes) == 2
    assert len(edges) == 1
    assert edges[0]["data"]["label"] == "alias"
    assert edges[0]["data"]["confidence"] == 0.85


@pytest.mark.asyncio
async def test_lead_generation_recursion_and_cycle_prevention(test_db: Database):
    """
    Test that verified identities produce new search leads,
    prevent duplicates, and respect max recursion depth.
    """
    engine = RelationshipEngine(test_db)
    inv_repo = InvestigationRepository(test_db)
    id_repo = IdentityRepository(test_db)

    inv = Investigation.create(name="Leads Test", target_name="Target")
    await inv_repo.create(inv)

    # 1. Verified email identity
    id_verified = Identity.create(
        investigation_id=inv.id,
        identity_type=IdentityType.EMAIL,
        canonical_value="lead@target.org",
        confidence=0.9,
        verification_status=VerificationStatus.VERIFIED,
    )
    # 2. Unverified identity (should NOT generate search lead)
    id_unverified = Identity.create(
        investigation_id=inv.id,
        identity_type=IdentityType.USERNAME,
        canonical_value="random_user",
        confidence=0.3,
        verification_status=VerificationStatus.UNVERIFIED,
    )
    await id_repo.create(id_verified)
    await id_repo.create(id_unverified)

    # Depth 0 -> should produce lead for the verified email
    leads_d0 = await engine.extract_next_search_leads(
        inv, current_depth=0, max_recursion_depth=2
    )
    assert len(leads_d0) == 1
    assert leads_d0[0].query_type == QueryType.EMAIL
    assert '"lead@target.org"' in leads_d0[0].query_text
    assert leads_d0[0].depth_level == 1

    # Record lead in search_queries to simulate execution
    await test_db.execute(
        "INSERT INTO search_queries (id, investigation_id, query_text, query_type, provider, status) VALUES (?, ?, ?, ?, ?, ?)",
        ("q-1", inv.id, '"lead@target.org"', "email", "ddg", "completed"),
    )

    # Re-extracting at depth 0 should now be empty (cycle prevention)
    leads_recheck = await engine.extract_next_search_leads(
        inv, current_depth=0, max_recursion_depth=2
    )
    assert len(leads_recheck) == 0

    # At max depth, no leads generated
    leads_capped = await engine.extract_next_search_leads(
        inv, current_depth=2, max_recursion_depth=2
    )
    assert len(leads_capped) == 0
