"""Token bucket asynchronous rate limiter for per-domain and per-provider throttling."""

from __future__ import annotations

import asyncio
import time
from typing import Optional
from urllib.parse import urlparse


class TokenBucket:
    """Async token bucket for smooth request throttling with burst capacity."""

    def __init__(self, rate: float = 2.0, burst: int = 5) -> None:
        self.rate = rate  # tokens added per second
        self.capacity = float(burst)
        self.tokens = float(burst)
        self.last_updated = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self, tokens: float = 1.0) -> None:
        """Wait until sufficient tokens are available, then consume them."""
        while True:
            async with self._lock:
                now = time.monotonic()
                elapsed = now - self.last_updated
                self.last_updated = now

                # Refill tokens
                self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)

                if self.tokens >= tokens:
                    self.tokens -= tokens
                    return

                # Calculate sleep duration needed for required tokens
                needed = tokens - self.tokens
                sleep_sec = needed / self.rate

            await asyncio.sleep(sleep_sec)


class RateLimiter:
    """Registry of per-domain and provider token buckets."""

    def __init__(self, default_rate: float = 2.0, default_burst: int = 5) -> None:
        self.default_rate = default_rate
        self.default_burst = default_burst
        self._buckets: dict[str, TokenBucket] = {}
        self._lock = asyncio.Lock()

    def _extract_domain(self, target: str) -> str:
        """Extract domain from URL or use target as-is."""
        if "://" in target:
            parsed = urlparse(target)
            return (parsed.netloc or target).lower()
        return target.lower()

    async def get_bucket(self, target: str) -> TokenBucket:
        """Get or create the token bucket for a domain or provider."""
        domain = self._extract_domain(target)
        async with self._lock:
            if domain not in self._buckets:
                self._buckets[domain] = TokenBucket(
                    rate=self.default_rate, burst=self.default_burst
                )
            return self._buckets[domain]

    async def acquire(self, target: str, tokens: float = 1.0) -> None:
        """Acquire rate limit token for a specific domain or provider."""
        bucket = await self.get_bucket(target)
        await bucket.acquire(tokens)

    async def configure_domain(self, domain: str, rate: float, burst: int) -> None:
        """Explicitly configure rate limit for a specific domain."""
        clean_domain = self._extract_domain(domain)
        async with self._lock:
            self._buckets[clean_domain] = TokenBucket(rate=rate, burst=burst)
