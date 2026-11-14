"""Base LLM interface and response models for ARGUS."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Optional, Type, TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


@dataclass(frozen=True)
class LLMResponse:
    """Standardized completion response from an LLM call."""

    content: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    model: str
    elapsed_ms: float


class LLMClientProtocol(ABC):
    """Protocol for provider-agnostic LLM completion and structured parsing."""

    @abstractmethod
    async def complete(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.0,
        max_tokens: int = 2048,
    ) -> LLMResponse:
        """Execute chat completion."""

    @abstractmethod
    async def extract_structured(
        self,
        messages: list[dict[str, str]],
        response_model: Type[T],
        temperature: float = 0.0,
        max_tokens: int = 2048,
    ) -> tuple[T, LLMResponse]:
        """Execute chat completion and parse output into a validated Pydantic model."""
