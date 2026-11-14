"""Investigation Lifecycle Manager and Rescan Memory Engine for ARGUS.

Coordinates end-to-end multi-stage OSINT scans, differential rescan with source
change detection, investigation memory, and secure cryptographic purging.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

from argus.core.crypto import DocumentEncryptor, KeyManager, SecurePurger
from argus.core.db import (
    Database,
    DocumentRepository,
    FindingRepository,
    IdentityRepository,
    InvestigationRepository,
    RunRepository,
    UrlRepository,
)
from argus.core.models import (
    CollectedDocument,
    DiscoveredUrl,
    Identity,
    IdentityLink,
    IdentityType,
    Investigation,
    InvestigationRun,
    InvestigationStatus,
    LinkType,
    PipelineTask,
    PipelineTaskType,
    QueryType,
    RunStatus,
    SearchQuery,
    SourceCheckLog,
    SourceType,
    UrlStatus,
    VerificationStatus,
    generate_id,
    hash_content,
    hash_url,
    utc_now,
)
from argus.engines.analysis import AnalysisEngine
from argus.engines.collection import CollectionEngine
from argus.engines.discovery import DiscoveryEngine
from argus.engines.domain_intel import DomainIntelligenceEngine
from argus.engines.entity_resolution import EntityResolutionEngine
from argus.engines.filtering import FilteringEngine
from argus.engines.platform_probes import PlatformProbeEngine
from argus.engines.relationships import RelationshipEngine
from argus.integration.llm.base import LLMClientProtocol
from argus.integration.search_adapters.base import SearchAdapter
from argus.orchestration.pipeline import PipelineBudget, PipelineOrchestrator

logger = logging.getLogger("argus.orchestration.investigation")


class InvestigationManager:
    """Manages the full lifecycle of an OSINT investigation including incremental memory."""

    def __init__(
        self,
        db: Database,
        storage_base_dir: Path | str,
        key_manager: Optional[KeyManager] = None,
        llm_client: Optional[LLMClientProtocol] = None,
        search_adapters: Optional[list[SearchAdapter]] = None,
        enable_live_probes: bool = True,
    ) -> None:
        self.db = db
        self.storage_base_dir = Path(storage_base_dir)
        self.key_manager = key_manager or KeyManager()
        self.encryptor = DocumentEncryptor(self.key_manager)
        self.purger = SecurePurger(self.key_manager)
        self.enable_live_probes = enable_live_probes

        self.inv_repo = InvestigationRepository(db)
        self.url_repo = UrlRepository(db)
        self.doc_repo = DocumentRepository(db)
        self.run_repo = RunRepository(db)
        self.id_repo = IdentityRepository(db)
        self.finding_repo = FindingRepository(db)

        # Initialize engines
        self.discovery = DiscoveryEngine(db, adapters=search_adapters)
        self.probes = PlatformProbeEngine(concurrency=10)
        self.domain_intel = DomainIntelligenceEngine()
        self.collection = CollectionEngine(db, storage_base_dir, encryptor=self.encryptor)
        self.filtering = FilteringEngine(db)
        self.entity_resolution = EntityResolutionEngine(db)
        self.relationships = RelationshipEngine(db)
        self.analysis = AnalysisEngine(db, llm_client) if llm_client else None

    async def create_investigation(
        self,
        name: Optional[str] = None,
        target_name: Optional[str] = None,
        description: str = "",
        target_signals: Optional[dict[str, Any]] = None,
        config: Optional[dict[str, Any]] = None,
    ) -> Investigation:
        """Create a new authorized investigation with isolated encryption key and auto-resolved metadata."""
        signals = target_signals or {}
        raw_usernames = signals.get("usernames", [])
        if isinstance(raw_usernames, str):
            raw_usernames = [raw_usernames]
        raw_emails = signals.get("emails", [])
        if isinstance(raw_emails, str):
            raw_emails = [raw_emails]
        raw_domains = signals.get("domains", [])
        if isinstance(raw_domains, str):
            raw_domains = [raw_domains]
        raw_profiles = signals.get("profile_urls", [])
        if isinstance(raw_profiles, str):
            raw_profiles = [raw_profiles]

        # Auto-resolve target_name if unknown
        final_target_name = (target_name or "").strip()
        if not final_target_name:
            if raw_usernames:
                final_target_name = f"@{raw_usernames[0]}"
            elif raw_emails:
                final_target_name = raw_emails[0].split("@")[0]
            elif raw_domains:
                final_target_name = raw_domains[0]
            elif raw_profiles:
                final_target_name = raw_profiles[0].split("/")[-1] or "Target Asset"
            else:
                final_target_name = "Subject " + generate_id()[:6]

        # Auto-resolve investigation title/name if omitted
        final_name = (name or "").strip()
        if not final_name:
            if target_name and target_name.strip():
                final_name = f"Investigation: {target_name.strip()}"
            elif raw_usernames:
                final_name = f"Footprint @{raw_usernames[0]}"
            elif raw_emails:
                final_name = f"Audit: {raw_emails[0]}"
            elif raw_domains:
                final_name = f"Domain Intel: {raw_domains[0]}"
            else:
                final_name = f"Case #{generate_id()[:8]}"

        inv = Investigation.create(
            name=final_name,
            target_name=final_target_name,
            description=description,
            target_signals=signals,
            config=config or {},
            encryption_key_id=generate_id(),
            status=InvestigationStatus.CREATED,
        )
        await self.inv_repo.create(inv)
        return inv

    async def run_investigation(
        self,
        investigation_id: str,
        max_recursion_depth: int = 1,
        max_results_per_query: int = 10,
    ) -> InvestigationRun:
        """
        Execute an end-to-end OSINT investigation run across all pipeline stages.
        """
        inv = await self.inv_repo.get(investigation_id)
        if not inv:
            raise ValueError(f"Investigation {investigation_id} not found")

        await self.inv_repo.update_status(inv.id, InvestigationStatus.RUNNING)

        # Determine run number
        latest_run = await self.run_repo.get_latest(inv.id)
        run_number = (latest_run.run_number + 1) if latest_run else 1

        run = InvestigationRun.create(
            investigation_id=inv.id,
            run_number=run_number,
            status=RunStatus.RUNNING,
            config_snapshot=inv.config,
        )
        await self.run_repo.create(run)

        # Initialize pipeline queue
        pipeline = PipelineOrchestrator(self.db, max_concurrency=5)

        stats = {
            "queries_executed": 0,
            "urls_discovered": 0,
            "docs_collected": 0,
            "docs_filtered": 0,
            "identities_resolved": 0,
            "findings_count": 0,
        }

        try:
            # Stage 1: Deterministic Platform Probes & Domain Intel (Zero-Indexing Proof)
            signals = inv.target_signals or {}
            usernames = signals.get("usernames", [])
            if isinstance(usernames, str):
                usernames = [usernames]
            emails = signals.get("emails", [])
            if isinstance(emails, str):
                emails = [emails]
            domains = signals.get("domains", [])
            if isinstance(domains, str):
                domains = [domains]

            probe_urls: list[DiscoveredUrl] = []
            if self.enable_live_probes and (usernames or emails):
                findings = await self.probes.run_probes(usernames=usernames, emails=emails)
                for f in findings:
                    from argus.core.models import hash_url
                    u_hash = hash_url(f.profile_url)
                    existing = await self.url_repo.get_by_hash(inv.id, u_hash)
                    if not existing:
                        p_model = DiscoveredUrl.create(
                            investigation_id=inv.id,
                            url=f.profile_url,
                            source_type=SourceType.DIRECT_SEED,
                            title=f"Verified Platform Asset: {f.platform_name} ({f.username})",
                            snippet=f.raw_evidence,
                            relevance_score=f.confidence,
                            status=UrlStatus.PENDING,
                        )
                        created_url = await self.url_repo.create(p_model)
                        probe_urls.append(created_url)
                    else:
                        probe_urls.append(existing)

                # Register target Instagram profile
                for u in usernames:
                    clean_u = u.strip().lstrip("@")
                    if not clean_u:
                        continue
                    ig_url = f"https://www.instagram.com/{clean_u}/"
                    from argus.core.models import hash_url
                    u_hash = hash_url(ig_url)
                    existing = await self.url_repo.get_by_hash(inv.id, u_hash)
                    if not existing:
                        p_model = DiscoveredUrl.create(
                            investigation_id=inv.id,
                            url=ig_url,
                            source_type=SourceType.DIRECT_SEED,
                            title=f"Instagram Profile: @{clean_u}",
                            snippet=f"Instagram target profile: @{clean_u}",
                            relevance_score=0.95,
                            status=UrlStatus.COLLECTED,
                        )
                        created_url = await self.url_repo.create(p_model)
                        probe_urls.append(created_url)
                    else:
                        probe_urls.append(existing)

            # Stage 1b: Domain & DNS Infrastructure Resolution
            if self.enable_live_probes and domains:
                for dom in domains:
                    d_report = await self.domain_intel.analyze_domain(dom)
                    if d_report.is_resolvable:
                        from argus.core.models import hash_url
                        d_url = f"https://{d_report.domain}"
                        u_hash = hash_url(d_url)
                        existing = await self.url_repo.get_by_hash(inv.id, u_hash)
                        evidence_str = (
                            f"Domain {d_report.domain}: IPs={d_report.ip_addresses}, "
                            f"MX={d_report.mail_servers}, SPF={d_report.spf_record}"
                        )
                        if not existing:
                            d_model = DiscoveredUrl.create(
                                investigation_id=inv.id,
                                url=d_url,
                                source_type=SourceType.DIRECT_SEED,
                                title=f"Resolved Domain Asset: {d_report.domain}",
                                snippet=evidence_str,
                                relevance_score=0.95,
                                status=UrlStatus.PENDING,
                            )
                            created_d = await self.url_repo.create(d_model)
                            probe_urls.append(created_d)
                        else:
                            probe_urls.append(existing)

            # Stage 2: Broad Search Engine Discovery
            discovered_urls = await self.discovery.run_discovery(
                inv, max_results_per_query=max_results_per_query
            )
            # Combine direct platform hits with search hits
            all_discovered_urls = probe_urls + discovered_urls
            stats["urls_discovered"] = len(all_discovered_urls)

            # Stage 3: Collection
            collected_docs: list[CollectedDocument] = []
            for url_rec in all_discovered_urls:
                doc = await self.collection.collect_url(url_rec)
                if doc:
                    collected_docs.append(doc)
            stats["docs_collected"] = len(collected_docs)

            # Stage 3: Filtering & Signal Resolution
            filtered_docs: list[CollectedDocument] = []
            for doc in collected_docs:
                url_rec = await self.url_repo.get(doc.url_id)
                if not url_rec:
                    continue

                # Read and decrypt document to get text
                if doc.encrypted_path:
                    raw_bytes = self.encryptor.decrypt_document(Path(doc.encrypted_path), inv.id)
                    extracted = self.collection.extract_text(raw_bytes, doc.content_type or "")
                    filter_res = await self.filtering.filter_document(doc, inv, extracted.text)

                    if filter_res.passed:
                        filtered_docs.append(doc)

                        # Stage 4: Entity Resolution
                        signals = self.entity_resolution.extract_signals_from_text(
                            extracted.text, url_rec.url, doc.id
                        )
                        if signals:
                            await self.entity_resolution.resolve_target_identity(inv, signals)
                            stats["identities_resolved"] += 1

                        # Stage 5: Intelligence Analysis (if LLM client configured)
                        if self.analysis:
                            findings = await self.analysis.analyze_document(
                                investigation=inv,
                                document=doc,
                                source_url=url_rec.url,
                                document_text=extracted.text,
                                run_id=run.id,
                            )
                            stats["findings_count"] += len(findings)

            stats["docs_filtered"] = len(filtered_docs)

            # Update run completion
            await self.run_repo.update_status_and_stats(
                run.id, status=RunStatus.COMPLETED, stats=stats
            )
            await self.inv_repo.update_status(inv.id, InvestigationStatus.COMPLETED)

        except Exception as exc:
            logger.error("Investigation run %s failed: %s", run.id, exc)
            await self.run_repo.update_status_and_stats(
                run.id, status=RunStatus.FAILED, stats={"error": str(exc)}
            )
            await self.inv_repo.update_status(inv.id, InvestigationStatus.PAUSED)
            raise

        return await self.run_repo.get(run.id) or run

    async def rescan_investigation(
        self,
        investigation_id: str,
        max_results_per_query: int = 10,
    ) -> dict[str, Any]:
        """
        Investigation Memory: Incremental rescan that only re-processes changed documents,
        detects newly indexed sources, and preserves established identities.
        """
        inv = await self.inv_repo.get(investigation_id)
        if not inv:
            raise ValueError(f"Investigation {investigation_id} not found")

        latest_run = await self.run_repo.get_latest(inv.id)
        next_run_number = (latest_run.run_number + 1) if latest_run else 1

        run = InvestigationRun.create(
            investigation_id=inv.id,
            run_number=next_run_number,
            status=RunStatus.RUNNING,
            config_snapshot=inv.config,
        )
        await self.run_repo.create(run)

        # 1. Check all previously collected and filtered URLs for changes (Conditional GET / hash check)
        url_rows = await self.db.fetch_all(
            "SELECT * FROM discovered_urls WHERE investigation_id = ? AND status IN ('collected', 'filtered')",
            (inv.id,),
        )
        all_urls = [self.url_repo._to_model(r) for r in url_rows]
        changed_urls: list[DiscoveredUrl] = []
        unchanged_urls: list[DiscoveredUrl] = []

        for url_rec in all_urls:
            prev_doc = await self.doc_repo.get_latest_for_url(url_rec.id)
            if not prev_doc:
                continue

            resp = await self.collection.http_client.fetch(url_rec.url)
            if not resp.is_success:
                continue

            new_hash = hash_content(resp.content)
            changed = new_hash != prev_doc.content_hash

            # Log to source_check_log table
            check_log_id = generate_id()
            now_iso = utc_now().isoformat()
            await self.db.execute(
                """
                INSERT INTO source_check_log (
                    id, investigation_id, run_id, url_id,
                    previous_content_hash, new_content_hash, changed, checked_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    check_log_id,
                    inv.id,
                    run.id,
                    url_rec.id,
                    prev_doc.content_hash,
                    new_hash,
                    1 if changed else 0,
                    now_iso,
                ),
            )

            if changed:
                changed_urls.append(url_rec)
                # Re-collect the updated version
                await self.collection.collect_url(url_rec)
            else:
                unchanged_urls.append(url_rec)

        # 2. Discover brand-new URLs
        new_urls = await self.discovery.run_discovery(
            inv, max_results_per_query=max_results_per_query
        )
        brand_new_docs = []
        for u in new_urls:
            doc = await self.collection.collect_url(u)
            if doc:
                brand_new_docs.append(doc)

        rescan_stats = {
            "total_monitored_urls": len(all_urls),
            "unchanged_sources": len(unchanged_urls),
            "changed_sources": len(changed_urls),
            "new_sources_discovered": len(brand_new_docs),
        }

        await self.run_repo.update_status_and_stats(
            run.id, status=RunStatus.COMPLETED, stats=rescan_stats
        )
        return rescan_stats

    async def pivot_investigation(
        self,
        investigation_id: str,
        pivot_username: str,
        rationale: str = "Pivoted from discovered alias/past username",
    ) -> dict[str, Any]:
        """
        Execute an alias pivot investigation on a specific username/alias across
        all direct platforms and discovery search engines, linking findings to the
        parent investigation.
        """
        inv = await self.inv_repo.get(investigation_id)
        if not inv:
            raise ValueError(f"Investigation {investigation_id} not found")

        clean_user = pivot_username.strip().lstrip("@")
        if not clean_user:
            raise ValueError("Invalid username for pivot")

        # 1. Run direct platform probes for the new username
        probe_findings = await self.probes.run_probes(usernames=[clean_user])
        new_urls: list[DiscoveredUrl] = []
        for f in probe_findings:
            u_hash = hash_url(f.profile_url)
            existing = await self.url_repo.get_by_hash(inv.id, u_hash)
            if not existing:
                p_model = DiscoveredUrl.create(
                    investigation_id=inv.id,
                    url=f.profile_url,
                    source_type=SourceType.DIRECT_SEED,
                    title=f"Pivoted Asset: {f.platform_name} ({f.username})",
                    snippet=f"{f.raw_evidence} | Reason: {rationale}",
                    relevance_score=f.confidence,
                    status=UrlStatus.PENDING,
                )
                created_url = await self.url_repo.create(p_model)
                new_urls.append(created_url)
            else:
                new_urls.append(existing)

        # Register pivoted Instagram profile
        ig_url = f"https://www.instagram.com/{clean_user}/"
        u_hash = hash_url(ig_url)
        existing = await self.url_repo.get_by_hash(inv.id, u_hash)
        if not existing:
            p_model = DiscoveredUrl.create(
                investigation_id=inv.id,
                url=ig_url,
                source_type=SourceType.DIRECT_SEED,
                title=f"Instagram Profile: @{clean_user}",
                snippet=f"Pivoted Instagram profile: @{clean_user} | {rationale}",
                relevance_score=0.95,
                status=UrlStatus.COLLECTED,
            )
            created_url = await self.url_repo.create(p_model)
            new_urls.append(created_url)
        else:
            new_urls.append(existing)

        # 2. Run targeted search queries for the pivot username
        queries = [
            SearchQuery.create(
                investigation_id=inv.id,
                query_text=clean_user,
                query_type=QueryType.USERNAME,
                provider=self.discovery.adapters[0].name,
                depth_level=1,
            )
        ]
        for social_dork in [
            f'site:instagram.com "{clean_user}"',
            f'site:tiktok.com "@{clean_user}"',
            f'site:snapchat.com/add "{clean_user}"',
            f'site:pinterest.com "{clean_user}"',
            f'site:strava.com/athletes "{clean_user}"',
        ]:
            queries.append(
                SearchQuery.create(
                    investigation_id=inv.id,
                    query_text=social_dork,
                    query_type=QueryType.FREETEXT,
                    provider=self.discovery.adapters[0].name,
                    depth_level=1,
                )
            )

        for q in queries:
            try:
                discovered = await self.discovery.execute_query(q, max_results=10)
                new_urls.extend(discovered)
            except Exception as e:
                logger.warning("Pivot query error for '%s': %s", q.query_text, e)

        # 3. Collect, Filter & Entity Resolve the new URLs
        collected_docs: list[CollectedDocument] = []
        for url_rec in new_urls:
            doc = await self.collection.collect_url(url_rec)
            if doc:
                collected_docs.append(doc)

        filtered_docs = []
        for doc in collected_docs:
            url_rec = await self.url_repo.get(doc.url_id)
            if not url_rec:
                continue
            if doc.encrypted_path:
                raw_bytes = self.encryptor.decrypt_document(Path(doc.encrypted_path), inv.id)
                extracted = self.collection.extract_text(raw_bytes, doc.content_type or "")
                filter_res = await self.filtering.filter_document(doc, inv, extracted.text)
                if filter_res.passed:
                    filtered_docs.append(doc)
                    signals = self.entity_resolution.extract_signals_from_text(
                        extracted.text, url_rec.url, doc.id
                    )
                    if signals:
                        await self.entity_resolution.resolve_target_identity(inv, signals)

        # Record alias identity & relationship link
        alias_ident = Identity.create(
            investigation_id=inv.id,
            identity_type=IdentityType.USERNAME,
            canonical_value=clean_user,
            display_name=f"@{clean_user}",
            is_target=False,
            confidence=0.85,
            confidence_explanation=f"Pivoted alias: {rationale}",
            verification_status=VerificationStatus.LIKELY,
        )
        await self.identity_repo.create(alias_ident)

        # Link to target identity
        all_idents = await self.identity_repo.list_by_investigation(inv.id)
        target_ident = next((i for i in all_idents if i.is_target), None)
        if target_ident:
            link = IdentityLink.create(
                investigation_id=inv.id,
                identity_a_id=target_ident.id,
                identity_b_id=alias_ident.id,
                link_type=LinkType.ALIAS,
                confidence=0.80,
                evidence_summary=rationale,
            )
            await self.identity_repo.create_link(link)

        return {
            "pivoted_username": clean_user,
            "urls_discovered": len(new_urls),
            "docs_collected": len(collected_docs),
            "alias_identity_id": alias_ident.id,
        }

    async def purge_investigation(self, investigation_id: str) -> None:
        """Securely wipe all encrypted files and delete database records."""
        # Wipe encrypted blobs on filesystem
        self.purger.purge_investigation_files(investigation_id, self.storage_base_dir)

        # Cascade hard delete database records
        await self.inv_repo.hard_delete(investigation_id)
        logger.info("Investigation %s completely purged.", investigation_id)
