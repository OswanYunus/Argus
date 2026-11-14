"""E2E / Integration tests for the ARGUS REST API endpoints."""

from __future__ import annotations

from pathlib import Path
import pytest
from httpx import ASGITransport, AsyncClient

from argus.api.main import create_app
from argus.core.config import get_settings
from argus.core.db import close_db, init_db


@pytest.fixture
async def api_client(tmp_path: Path):
    """Test client configured against an in-memory database."""
    settings = get_settings()
    test_db_path = tmp_path / "api_test.db"

    app = create_app()
    await init_db(test_db_path, wal_mode=False)

    transport = ASGITransport(app=app)
    headers = {"X-API-Key": "test-api-key-not-real"}
    async with AsyncClient(transport=transport, base_url="http://test", headers=headers) as client:
        yield client

    await close_db()


@pytest.mark.asyncio
async def test_health_check(api_client: AsyncClient):
    """Test health check returns 200 and healthy status."""
    resp = await api_client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_create_and_list_investigation_api(api_client: AsyncClient):
    """Test creating an investigation and retrieving summaries."""
    payload = {
        "name": "API Footprint Scan",
        "description": "Authorized audit via API",
        "target_name": "Marcus Wright",
        "target_signals": {"emails": ["marcus@resistance.org"]},
    }
    resp = await api_client.post("/api/v1/investigations", json=payload)
    assert resp.status_code == 201
    created = resp.json()
    assert created["name"] == "API Footprint Scan"
    assert created["target_name"] == "Marcus Wright"
    inv_id = created["id"]

    # List investigations
    list_resp = await api_client.get("/api/v1/investigations")
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert len(items) >= 1
    assert any(i["id"] == inv_id for i in items)

    # Fetch detail
    detail_resp = await api_client.get(f"/api/v1/investigations/{inv_id}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["target_signals"]["emails"] == ["marcus@resistance.org"]

    # Graph endpoint
    graph_resp = await api_client.get(f"/api/v1/investigations/{inv_id}/graph")
    assert graph_resp.status_code == 200
    assert isinstance(graph_resp.json(), list)

    # Purge
    del_resp = await api_client.delete(f"/api/v1/investigations/{inv_id}")
    assert del_resp.status_code == 204

    # Detail now 404
    missing_resp = await api_client.get(f"/api/v1/investigations/{inv_id}")
    assert missing_resp.status_code == 404
