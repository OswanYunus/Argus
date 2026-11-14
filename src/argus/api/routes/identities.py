"""Identity and verification status endpoints."""

from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, HTTPException

from argus.api.auth import verify_api_key
from argus.core.db import IdentityRepository, get_db
from argus.core.models import IdentityResponse

router = APIRouter(prefix="/investigations/{investigation_id}/identities", tags=["identities"])


@router.get("", response_model=list[IdentityResponse])
async def list_identities(
    investigation_id: str,
    _auth: str = Depends(verify_api_key),
) -> Any:
    db = await get_db()
    repo = IdentityRepository(db)
    identities = await repo.list_by_investigation(investigation_id)

    results: list[IdentityResponse] = []
    for ident in identities:
        signals = await repo.get_signals(ident.id)
        links = await repo.get_links(investigation_id)
        relevant_links = [l for l in links if l.identity_a_id == ident.id or l.identity_b_id == ident.id]

        results.append(
            IdentityResponse(
                id=ident.id,
                investigation_id=ident.investigation_id,
                identity_type=ident.identity_type,
                canonical_value=ident.canonical_value,
                display_name=ident.display_name,
                is_target=ident.is_target,
                confidence=ident.confidence,
                confidence_explanation=ident.confidence_explanation,
                verification_status=ident.verification_status,
                first_seen_at=ident.first_seen_at,
                created_at=ident.created_at,
                updated_at=ident.updated_at,
                signal_count=len(signals),
                link_count=len(relevant_links),
            )
        )
    return results


@router.get("/{identity_id}/signals")
async def get_identity_signals(
    investigation_id: str,
    identity_id: str,
    _auth: str = Depends(verify_api_key),
) -> list[dict[str, Any]]:
    db = await get_db()
    repo = IdentityRepository(db)
    signals = await repo.get_signals(identity_id)
    return [s.model_dump() for s in signals]
