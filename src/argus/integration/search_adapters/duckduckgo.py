"""DuckDuckGo search adapter for ARGUS using public HTML endpoint."""

from __future__ import annotations

import logging
import re
from typing import Optional
from urllib.parse import parse_qs, unquote, urlparse

import httpx

from argus.integration.http_client import HttpClient
from argus.integration.search_adapters.base import SearchAdapter, SearchResult

logger = logging.getLogger("argus.discovery.duckduckgo")


class DuckDuckGoAdapter(SearchAdapter):
    """Adapter querying DuckDuckGo's public HTML interface without requiring API keys."""

    ENDPOINT = "https://html.duckduckgo.com/html/"

    def __init__(
        self,
        http_client: Optional[HttpClient] = None,
        user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ) -> None:
        self._http_client = http_client or HttpClient(user_agent=user_agent, respect_robots=False)

    @property
    def name(self) -> str:
        return "duckduckgo"

    def _extract_actual_url(self, raw_url: str) -> Optional[str]:
        """Extract the target destination from DuckDuckGo redirect link."""
        if not raw_url:
            return None

        # Check for //duckduckgo.com/l/?uddg=...
        if "uddg=" in raw_url:
            parsed = urlparse(raw_url)
            query_params = parse_qs(parsed.query)
            uddg = query_params.get("uddg")
            if uddg and uddg[0]:
                return unquote(uddg[0])

        if raw_url.startswith("//"):
            raw_url = "https:" + raw_url

        if raw_url.startswith("http://") or raw_url.startswith("https://"):
            return raw_url

        return None

    def _parse_html_results(self, html_text: str) -> list[SearchResult]:
        """Parse result links, titles, and snippets from DuckDuckGo HTML output."""
        results: list[SearchResult] = []

        # Find result divs or anchors
        # Typical pattern: <a class="result__a" href="...">Title</a> ... <a class="result__snippet" ...>Snippet</a>
        # Regex extraction avoids heavy third-party parsing dependencies here
        result_pattern = re.compile(
            r'<div class="result[^"]*">.*?'
            r'<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="(?P<href>[^"]+)"[^>]*>(?P<title>.*?)</a>.*?'
            r'(?:<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>(?P<snippet>.*?)</a>|(?P<alt_snippet><div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>.*?</div>))',
            re.DOTALL,
        )

        # Fallback simpler anchor pattern
        anchor_pattern = re.compile(
            r'<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="(?P<href>[^"]+)"[^>]*>(?P<title>.*?)</a>',
            re.DOTALL,
        )

        # Clean HTML tags helper
        clean_tag = re.compile(r"<[^>]+>")

        def strip_tags(text: str) -> str:
            return clean_tag.sub("", text).strip().replace("&amp;", "&").replace("&quot;", '"')

        seen_urls: set[str] = set()

        for match in result_pattern.finditer(html_text):
            href = match.group("href")
            actual_url = self._extract_actual_url(href)
            if not actual_url or actual_url in seen_urls:
                continue

            # Skip DuckDuckGo ad or self-referential links
            if "duckduckgo.com" in actual_url:
                continue

            seen_urls.add(actual_url)
            title = strip_tags(match.group("title"))
            raw_snippet = match.group("snippet") or match.group("alt_snippet") or ""
            snippet = strip_tags(raw_snippet)

            results.append(
                SearchResult(
                    url=actual_url,
                    title=title,
                    snippet=snippet,
                    source_provider=self.name,
                    relevance_score=1.0,
                )
            )

        # If strict block pattern missed results, try anchor pattern
        if not results:
            for match in anchor_pattern.finditer(html_text):
                href = match.group("href")
                actual_url = self._extract_actual_url(href)
                if not actual_url or actual_url in seen_urls or "duckduckgo.com" in actual_url:
                    continue
                seen_urls.add(actual_url)
                title = strip_tags(match.group("title"))
                results.append(
                    SearchResult(
                        url=actual_url,
                        title=title,
                        snippet="",
                        source_provider=self.name,
                        relevance_score=0.8,
                    )
                )

        return results

    async def search(
        self,
        query: str,
        max_results: int = 50,
    ) -> list[SearchResult]:
        """Perform search on DuckDuckGo and return list of SearchResult."""
        client = await self._http_client.get_client()
        try:
            resp = await client.post(
                self.ENDPOINT,
                data={"q": query, "b": ""},
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Referer": "https://html.duckduckgo.com/",
                },
            )
            if resp.status_code == 200:
                results = self._parse_html_results(resp.text)
                if results:
                    return results[:max_results]
        except Exception as exc:
            logger.debug("Error querying DuckDuckGo HTML endpoint for '%s': %s", query, exc)

        # Fallback to ddgs library if HTML endpoint yielded nothing
        def _do_ddgs_search() -> list[SearchResult]:
            try:
                from ddgs import DDGS
                with DDGS() as ddgs:
                    raw_items = list(ddgs.text(query, max_results=max_results))
                    parsed_results = []
                    for item in raw_items:
                        href = item.get("href")
                        if not href:
                            continue
                        parsed_results.append(
                            SearchResult(
                                url=href,
                                title=item.get("title", ""),
                                snippet=item.get("body", ""),
                                source_provider=self.name,
                                relevance_score=1.0,
                            )
                        )
                    return parsed_results
            except Exception as e:
                logger.debug("ddgs package search yielded no results or encountered: %s", e)
                return []

        import asyncio
        results = await asyncio.to_thread(_do_ddgs_search)
        return results[:max_results]
