"""Provider-agnostic OpenAI/DeepSeek-compatible LLM client with structured JSON parsing."""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from typing import Any, Optional, Type, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from argus.integration.llm.base import LLMClientProtocol, LLMResponse

logger = logging.getLogger("argus.integration.llm")

T = TypeVar("T", bound=BaseModel)


class LLMClient(LLMClientProtocol):
    """Client for OpenAI-compatible LLM endpoints (DeepSeek, OpenAI, Groq, local Ollama)."""

    def __init__(
        self,
        api_key: str = "",
        model: str = "deepseek-chat",
        base_url: str = "https://api.deepseek.com/v1",
        timeout_seconds: float = 60.0,
        max_retries: int = 3,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries

    def _extract_json_block(self, text: str) -> str:
        """Extract JSON from markdown code fences or plain string."""
        text = text.strip()
        # Find ```json ... ```
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if match:
            return match.group(1).strip()
        # Check if starts with { and ends with }
        if text.startswith("{") and text.endswith("}"):
            return text
        if text.startswith("[") and text.endswith("]"):
            return text
        return text

    async def complete(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.0,
        max_tokens: int = 2048,
    ) -> LLMResponse:
        """Call LLM chat completions endpoint with retry on rate limits."""
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        start_time = time.monotonic()
        async with httpx.AsyncClient(timeout=httpx.Timeout(self.timeout_seconds)) as client:
            for attempt in range(self.max_retries + 1):
                try:
                    resp = await client.post(url, headers=headers, json=payload)
                    elapsed_ms = (time.monotonic() - start_time) * 1000

                    if resp.status_code == 200:
                        data = resp.json()
                        choice = data["choices"][0]["message"]
                        usage = data.get("usage", {})
                        return LLMResponse(
                            content=choice.get("content", ""),
                            prompt_tokens=usage.get("prompt_tokens", 0),
                            completion_tokens=usage.get("completion_tokens", 0),
                            total_tokens=usage.get("total_tokens", 0),
                            model=self.model,
                            elapsed_ms=elapsed_ms,
                        )

                    if resp.status_code == 429 and attempt < self.max_retries:
                        wait_sec = 2.0 * (attempt + 1)
                        logger.warning("LLM rate limited (429), backing off for %.1fs...", wait_sec)
                        await asyncio.sleep(wait_sec)
                        continue

                    resp.raise_for_status()

                except (httpx.TimeoutException, httpx.NetworkError) as exc:
                    if attempt < self.max_retries:
                        await asyncio.sleep(1.0 * (attempt + 1))
                        continue
                    raise RuntimeError(f"LLM request network failure: {exc}") from exc

            raise RuntimeError(f"LLM request failed after {self.max_retries} retries: HTTP {resp.status_code}")

    async def extract_structured(
        self,
        messages: list[dict[str, str]],
        response_model: Type[T],
        temperature: float = 0.0,
        max_tokens: int = 2048,
    ) -> tuple[T, LLMResponse]:
        """Execute completion, parse and validate JSON against the target Pydantic schema."""
        # Inject JSON schema instructions into the prompt
        schema_json = json.dumps(response_model.model_json_schema(), indent=2)
        instruction = f"\n\nYou MUST respond ONLY with a valid JSON object matching this schema:\n{schema_json}\nDo not include any commentary outside the JSON."

        updated_messages = [dict(m) for m in messages]
        updated_messages[-1]["content"] += instruction

        llm_response = await self.complete(
            updated_messages, temperature=temperature, max_tokens=max_tokens
        )
        json_str = self._extract_json_block(llm_response.content)

        try:
            parsed = response_model.model_validate_json(json_str)
            return parsed, llm_response
        except (ValidationError, json.JSONDecodeError) as exc:
            logger.error("Failed to parse structured LLM output: %s\nRaw output: %s", exc, json_str)
            raise ValueError(f"LLM response did not match expected schema: {exc}") from exc
