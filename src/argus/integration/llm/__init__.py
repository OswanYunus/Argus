"""LLM integration package for ARGUS."""

from argus.integration.llm.base import LLMClientProtocol, LLMResponse
from argus.integration.llm.client import LLMClient

__all__ = ["LLMClientProtocol", "LLMResponse", "LLMClient"]
