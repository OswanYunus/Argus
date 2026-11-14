"""Unit tests for search adapters protocol and DuckDuckGo implementation."""

from __future__ import annotations

import pytest
from pytest_httpx import HTTPXMock

from argus.core.models import QueryType
from argus.integration.search_adapters.base import SearchAdapter
from argus.integration.search_adapters.duckduckgo import DuckDuckGoAdapter


def test_format_query():
    """Verify target signals format appropriately for search engine operators."""
    assert SearchAdapter.format_query(QueryType.EXACT_NAME, "Jane Doe") == '"Jane Doe"'
    assert SearchAdapter.format_query(QueryType.EMAIL, "jane@example.com") == '"jane@example.com"'
    assert SearchAdapter.format_query(QueryType.DOMAIN, "example.com") == "site:example.com"
    assert SearchAdapter.format_query(QueryType.USERNAME, "janedoe99") == "janedoe99"
    assert SearchAdapter.format_query(QueryType.FREETEXT, "conference talk 2024") == "conference talk 2024"


@pytest.mark.asyncio
async def test_duckduckgo_search_parsing(httpx_mock: HTTPXMock):
    """Test DuckDuckGo HTML result parsing, redirect unwrapping, and snippet extraction."""
    mock_html = """
    <!DOCTYPE html>
    <html>
    <body>
      <div class="result results_links results_links_deep web-result ">
        <div class="result__body links_main links_deep">
          <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fgithub.com%2Fjohndoe&amp;rut=1">John Doe - GitHub</a>
          <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fgithub.com%2Fjohndoe&amp;rut=1">
            Software engineer and open source contributor working on distributed systems.
          </a>
        </div>
      </div>
      <div class="result results_links results_links_deep web-result ">
        <div class="result__body links_main links_deep">
          <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Flinkedin.com%2Fin%2Fjohndoe&amp;rut=1">John Doe | LinkedIn</a>
          <div class="result__snippet">
            View John Doe's profile on LinkedIn, the world's largest professional community.
          </div>
        </div>
      </div>
    </body>
    </html>
    """

    httpx_mock.add_response(
        url="https://html.duckduckgo.com/html/",
        method="POST",
        text=mock_html,
        status_code=200,
    )

    adapter = DuckDuckGoAdapter()
    try:
        results = await adapter.search("John Doe", max_results=10)
        assert len(results) == 2

        assert results[0].url == "https://github.com/johndoe"
        assert results[0].title == "John Doe - GitHub"
        assert "Software engineer" in results[0].snippet
        assert results[0].source_provider == "duckduckgo"

        assert results[1].url == "https://linkedin.com/in/johndoe"
        assert results[1].title == "John Doe | LinkedIn"
        assert "LinkedIn" in results[1].snippet
    finally:
        await adapter._http_client.close()
