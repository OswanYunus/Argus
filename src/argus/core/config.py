"""ARGUS configuration system.

Loads typed, validated settings from YAML + environment variables.
Secrets are loaded exclusively from environment variables, never from YAML.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Nested config models
# ---------------------------------------------------------------------------

class RateLimitConfig(BaseModel):
    """Rate-limiting parameters for a single provider or default."""

    model_config = {"frozen": True}

    requests_per_second: float = 2.0
    burst: int = 5

    @field_validator("requests_per_second")
    @classmethod
    def _rps_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("requests_per_second must be positive")
        return v

    @field_validator("burst")
    @classmethod
    def _burst_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("burst must be positive")
        return v


class ProviderConfig(BaseModel):
    """A single discovery-provider entry."""

    model_config = {"frozen": True}

    name: str
    enabled: bool = True
    rate_limit: RateLimitConfig = Field(default_factory=RateLimitConfig)


class AppConfig(BaseModel):
    """Top-level application identity & paths."""

    model_config = {"frozen": True}

    name: str = "ARGUS"
    data_dir: Path = Path("./data")
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"


class DatabaseConfig(BaseModel):
    """SQLite database settings."""

    model_config = {"frozen": True}

    path: Path = Path("./data/argus.db")
    wal_mode: bool = True
    busy_timeout_ms: int = 5000

    @field_validator("busy_timeout_ms")
    @classmethod
    def _timeout_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("busy_timeout_ms must be positive")
        return v


class CollectionConfig(BaseModel):
    """HTTP collection / crawling settings."""

    model_config = {"frozen": True}

    max_concurrent_requests: int = 10
    request_timeout_seconds: int = 30
    max_document_size_mb: int = 50
    respect_robots_txt: bool = True
    user_agent: str = "ARGUS-OSINT-Engine/1.0 (authorized-research)"
    default_rate_limit: RateLimitConfig = Field(default_factory=RateLimitConfig)


class DiscoveryConfig(BaseModel):
    """URL discovery / search settings."""

    model_config = {"frozen": True}

    max_recursion_depth: int = 2
    max_urls_per_query: int = 50
    max_total_urls: int = 5000
    providers: list[ProviderConfig] = Field(default_factory=list)


class AnalysisConfig(BaseModel):
    """LLM-based analysis settings."""

    model_config = {"frozen": True}

    llm_provider: str = "deepseek"
    llm_model: str = "deepseek-chat"
    llm_base_url: str = "https://api.deepseek.com/v1"
    max_tokens_per_call: int = 4096
    max_llm_calls_per_run: int = 100
    min_relevance_for_analysis: float = 0.3

    @field_validator("min_relevance_for_analysis")
    @classmethod
    def _relevance_range(cls, v: float) -> float:
        if not 0.0 <= v <= 1.0:
            raise ValueError("min_relevance_for_analysis must be between 0 and 1")
        return v


class EntityResolutionConfig(BaseModel):
    """Entity-resolution thresholds."""

    model_config = {"frozen": True}

    min_signals_for_likely: int = 2
    min_signals_for_verified: int = 3
    single_signal_max_confidence: float = 0.4
    confidence_decay_days: int = 180


class BudgetConfig(BaseModel):
    """Per-run resource budget caps."""

    model_config = {"frozen": True}

    max_http_requests: int = 10000
    max_llm_calls: int = 500
    max_document_bytes: int = 500_000_000


class PipelineConfig(BaseModel):
    """Orchestration pipeline settings."""

    model_config = {"frozen": True}

    max_concurrent_tasks: int = 20
    task_timeout_seconds: int = 120
    max_retries: int = 3
    budget: BudgetConfig = Field(default_factory=BudgetConfig)


class ApiConfig(BaseModel):
    """REST API server settings."""

    model_config = {"frozen": True}

    host: str = "127.0.0.1"
    port: int = 8000

    @field_validator("port")
    @classmethod
    def _port_range(cls, v: int) -> int:
        if not 1 <= v <= 65535:
            raise ValueError("port must be between 1 and 65535")
        return v


# ---------------------------------------------------------------------------
# Root Settings model
# ---------------------------------------------------------------------------

class Settings(BaseModel):
    """Root configuration — aggregates all sub-configs plus secrets."""

    model_config = {"frozen": True}

    app: AppConfig = Field(default_factory=AppConfig)
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    collection: CollectionConfig = Field(default_factory=CollectionConfig)
    discovery: DiscoveryConfig = Field(default_factory=DiscoveryConfig)
    analysis: AnalysisConfig = Field(default_factory=AnalysisConfig)
    entity_resolution: EntityResolutionConfig = Field(default_factory=EntityResolutionConfig)
    pipeline: PipelineConfig = Field(default_factory=PipelineConfig)
    api: ApiConfig = Field(default_factory=ApiConfig)

    # Secrets — populated from environment variables only
    master_key: str = ""
    llm_api_key: str = ""
    api_key: str = ""


# ---------------------------------------------------------------------------
# Loading helpers
# ---------------------------------------------------------------------------

def _strip_secrets(data: dict[str, object]) -> dict[str, object]:
    """Remove secret keys from parsed YAML so they cannot leak from file."""
    for key in ("master_key", "llm_api_key", "api_key"):
        data.pop(key, None)
    return data


def load_settings(config_path: Path | None = None) -> Settings:
    """Load, validate, and return a frozen :class:`Settings` instance.

    Resolution order for the YAML file:
      1. *config_path* argument (explicit)
      2. ``ARGUS_CONFIG_PATH`` environment variable
      3. ``./config.yaml`` (current working directory)

    Secrets are **always** read from environment variables, never from YAML.
    ``data_dir`` is created if it does not yet exist.
    """
    # --- Resolve config file path -------------------------------------------
    if config_path is None:
        env_path = os.environ.get("ARGUS_CONFIG_PATH")
        if env_path:
            config_path = Path(env_path)
        else:
            config_path = Path("config.yaml")

    # --- Load YAML (or fall back to empty dict) -----------------------------
    yaml_data: dict[str, object] = {}
    if config_path.exists():
        with open(config_path, "r", encoding="utf-8") as fh:
            raw = yaml.safe_load(fh)
            if isinstance(raw, dict):
                yaml_data = raw

    # Strip any secrets that may have been accidentally placed in the file
    yaml_data = _strip_secrets(yaml_data)

    # --- Overlay secrets from env -------------------------------------------
    yaml_data["master_key"] = os.environ.get("ARGUS_MASTER_KEY", "")
    yaml_data["llm_api_key"] = os.environ.get("ARGUS_LLM_API_KEY", "")
    yaml_data["api_key"] = os.environ.get("ARGUS_API_KEY", "")

    # --- Build and validate -------------------------------------------------
    settings = Settings.model_validate(yaml_data)

    # --- Ensure data_dir exists ---------------------------------------------
    settings.app.data_dir.mkdir(parents=True, exist_ok=True)

    return settings


# ---------------------------------------------------------------------------
# Singleton accessor
# ---------------------------------------------------------------------------

_settings: Settings | None = None


def get_settings() -> Settings:
    """Return the cached :class:`Settings` singleton.

    The first call triggers :func:`load_settings`; subsequent calls return the
    same instance.
    """
    global _settings  # noqa: PLW0603
    if _settings is None:
        _settings = load_settings()
    return _settings


def _reset_settings() -> None:
    """Reset the singleton (for testing only)."""
    global _settings  # noqa: PLW0603
    _settings = None
