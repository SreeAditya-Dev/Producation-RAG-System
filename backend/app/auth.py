import hmac
import logging
from typing import Optional

from fastapi import Header, HTTPException

from app.config import settings

logger = logging.getLogger(__name__)


def require_api_key(x_api_key: Optional[str] = Header(default=None)) -> str:
    """
    Shared API-key gate for sensitive REST endpoints (uploads, deletes, queries,
    observability). Fails closed if API_KEY isn't configured — a missing config
    value should never silently downgrade to "no auth" — and uses a constant-time
    comparison to avoid leaking key contents via timing.
    """
    if not settings.api_key:
        raise HTTPException(status_code=503, detail="Server authentication is not configured.")
    if not x_api_key or not hmac.compare_digest(x_api_key, settings.api_key):
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")
    return x_api_key


def verify_ws_key(token: Optional[str]) -> bool:
    """Validates the API key passed as a WebSocket query param (?key=...)."""
    if not settings.api_key or not token:
        return False
    return hmac.compare_digest(token, settings.api_key)
