"""Unit tests for asynchronous rate limiter and token bucket."""

from __future__ import annotations

import asyncio
import time
import pytest

from argus.orchestration.rate_limiter import RateLimiter, TokenBucket


@pytest.mark.asyncio
async def test_token_bucket_burst():
    """Initial burst consumes immediately without sleeping."""
    bucket = TokenBucket(rate=10.0, burst=5)
    start = time.monotonic()
    for _ in range(5):
        await bucket.acquire(1.0)
    elapsed = time.monotonic() - start
    assert elapsed < 0.1  # Virtually instantaneous


@pytest.mark.asyncio
async def test_token_bucket_throttling():
    """Consuming beyond burst requires waiting for token replenishment."""
    bucket = TokenBucket(rate=10.0, burst=1)  # 10 tokens/sec = 1 token per 100ms
    await bucket.acquire(1.0)  # Consumes burst

    start = time.monotonic()
    await bucket.acquire(1.0)  # Must wait ~100ms
    elapsed = time.monotonic() - start
    assert 0.08 <= elapsed <= 0.3


@pytest.mark.asyncio
async def test_per_domain_isolation():
    """Rate limits on domain A do not throttle domain B."""
    limiter = RateLimiter(default_rate=5.0, default_burst=1)
    await limiter.acquire("https://site-a.com/page1")

    # Accessing site-b should be instant because its bucket is full
    start = time.monotonic()
    await limiter.acquire("https://site-b.com/page1")
    elapsed = time.monotonic() - start
    assert elapsed < 0.05
