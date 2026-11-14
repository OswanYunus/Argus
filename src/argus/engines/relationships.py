"""Relationship Discovery and Graph Engine for ARGUS OSINT Intelligence Platform.

Constructs directed and undirected relationship graphs using NetworkX, manages lead generation
with bounded recursion and circularity prevention, and formats graph data for Cytoscape.js.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

import networkx as nx

from argus.core.db import Database, IdentityRepository
from argus.core.models import (
    Direction,
    Identity,
    IdentityLink,
    Investigation,
    LinkType,
    QueryType,
    Relationship,
    SearchQuery,
    VerificationStatus,
)

logger = logging.getLogger("argus.engine.relationships")


@dataclass(frozen=True)
class SearchLead:
    """A newly discovered search lead to expand the investigation."""

    query_text: str
    query_type: QueryType
    parent_source_id: str
    depth_level: int
    rationale: str


class RelationshipEngine:
    """Discovers relationships, builds knowledge graphs, and extracts bounded discovery leads."""

    def __init__(self, db: Database) -> None:
        self.db = db
        self.identity_repo = IdentityRepository(db)

    async def build_networkx_graph(self, investigation_id: str) -> nx.DiGraph:
        """Construct a NetworkX directed graph from identities, links, and relationships."""
        graph = nx.DiGraph()

        # Add identity nodes
        identities = await self.identity_repo.list_by_investigation(investigation_id)
        for ident in identities:
            graph.add_node(
                ident.id,
                label=ident.display_name or ident.canonical_value,
                canonical_value=ident.canonical_value,
                identity_type=ident.identity_type.value,
                confidence=ident.confidence,
                verification_status=ident.verification_status.value,
                is_target=ident.is_target,
            )

        # Add identity link edges
        links = await self.identity_repo.get_links(investigation_id)
        for link in links:
            graph.add_edge(
                link.identity_a_id,
                link.identity_b_id,
                link_type=link.link_type.value,
                confidence=link.confidence,
                evidence=link.evidence_summary or "",
            )

        # Add explicit relationships from table
        rows = await self.db.fetch_all(
            "SELECT * FROM relationships WHERE investigation_id = ?", (investigation_id,)
        )
        for r in rows:
            graph.add_edge(
                r["source_identity_id"],
                r["target_identity_id"],
                relationship_type=r["relationship_type"],
                direction=r["direction"],
                confidence=r["confidence"],
                evidence=r["evidence_summary"] or "",
            )

        return graph

    async def get_cytoscape_elements(self, investigation_id: str) -> list[dict[str, Any]]:
        """Export graph elements formatted for direct Cytoscape.js visualization."""
        graph = await self.build_networkx_graph(investigation_id)
        elements: list[dict[str, Any]] = []

        # Nodes
        for node_id, data in graph.nodes(data=True):
            elements.append(
                {
                    "data": {
                        "id": node_id,
                        "label": data.get("label", node_id),
                        "type": data.get("identity_type", "unknown"),
                        "confidence": data.get("confidence", 0.0),
                        "status": data.get("verification_status", "unverified"),
                        "isTarget": data.get("is_target", False),
                    }
                }
            )

        # Edges
        edge_idx = 0
        for source, target, data in graph.edges(data=True):
            edge_idx += 1
            elements.append(
                {
                    "data": {
                        "id": f"edge_{edge_idx}",
                        "source": source,
                        "target": target,
                        "label": data.get("relationship_type") or data.get("link_type", "related"),
                        "confidence": data.get("confidence", 1.0),
                    }
                }
            )

        return elements

    async def extract_next_search_leads(
        self,
        investigation: Investigation,
        current_depth: int,
        max_recursion_depth: int = 2,
    ) -> list[SearchLead]:
        """
        Derive new search queries from verified/likely identities without creating circular loops.
        """
        if current_depth >= max_recursion_depth:
            logger.info("Recursion budget reached (depth %d >= %d)", current_depth, max_recursion_depth)
            return []

        # Find existing executed queries to prevent repetition
        rows = await self.db.fetch_all(
            "SELECT query_text FROM search_queries WHERE investigation_id = ?",
            (investigation.id,),
        )
        executed_queries = {r["query_text"].lower().strip() for r in rows}

        identities = await self.identity_repo.list_by_investigation(investigation.id)
        leads: list[SearchLead] = []

        for ident in identities:
            # Only expand leads from verified or likely identities
            if ident.verification_status not in (
                VerificationStatus.VERIFIED,
                VerificationStatus.LIKELY,
            ):
                continue

            query_text = ident.canonical_value.strip()
            if not query_text or query_text.lower() in executed_queries:
                continue

            # Determine appropriate query type
            qtype = QueryType.EXACT_NAME
            if "@" in query_text:
                qtype = QueryType.EMAIL
                query_text = f'"{query_text}"'
            elif ident.identity_type.value == "username":
                qtype = QueryType.USERNAME
            elif "." in query_text and " " not in query_text:
                qtype = QueryType.DOMAIN
                query_text = f"site:{query_text}"
            else:
                query_text = f'"{query_text}"'

            if query_text.lower() in executed_queries:
                continue

            leads.append(
                SearchLead(
                    query_text=query_text,
                    query_type=qtype,
                    parent_source_id=ident.id,
                    depth_level=current_depth + 1,
                    rationale=f"Recursive lead derived from {ident.verification_status.value} identity '{ident.canonical_value}'",
                )
            )
            executed_queries.add(query_text.lower())

        return leads
