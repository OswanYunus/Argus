"""Investigation management REST endpoints."""

from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Response, status

from argus.api.auth import verify_api_key
from argus.core.db import Database, InvestigationRepository, RunRepository, UrlRepository
from argus.core.models import (
    CreateInvestigationRequest,
    InvestigationResponse,
    InvestigationSummary,
)
from argus.orchestration.investigation import InvestigationManager

router = APIRouter(prefix="/investigations", tags=["investigations"])


def get_manager(db: Database) -> InvestigationManager:
    from argus.core.config import get_settings
    settings = get_settings()
    return InvestigationManager(db=db, storage_base_dir=settings.app.data_dir / "investigations")


@router.post("", response_model=InvestigationResponse, status_code=status.HTTP_201_CREATED)
async def create_investigation(
    req: CreateInvestigationRequest,
    _auth: str = Depends(verify_api_key),
) -> Any:
    from argus.core.db import get_db
    db = await get_db()
    mgr = get_manager(db)
    inv = await mgr.create_investigation(
        name=req.name,
        target_name=req.target_name,
        description=req.description or "",
        target_signals=req.target_signals,
        config=req.config or {},
    )
    return inv


@router.get("", response_model=list[InvestigationSummary])
async def list_investigations(_auth: str = Depends(verify_api_key)) -> Any:
    from argus.core.db import get_db
    db = await get_db()
    repo = InvestigationRepository(db)
    invs = await repo.list_all(include_deleted=False)
    return [
        InvestigationSummary(
            id=i.id,
            name=i.name,
            target_name=i.target_name,
            status=i.status,
            created_at=i.created_at,
            updated_at=i.updated_at,
        )
        for i in invs
    ]


@router.get("/{investigation_id}", response_model=InvestigationResponse)
async def get_investigation(
    investigation_id: str,
    _auth: str = Depends(verify_api_key),
) -> Any:
    from argus.core.db import get_db
    db = await get_db()
    repo = InvestigationRepository(db)
    inv = await repo.get(investigation_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return inv


@router.post("/{investigation_id}/run")
async def trigger_run(
    investigation_id: str,
    _auth: str = Depends(verify_api_key),
) -> dict[str, Any]:
    from argus.core.db import get_db
    db = await get_db()
    mgr = get_manager(db)
    run = await mgr.run_investigation(investigation_id)
    return {
        "status": "completed",
        "run_id": run.id,
        "run_number": run.run_number,
        "stats": run.stats,
    }


@router.post("/{investigation_id}/rescan")
async def trigger_rescan(
    investigation_id: str,
    _auth: str = Depends(verify_api_key),
) -> dict[str, Any]:
    from argus.core.db import get_db
    db = await get_db()
    mgr = get_manager(db)
    stats = await mgr.rescan_investigation(investigation_id)
    return {
        "status": "completed",
        "rescan_stats": stats,
    }


@router.delete("/{investigation_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def purge_investigation(
    investigation_id: str,
    _auth: str = Depends(verify_api_key),
) -> Response:
    from argus.core.db import get_db
    db = await get_db()
    mgr = get_manager(db)
    await mgr.purge_investigation(investigation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{investigation_id}/urls")
async def get_investigation_urls(
    investigation_id: str,
    _auth: str = Depends(verify_api_key),
) -> list[dict[str, Any]]:
    from argus.core.db import get_db
    db = await get_db()
    rows = await db.fetch_all(
        "SELECT * FROM discovered_urls WHERE investigation_id = ? ORDER BY first_seen_at DESC",
        (investigation_id,),
    )
    return rows


@router.get("/{investigation_id}/graph")
async def get_investigation_graph(
    investigation_id: str,
    _auth: str = Depends(verify_api_key),
) -> list[dict[str, Any]]:
    from argus.core.db import get_db
    db = await get_db()
    mgr = get_manager(db)
    return await mgr.relationships.get_cytoscape_elements(investigation_id)


@router.get("/{investigation_id}/resources")
async def get_investigation_resources(
    investigation_id: str,
    _auth: str = Depends(verify_api_key),
) -> dict[str, float]:
    from argus.core.db import get_db, ResourceUsageRepository
    db = await get_db()
    repo = ResourceUsageRepository(db)
    return await repo.get_summary_by_investigation(investigation_id)
