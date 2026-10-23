"""Request-level dependencies and abuse protection.

- Verifies the Gemini API key is configured before handling requests.
- Simple in-memory per-client-IP rate limiter (no database, no external state).
"""
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException, Request, status

from .config import get_settings


class RateLimiter:
    """Token-bucket-ish sliding window limiter keyed by client IP."""

    def __init__(self, max_requests: int, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)

    def allow(self, client_id: str) -> bool:
        now = time.monotonic()
        window_start = now - self.window_seconds
        hits = self._hits[client_id]
        # Drop hits outside the window.
        while hits and hits[0] < window_start:
            hits.popleft()
        if len(hits) >= self.max_requests:
            return False
        hits.append(now)
        return True


_rate_limiter = RateLimiter(
    max_requests=get_settings().RATE_LIMIT_REQUESTS_PER_MINUTE
)


def require_api_key() -> None:
    """Raise 503 if the backend is not configured with a Gemini API key."""
    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The AI backend is not configured. Please contact the administrator.",
        )


def rate_limit(request: Request) -> None:
    """Apply a simple per-IP rate limit; raise 429 when exceeded."""
    client_id = request.client.host if request.client else "unknown"
    if not _rate_limiter.allow(client_id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please wait a moment and try again.",
        )