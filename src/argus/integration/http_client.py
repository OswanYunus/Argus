"""Pooled asynchronous HTTP client for ARGUS with rate limiting, retries, and robots.txt support."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Optional
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import httpx

logger = logging.getLogger("argus.http")


@dataclass(frozen=True)
class FetchResponse:
    """Standardized response from an HTTP fetch operation."""

    url: str
    status_code: int
    content: bytes
    headers: dict[str, str]
    content_type: str
    elapsed_ms: float
    robots_allowed: bool = True
    error_message: Optional[str] = None

    @property
    def is_success(self) -> bool:
        return 200 <= self.status_code < 300

    @property
    def text(self) -> str:
        try:
            return self.content.decode("utf-8")
        except UnicodeDecodeError:
            return self.content.decode("latin-1", errors="replace")


class HttpClient:
    """Pooled HTTP client with retries, timeout enforcement, and robots.txt cache."""

    def __init__(
        self,
        user_agent: str = "ARGUS-OSINT-Engine/1.0 (authorized-research)",
        timeout_seconds: float = 30.0,
        max_retries: int = 2,
        respect_robots: bool = True,
        max_document_size_bytes: int = 50 * 1024 * 1024,
    ) -> None:
        self.user_agent = user_agent
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.respect_robots = respect_robots
        self.max_document_size_bytes = max_document_size_bytes

        self._client: Optional[httpx.AsyncClient] = None
        self._robots_cache: dict[str, Optional[RobotFileParser]] = {}
        self._robots_lock = asyncio.Lock()

    async def get_client(self) -> httpx.AsyncClient:
        """Get or initialize the underlying httpx.AsyncClient."""
        if self._client is None or self._client.is_closed:
            limits = httpx.Limits(max_connections=50, max_keepalive_connections=20)
            self._client = httpx.AsyncClient(
                headers={"User-Agent": self.user_agent, "Accept-Encoding": "gzip, deflate, br"},
                timeout=httpx.Timeout(self.timeout_seconds, connect=10.0),
                limits=limits,
                follow_redirects=True,
            )
        return self._client

    async def close(self) -> None:
        """Close the underlying client and reset caches."""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
        self._robots_cache.clear()

    async def check_robots_allowed(self, url: str) -> bool:
        """Check if robots.txt permits crawling this URL for our user agent."""
        if not self.respect_robots:
            return True

        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return True

        origin = f"{parsed.scheme}://{parsed.netloc}"
        async with self._robots_lock:
            if origin in self._robots_cache:
                parser = self._robots_cache[origin]
                if parser is None:
                    return True
                return parser.can_fetch(self.user_agent, url)

        # Fetch robots.txt
        robots_url = f"{origin}/robots.txt"
        client = await self.get_client()
        parser: Optional[RobotFileParser] = None
        try:
            resp = await client.get(robots_url, timeout=5.0)
            if resp.status_code == 200:
                parser = RobotFileParser()
                parser.parse(resp.text.splitlines())
        except Exception as exc:
            logger.debug("Failed to fetch %s: %s (defaulting to permitted)", robots_url, exc)
            parser = None

        async with self._robots_lock:
            self._robots_cache[origin] = parser

        if parser is None:
            return True
        return parser.can_fetch(self.user_agent, url)

    async def fetch(
        self,
        url: str,
        method: str = "GET",
        headers: Optional[dict[str, str]] = None,
        check_robots: bool = True,
    ) -> FetchResponse:
        """Fetch a URL with timeout, retries on transient errors, and response wrapping."""
        if check_robots and not await self.check_robots_allowed(url):
            logger.info("Robots.txt disallowed fetch of URL: %s", url)
            return FetchResponse(
                url=url,
                status_code=403,
                content=b"",
                headers={},
                content_type="",
                elapsed_ms=0.0,
                robots_allowed=False,
                error_message="Disallowed by robots.txt",
            )

        client = await self.get_client()
        custom_headers = headers or {}

        start_time = asyncio.get_event_loop().time()
        last_error: Optional[Exception] = None

        for attempt in range(self.max_retries + 1):
            try:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=custom_headers,
                )
                elapsed_ms = (asyncio.get_event_loop().time() - start_time) * 1000

                # Check max size limit
                content = response.content
                if len(content) > self.max_document_size_bytes:
                    return FetchResponse(
                        url=str(response.url),
                        status_code=response.status_code,
                        content=content[: self.max_document_size_bytes],
                        headers=dict(response.headers),
                        content_type=response.headers.get("content-type", ""),
                        elapsed_ms=elapsed_ms,
                        robots_allowed=True,
                        error_message=f"Document truncated: exceeds {self.max_document_size_bytes} bytes",
                    )

                return FetchResponse(
                    url=str(response.url),
                    status_code=response.status_code,
                    content=content,
                    headers=dict(response.headers),
                    content_type=response.headers.get("content-type", ""),
                    elapsed_ms=elapsed_ms,
                    robots_allowed=True,
                )

            except (httpx.TimeoutException, httpx.NetworkError, httpx.RemoteProtocolError) as exc:
                last_error = exc
                if attempt < self.max_retries:
                    await asyncio.sleep(0.5 * (2**attempt))
                else:
                    break

        elapsed_ms = (asyncio.get_event_loop().time() - start_time) * 1000
        return FetchResponse(
            url=url,
            status_code=599,
            content=b"",
            headers={},
            content_type="",
            elapsed_ms=elapsed_ms,
            robots_allowed=True,
            error_message=str(last_error) if last_error else "Network error",
        )
