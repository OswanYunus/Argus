"""Unit tests for argus.core.config."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
import yaml

from argus.core.config import (
    Settings,
    _reset_settings,
    get_settings,
    load_settings,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _clean_singleton() -> None:
    """Reset the module-level singleton before every test."""
    _reset_settings()
    yield  # type: ignore[misc]
    _reset_settings()


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Remove ARGUS env vars so tests start from a known state."""
    for var in ("ARGUS_CONFIG_PATH", "ARGUS_MASTER_KEY", "ARGUS_LLM_API_KEY", "ARGUS_API_KEY"):
        monkeypatch.delenv(var, raising=False)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestLoadFromYaml:
    """test_load_from_yaml — loads config.yaml, verifies all sections populated."""

    def test_load_from_yaml(self, config_yaml: Path) -> None:
        settings = load_settings(config_path=config_yaml)

        # App section
        assert settings.app.name == "ARGUS-TEST"
        assert settings.app.log_level == "DEBUG"

        # Database
        assert settings.database.wal_mode is True
        assert settings.database.busy_timeout_ms == 1000

        # Collection
        assert settings.collection.max_concurrent_requests == 2
        assert settings.collection.request_timeout_seconds == 5
        assert settings.collection.user_agent == "ARGUS-TEST/1.0"
        assert settings.collection.default_rate_limit.requests_per_second == 10.0

        # Discovery
        assert settings.discovery.max_recursion_depth == 1
        assert settings.discovery.max_urls_per_query == 10

        # Analysis
        assert settings.analysis.llm_provider == "deepseek"
        assert settings.analysis.max_tokens_per_call == 1024

        # Entity resolution
        assert settings.entity_resolution.min_signals_for_likely == 2

        # Pipeline
        assert settings.pipeline.max_concurrent_tasks == 5
        assert settings.pipeline.budget.max_http_requests == 100

        # API
        assert settings.api.port == 8888


class TestDefaultsWhenNoYaml:
    """test_defaults_when_no_yaml — loads with no file, gets valid defaults."""

    def test_defaults_when_no_yaml(self, tmp_path: Path) -> None:
        # Point to a non-existent file so YAML loading is skipped
        settings = load_settings(config_path=tmp_path / "nonexistent.yaml")

        assert settings.app.name == "ARGUS"
        assert settings.app.log_level == "INFO"
        assert settings.database.wal_mode is True
        assert settings.database.busy_timeout_ms == 5000
        assert settings.collection.max_concurrent_requests == 10
        assert settings.discovery.max_total_urls == 5000
        assert settings.analysis.llm_model == "deepseek-chat"
        assert settings.pipeline.max_retries == 3
        assert settings.api.host == "127.0.0.1"
        assert settings.api.port == 8000


class TestEnvOverrides:
    """test_env_overrides — ARGUS_CONFIG_PATH, ARGUS_MASTER_KEY, etc. are read from env."""

    def test_config_path_from_env(
        self, config_yaml: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("ARGUS_CONFIG_PATH", str(config_yaml))
        # Call without explicit path — should pick up env var
        settings = load_settings()
        assert settings.app.name == "ARGUS-TEST"

    def test_master_key_from_env(
        self, config_yaml: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("ARGUS_MASTER_KEY", "my-secret-fernet-key")
        settings = load_settings(config_path=config_yaml)
        assert settings.master_key == "my-secret-fernet-key"

    def test_llm_api_key_from_env(
        self, config_yaml: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("ARGUS_LLM_API_KEY", "llm-key-123")
        settings = load_settings(config_path=config_yaml)
        assert settings.llm_api_key == "llm-key-123"

    def test_api_key_from_env(
        self, config_yaml: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("ARGUS_API_KEY", "rest-api-key-xyz")
        settings = load_settings(config_path=config_yaml)
        assert settings.api_key == "rest-api-key-xyz"


class TestSecretsNotInYaml:
    """test_secrets_not_in_yaml — secrets fields come from env, not YAML."""

    def test_secrets_stripped_from_yaml(self, tmp_path: Path, tmp_data_dir: Path) -> None:
        config_path = tmp_path / "secrets_test.yaml"
        config_path.write_text(
            yaml.dump(
                {
                    "app": {"data_dir": tmp_data_dir.as_posix()},
                    "master_key": "SHOULD_BE_IGNORED",
                    "llm_api_key": "SHOULD_BE_IGNORED",
                    "api_key": "SHOULD_BE_IGNORED",
                }
            )
        )
        settings = load_settings(config_path=config_path)

        # The env vars were cleared by the autouse fixture, so defaults apply
        assert settings.master_key == ""
        assert settings.llm_api_key == ""
        assert settings.api_key == ""


class TestValidationRejectsInvalid:
    """test_validation_rejects_invalid — negative rate limits, invalid log levels, etc."""

    def test_negative_rate_limit(self) -> None:
        with pytest.raises(Exception):  # ValidationError
            Settings.model_validate(
                {
                    "collection": {
                        "default_rate_limit": {"requests_per_second": -1.0, "burst": 5}
                    }
                }
            )

    def test_zero_burst(self) -> None:
        with pytest.raises(Exception):
            Settings.model_validate(
                {
                    "collection": {
                        "default_rate_limit": {"requests_per_second": 2.0, "burst": 0}
                    }
                }
            )

    def test_invalid_log_level(self) -> None:
        with pytest.raises(Exception):
            Settings.model_validate({"app": {"log_level": "TRACE"}})

    def test_invalid_port(self) -> None:
        with pytest.raises(Exception):
            Settings.model_validate({"api": {"port": 99999}})

    def test_negative_busy_timeout(self) -> None:
        with pytest.raises(Exception):
            Settings.model_validate({"database": {"busy_timeout_ms": -1}})

    def test_relevance_out_of_range(self) -> None:
        with pytest.raises(Exception):
            Settings.model_validate({"analysis": {"min_relevance_for_analysis": 1.5}})


class TestDataDirCreated:
    """test_data_dir_created — data_dir is auto-created if missing."""

    def test_data_dir_created(self, tmp_path: Path) -> None:
        new_data = tmp_path / "brand_new_data"
        config_path = tmp_path / "config.yaml"
        config_path.write_text(
            yaml.dump({"app": {"data_dir": new_data.as_posix()}})
        )
        assert not new_data.exists()

        load_settings(config_path=config_path)
        assert new_data.exists()
        assert new_data.is_dir()


class TestSettingsSingleton:
    """test_settings_singleton — get_settings returns same instance."""

    def test_settings_singleton(
        self, config_yaml: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("ARGUS_CONFIG_PATH", str(config_yaml))
        first = get_settings()
        second = get_settings()
        assert first is second


class TestProviderConfigList:
    """test_provider_config_list — discovery.providers parsed correctly."""

    def test_provider_config_list(self, config_yaml: Path) -> None:
        settings = load_settings(config_path=config_yaml)

        assert len(settings.discovery.providers) == 1
        provider = settings.discovery.providers[0]
        assert provider.name == "duckduckgo"
        assert provider.enabled is True
        assert provider.rate_limit.requests_per_second == 5.0
        assert provider.rate_limit.burst == 10

    def test_multiple_providers(self, tmp_path: Path, tmp_data_dir: Path) -> None:
        config_path = tmp_path / "multi_providers.yaml"
        config_path.write_text(
            yaml.dump(
                {
                    "app": {"data_dir": tmp_data_dir.as_posix()},
                    "discovery": {
                        "providers": [
                            {"name": "google", "enabled": True},
                            {"name": "bing", "enabled": False, "rate_limit": {"requests_per_second": 1.0, "burst": 2}},
                            {"name": "duckduckgo"},
                        ]
                    },
                }
            )
        )
        settings = load_settings(config_path=config_path)

        assert len(settings.discovery.providers) == 3
        assert settings.discovery.providers[0].name == "google"
        assert settings.discovery.providers[1].enabled is False
        assert settings.discovery.providers[1].rate_limit.burst == 2
        assert settings.discovery.providers[2].name == "duckduckgo"
        # Default rate limit for provider without explicit one
        assert settings.discovery.providers[2].rate_limit.requests_per_second == 2.0


class TestFrozenSettings:
    """Settings instances should be immutable (frozen)."""

    def test_frozen(self, config_yaml: Path) -> None:
        settings = load_settings(config_path=config_yaml)
        with pytest.raises(Exception):
            settings.app = None  # type: ignore[assignment]
