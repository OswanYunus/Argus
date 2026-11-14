"""Search adapters package for ARGUS discovery engine."""

from argus.integration.search_adapters.base import SearchAdapter, SearchResult
from argus.integration.search_adapters.duckduckgo import DuckDuckGoAdapter

__all__ = ["SearchAdapter", "SearchResult", "DuckDuckGoAdapter"]
