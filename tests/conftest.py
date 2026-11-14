"""Shared test fixtures for ARGUS test suite."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import AsyncGenerator, Generator

import pytest
import pytest_asyncio

# Ensure test environment
os.environ.setdefault("ARGUS_MASTER_KEY", "")
os.environ.setdefault("ARGUS_LLM_API_KEY", "test-key-not-real")
os.environ.setdefault("ARGUS_API_KEY", "test-api-key-not-real")


@pytest.fixture
def tmp_data_dir(tmp_path: Path) -> Path:
    """Create a temporary data directory for tests."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    (data_dir / "investigations").mkdir()
    return data_dir


@pytest.fixture
def config_yaml(tmp_data_dir: Path, tmp_path: Path) -> Path:
    """Create a minimal test config.yaml."""
    config_path = tmp_path / "config.yaml"
    config_path.write_text(f"""
app:
  name: "ARGUS-TEST"
  data_dir: "{tmp_data_dir.as_posix()}"
  log_level: "DEBUG"

database:
  path: "{(tmp_data_dir / 'test.db').as_posix()}"
  wal_mode: true
  busy_timeout_ms: 1000

collection:
  max_concurrent_requests: 2
  request_timeout_seconds: 5
  max_document_size_mb: 10
  respect_robots_txt: true
  user_agent: "ARGUS-TEST/1.0"
  default_rate_limit:
    requests_per_second: 10.0
    burst: 20

discovery:
  max_recursion_depth: 1
  max_urls_per_query: 10
  max_total_urls: 100
  providers:
    - name: "duckduckgo"
      enabled: true
      rate_limit:
        requests_per_second: 5.0
        burst: 10

analysis:
  llm_provider: "deepseek"
  llm_model: "deepseek-chat"
  llm_base_url: "https://api.deepseek.com/v1"
  max_tokens_per_call: 1024
  max_llm_calls_per_run: 10
  min_relevance_for_analysis: 0.3

entity_resolution:
  min_signals_for_likely: 2
  min_signals_for_verified: 3
  single_signal_max_confidence: 0.4
  confidence_decay_days: 180

pipeline:
  max_concurrent_tasks: 5
  task_timeout_seconds: 30
  max_retries: 1
  budget:
    max_http_requests: 100
    max_llm_calls: 10
    max_document_bytes: 10000000

api:
  host: "127.0.0.1"
  port: 8888
""")
    return config_path
