"""Discovery Engine for ARGUS OSINT Intelligence Platform.

Coordinates search adapters to query public search engines, maps target signals
into targeted search syntax, deduplicates discovered URLs, and records query provenance.
"""

from __future__ import annotations

import logging
from typing import Optional, Sequence

from argus.core.db import Database, UrlRepository
from argus.core.models import (
    DiscoveredUrl,
    Investigation,
    QueryType,
    SearchQuery,
    SourceType,
    TaskStatus,
    UrlStatus,
    generate_id,
    utc_now,
)
from argus.integration.search_adapters.base import SearchAdapter, SearchResult
from argus.integration.search_adapters.duckduckgo import DuckDuckGoAdapter

logger = logging.getLogger("argus.engine.discovery")


class DiscoveryEngine:
    """Orchestrates search adapters to discover target footprint across the web."""

    def __init__(
        self,
        db: Database,
        adapters: Optional[Sequence[SearchAdapter]] = None,
    ) -> None:
        self.db = db
        self.url_repo = UrlRepository(db)
        self.adapters = list(adapters) if adapters is not None else [DuckDuckGoAdapter()]

    def generate_seed_queries(
        self,
        investigation: Investigation,
        depth_level: int = 0,
    ) -> list[SearchQuery]:
        """Generate structured initial search queries from the investigation's target signals."""
        queries: list[SearchQuery] = []
        inv_id = investigation.id

        # 1. Target Name (Exact match)
        if investigation.target_name:
            queries.append(
                SearchQuery.create(
                    investigation_id=inv_id,
                    query_text=SearchAdapter.format_query(
                        QueryType.EXACT_NAME, investigation.target_name
                    ),
                    query_type=QueryType.EXACT_NAME,
                    provider=self.adapters[0].name,
                    depth_level=depth_level,
                )
            )

        # 2. Extract signals: emails, usernames, domains, profiles
        signals = investigation.target_signals or {}

        # Emails
        emails = signals.get("emails", [])
        if isinstance(emails, str):
            emails = [emails]
        for email in emails:
            queries.append(
                SearchQuery.create(
                    investigation_id=inv_id,
                    query_text=SearchAdapter.format_query(QueryType.EMAIL, email),
                    query_type=QueryType.EMAIL,
                    provider=self.adapters[0].name,
                    depth_level=depth_level,
                )
            )

        # Usernames
        usernames = signals.get("usernames", [])
        if isinstance(usernames, str):
            usernames = [usernames]
        for uname in usernames:
            queries.append(
                SearchQuery.create(
                    investigation_id=inv_id,
                    query_text=uname,
                    query_type=QueryType.USERNAME,
                    provider=self.adapters[0].name,
                    depth_level=depth_level,
                )
            )
            # Targeted social profile queries (Instagram, TikTok, Strava, Pinterest, Snapchat, Spotify, LinkedIn, X)
            for social_dork in [
                f'site:instagram.com "{uname}"',
                f'site:tiktok.com "@{uname}"',
                f'site:linkedin.com/in/ "{uname}"',
                f'site:x.com "{uname}"',
                f'site:strava.com/athletes "{uname}"',
                f'site:pinterest.com "{uname}"',
                f'site:snapchat.com/add "{uname}"',
                f'site:open.spotify.com/user "{uname}"',
            ]:
                queries.append(
                    SearchQuery.create(
                        investigation_id=inv_id,
                        query_text=social_dork,
                        query_type=QueryType.FREETEXT,
                        provider=self.adapters[0].name,
                        depth_level=depth_level,
                    )
                )

        # Domains
        domains = signals.get("domains", [])
        if isinstance(domains, str):
            domains = [domains]
        for dom in domains:
            queries.append(
                SearchQuery.create(
                    investigation_id=inv_id,
                    query_text=SearchAdapter.format_query(QueryType.DOMAIN, dom),
                    query_type=QueryType.DOMAIN,
                    provider=self.adapters[0].name,
                    depth_level=depth_level,
                )
            )

        # Profile URLs (direct seeds)
        profile_urls = signals.get("profile_urls", [])
        if isinstance(profile_urls, str):
            profile_urls = [profile_urls]
        for purl in profile_urls:
            queries.append(
                SearchQuery.create(
                    investigation_id=inv_id,
                    query_text=purl,
                    query_type=QueryType.PROFILE_URL,
                    provider=self.adapters[0].name,
                    depth_level=depth_level,
                )
            )

        return queries

    async def execute_query(
        self,
        query: SearchQuery,
        max_results: int = 50,
    ) -> list[DiscoveredUrl]:
        """Execute a single SearchQuery via the appropriate adapter and persist results."""
        adapter = next((a for a in self.adapters if a.name == query.provider), self.adapters[0])

        # Record query in search_queries table
        sql_insert_query = """
        INSERT INTO search_queries (
            id, investigation_id, query_text, query_type, provider,
            depth_level, parent_source_id, status, result_count, executed_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        now = utc_now().isoformat()
        await self.db.execute(
            sql_insert_query,
            (
                query.id,
                query.investigation_id,
                query.query_text,
                query.query_type.value,
                adapter.name,
                query.depth_level,
                query.parent_source_id,
                TaskStatus.RUNNING.value,
                0,
                now,
                query.created_at.isoformat(),
            ),
        )

        discovered: list[DiscoveredUrl] = []
        try:
            # Direct Profile URL shortcut
            if query.query_type == QueryType.PROFILE_URL:
                from argus.core.models import hash_url
                u_hash = hash_url(query.query_text)
                existing = await self.url_repo.get_by_hash(query.investigation_id, u_hash)
                if existing is None:
                    url_model = DiscoveredUrl.create(
                        investigation_id=query.investigation_id,
                        url=query.query_text,
                        source_type=SourceType.DIRECT_SEED,
                        source_query_id=query.id,
                        title=f"Direct Profile Seed: {query.query_text}",
                        snippet="User-provided direct seed profile URL",
                        relevance_score=1.0,
                        status=UrlStatus.PENDING,
                    )
                    await self.url_repo.create(url_model)
                    discovered.append(url_model)
                results = []
            else:
                results: list[SearchResult] = await adapter.search(
                    query.query_text, max_results=max_results
                )

            from argus.core.models import hash_url
            for res in results:
                u_hash = hash_url(res.url)
                existing = await self.url_repo.get_by_hash(query.investigation_id, u_hash)
                if existing is not None:
                    continue

                url_model = DiscoveredUrl.create(
                    investigation_id=query.investigation_id,
                    url=res.url,
                    source_type=SourceType.SEARCH_RESULT,
                    source_query_id=query.id,
                    title=res.title,
                    snippet=res.snippet,
                    relevance_score=res.relevance_score,
                    status=UrlStatus.PENDING,
                )
                await self.url_repo.create(url_model)
                discovered.append(url_model)

            # Update query status to completed
            await self.db.execute(
                "UPDATE search_queries SET status = ?, result_count = ? WHERE id = ?",
                (TaskStatus.COMPLETED.value, len(discovered), query.id),
            )
            logger.info(
                "Executed query '%s' on %s: discovered %d URLs",
                query.query_text,
                adapter.name,
                len(discovered),
            )

        except Exception as exc:
            logger.error("Failed executing query '%s': %s", query.query_text, exc)
            await self.db.execute(
                "UPDATE search_queries SET status = ? WHERE id = ?",
                (TaskStatus.FAILED.value, query.id),
            )
            raise

        return discovered

    async def run_discovery(
        self,
        investigation: Investigation,
        max_results_per_query: int = 50,
    ) -> list[DiscoveredUrl]:
        """Run seed discovery queries for an investigation and return all newly discovered URLs."""
        queries = self.generate_seed_queries(investigation)
        all_discovered: list[DiscoveredUrl] = []

        for q in queries:
            discovered = await self.execute_query(q, max_results=max_results_per_query)
            all_discovered.extend(discovered)

        return all_discovered
