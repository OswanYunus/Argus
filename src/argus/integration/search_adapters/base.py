"""Base search adapter interface and common models for ARGUS search providers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

from argus.core.models import QueryType


@dataclass(frozen=True)
class SearchResult:
    """A single normalized search result from any search provider."""

    url: str
    title: str
    snippet: str
    source_provider: str
    relevance_score: float = 1.0


class SearchAdapter(ABC):
    """Abstract base class for search provider adapters."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider identifier, e.g. 'duckduckgo', 'google', 'bing'."""

    @abstractmethod
    async def search(
        self,
        query: str,
        max_results: int = 50,
    ) -> list[SearchResult]:
        """Execute a search query and return normalized results."""

    @staticmethod
    def format_query(query_type: QueryType, value: str) -> str:
        """Format an OSINT target value based on query type."""
        clean = value.strip()
        match query_type:
            case QueryType.EXACT_NAME:
                # Enclose exact names in quotes to avoid broad noisy matches
                return f'"{clean}"'
            case QueryType.EMAIL:
                return f'"{clean}"'
            case QueryType.DOMAIN:
                return f"site:{clean}"
            case QueryType.USERNAME:
                return clean
            case QueryType.URL | QueryType.FREETEXT:
                return clean
            case _:
                return clean
