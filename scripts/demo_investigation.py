"""Interactive CLI demonstration of ARGUS OSINT Engine showing full lifecycle & Investigation Memory."""

import asyncio
import os
import sys
from pathlib import Path

# Add src to pythonpath
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir / "src"))

from argus.core.crypto import KeyManager
from argus.core.db import close_db, init_db, InvestigationRepository, IdentityRepository, FindingRepository, UrlRepository
from argus.orchestration.investigation import InvestigationManager
from argus.integration.search_adapters.base import SearchAdapter, SearchResult


class DemoSearchAdapter(SearchAdapter):
    """Simulated search provider for the demonstration."""

    def __init__(self):
        self.step = 1

    @property
    def name(self) -> str:
        return "demo_provider"

    async def search(self, query: str, max_results: int = 50) -> list[SearchResult]:
        if self.step == 1:
            return [
                SearchResult(
                    url="https://github.com/alex-river",
                    title="alex-river (Alex River) · GitHub",
                    snippet="Cybersecurity researcher. Contact: alex.river@sec.org. Website: https://ariver.dev",
                    source_provider=self.name,
                ),
                SearchResult(
                    url="https://ariver.dev/about",
                    title="About Alex River - Systems & Research",
                    snippet="Personal technical portfolio. Authored papers on embedded network analysis.",
                    source_provider=self.name,
                ),
            ]
        else:
            # Rescan discovers a newly indexed paper
            return [
                SearchResult(
                    url="https://github.com/alex-river",
                    title="alex-river (Alex River) · GitHub",
                    snippet="Cybersecurity researcher. Contact: alex.river@sec.org. Website: https://ariver.dev",
                    source_provider=self.name,
                ),
                SearchResult(
                    url="https://research-archive.example/paper-2026",
                    title="Analysis of Distributed Footprints by Alex River",
                    snippet="New conference paper published by Alex River and colleagues.",
                    source_provider=self.name,
                ),
            ]


async def run_demo():
    print("\n" + "=" * 70)
    print("   ARGUS OSINT Intelligence Engine — Full Pipeline & Memory Demo")
    print("=" * 70 + "\n")

    db_path = root_dir / "data" / "demo.db"
    storage_dir = root_dir / "data" / "investigations"
    db = await init_db(db_path, wal_mode=False)

    adapter = DemoSearchAdapter()
    manager = InvestigationManager(
        db=db,
        storage_base_dir=storage_dir,
        search_adapters=[adapter],
    )

    # 1. Create Target
    print("[1] Initializing Target Investigation...")
    inv = await manager.create_investigation(
        name="Self Digital-Footprint Audit",
        target_name="Alex River",
        description="Authorized audit of public footprint across developer networks and sites.",
        target_signals={
            "emails": ["alex.river@sec.org"],
            "usernames": ["alex-river"],
            "domains": ["ariver.dev"],
        },
    )
    print(f"    Target initialized: ID={inv.id}, Target='{inv.target_name}'")

    # 2. Run Investigation (Run 1)
    print("\n[2] Executing Initial Investigation Run (Run #1)...")
    print("    - Query expansion (exact name, emails, usernames, domains)")
    print("    - Discovery & URL deduplication")
    print("    - Multi-signal entity resolution & attribution corroboration")
    print("    - Evidence encryption at rest")

    run1 = await manager.run_investigation(inv.id)
    print(f"    ✓ Run #1 Status: {run1.status.value.upper()}")
    print(f"    ✓ Statistics: {run1.stats}")

    id_repo = IdentityRepository(db)
    identities = await id_repo.list_by_investigation(inv.id)
    print(f"\n[3] Entity Resolution Assessment ({len(identities)} identities resolved):")
    for ident in identities:
        print(f"    - Identity: '{ident.canonical_value}' ({ident.identity_type.value})")
        print(f"      Verification Status: {ident.verification_status.value.upper()} (Confidence: {ident.confidence * 100:.0f}%)")
        print(f"      Explanation: {ident.confidence_explanation}")

    # 3. Demonstrate Investigation Memory (Rescan / Run 2)
    print("\n[4] Simulating Time Elapsed: Executing Monthly Rescan (Investigation Memory)...")
    print("    The platform does NOT re-process from zero.")
    print("    - Checks previously collected documents for content changes")
    print("    - Queries search providers for newly indexed public references")

    adapter.step = 2  # Introduce a newly indexed document
    rescan_stats = await manager.rescan_investigation(inv.id)
    print(f"    ✓ Rescan Complete!")
    print(f"    ✓ Monitored existing sources: {rescan_stats['total_monitored_urls']}")
    print(f"    ✓ Unchanged sources (re-processing skipped): {rescan_stats['unchanged_sources']}")
    print(f"    ✓ Newly indexed sources discovered: {rescan_stats['new_sources_discovered']}")

    # 4. Check Relationship Graph
    elements = await manager.relationships.get_cytoscape_elements(inv.id)
    print(f"\n[5] Relationship Knowledge Graph:")
    print(f"    ✓ Nodes: {len([e for e in elements if 'target' not in e['data']])}")
    print(f"    ✓ Edges: {len([e for e in elements if 'target' in e['data']])}")

    await close_db()
    print("\n" + "=" * 70)
    print("   Demo Complete! Launch dashboard: python scripts/run_server.py")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    asyncio.run(run_demo())
