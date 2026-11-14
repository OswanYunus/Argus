"""Authentication dependency for ARGUS REST API."""

from __future__ import annotations

import os
from typing import Optional

from fastapi import Header, HTTPException, status


async def verify_api_key(x_api_key: Optional[str] = Header(None)) -> str:
    """Validate X-API-Key header against ARGUS_API_KEY environment setting if configured."""
    expected_key = os.environ.get("ARGUS_API_KEY", "").strip()
    if not expected_key:
        # If no API key configured, permit authorized local research
        return "local_dev"

    if not x_api_key or x_api_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key in X-API-Key header.",
        )

    return x_api_key
