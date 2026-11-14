"""Server-Sent Events (SSE) streaming for real-time investigation progress."""

from __future__ import annotations

import asyncio
from typing import AsyncGenerator
from fastapi import APIRouter
from starlette.responses import StreamingResponse

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/{investigation_id}")
async def stream_investigation_events(investigation_id: str) -> StreamingResponse:
    """Stream live updates for an investigation using Server-Sent Events."""

    async def event_generator() -> AsyncGenerator[str, None]:
        from argus.core.db import get_db
        db = await get_db()
        for _ in range(60):  # Stream heartbeat and task counts
            row = await db.fetch_one(
                "SELECT COUNT(*) as total_urls FROM discovered_urls WHERE investigation_id = ?",
                (investigation_id,),
            )
            count = row["total_urls"] if row else 0
            yield f"data: {{\"investigation_id\": \"{investigation_id}\", \"discovered_urls\": {count}}}\n\n"
            await asyncio.sleep(2.0)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
