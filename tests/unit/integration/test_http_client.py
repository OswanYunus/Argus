"""Unit tests for ARGUS pooled HTTP client."""

from __future__ import annotations

import pytest
from pytest_httpx import HTTPXMock

from argus.integration.http_client import FetchResponse, HttpClient


@pytest.mark.asyncio
async def test_successful_fetch(httpx_mock: HTTPXMock):
    """Test successful GET request parsing."""
    url = "https://target-site.example/page"
    httpx_mock.add_response(
        url="https://target-site.example/robots.txt",
        text="User-agent: *\nAllow: /",
        status_code=200,
    )
    httpx_mock.add_response(
        url=url,
        text="<html><body>Hello OSINT</body></html>",
        headers={"content-type": "text/html; charset=utf-8"},
        status_code=200,
    )

    client = HttpClient()
    try:
        resp = await client.fetch(url)
        assert resp.is_success
        assert resp.status_code == 200
        assert "Hello OSINT" in resp.text
        assert resp.robots_allowed is True
    finally:
        await client.close()


@pytest.mark.asyncio
async def test_robots_txt_disallows(httpx_mock: HTTPXMock):
    """Test that URLs blocked by robots.txt are not fetched."""
    url = "https://private-zone.example/secret"
    httpx_mock.add_response(
        url="https://private-zone.example/robots.txt",
        text="User-agent: *\nDisallow: /secret",
        status_code=200,
    )

    client = HttpClient(respect_robots=True)
    try:
        resp = await client.fetch(url)
        assert not resp.is_success
        assert resp.status_code == 403
        assert resp.robots_allowed is False
        assert "Disallowed by robots.txt" in (resp.error_message or "")
    finally:
        await client.close()


@pytest.mark.asyncio
async def test_max_document_size_truncation(httpx_mock: HTTPXMock):
    """Documents exceeding max size are truncated with notice."""
    url = "https://large-file.example/data"
    httpx_mock.add_response(
        url="https://large-file.example/robots.txt",
        status_code=404,
    )
    large_bytes = b"A" * 1500
    httpx_mock.add_response(
        url=url,
        content=large_bytes,
        headers={"content-type": "application/octet-stream"},
        status_code=200,
    )

    client = HttpClient(max_document_size_bytes=1000)
    try:
        resp = await client.fetch(url)
        assert resp.status_code == 200
        assert len(resp.content) == 1000
        assert "exceeds" in (resp.error_message or "")
    finally:
        await client.close()


@pytest.mark.asyncio
async def test_client_lifecycle_close():
    """Client can be opened and closed gracefully."""
    client = HttpClient()
    c = await client.get_client()
    assert not c.is_closed
    await client.close()
    assert client._client is None
