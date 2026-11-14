"""Intelligence findings and timeline endpoints."""

from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends

from argus.api.auth import verify_api_key
from argus.core.db import FindingRepository, get_db
from argus.core.models import FindingResponse

router = APIRouter(prefix="/investigations/{investigation_id}/findings", tags=["findings"])


@router.get("", response_model=list[FindingResponse])
async def list_findings(
    investigation_id: str,
    _auth: str = Depends(verify_api_key),
) -> Any:
    db = await get_db()
    repo = FindingRepository(db)
    findings = await repo.list_by_investigation(investigation_id)

    responses: list[FindingResponse] = []
    for f in findings:
        sources = await repo.get_sources(f.id)
        responses.append(
            FindingResponse(
                id=f.id,
                investigation_id=f.investigation_id,
                identity_id=f.identity_id,
                finding_type=f.finding_type,
                category=f.category,
                summary=f.summary,
                detail=f.detail,
                confidence=f.confidence,
                confidence_explanation=f.confidence_explanation,
                temporal_date=f.temporal_date,
                temporal_precision=f.temporal_precision,
                is_new=f.is_new,
                supersedes_id=f.supersedes_id,
                created_at=f.created_at,
                updated_at=f.updated_at,
                sources=sources,
            )
        )
    return responses


@router.get("/timeline")
async def get_timeline(
    investigation_id: str,
    _auth: str = Depends(verify_api_key),
) -> list[dict[str, Any]]:
    """Return chronological findings with temporal dates."""
    db = await get_db()
    rows = await db.fetch_all(
        """
        SELECT f.*, s.url as source_url, s.excerpt
        FROM findings f
        LEFT JOIN finding_sources s ON f.id = s.finding_id
        WHERE f.investigation_id = ? AND f.temporal_date IS NOT NULL
        ORDER BY f.temporal_date ASC
        """,
        (investigation_id,),
    )
    return rows
