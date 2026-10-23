"""Request-level dependencies and abuse protection.

- Reports whether the Gemini API key is configured.
- Simple in-memory per-client-IP rate limiter (no database, no external state).

Limitations of the rate limiter: it lives in this process only. Multiple
uvicorn workers or multiple backend instances each keep their own counters, so
it is not a shared/distributed rate limit. It is a development safeguard, not
a substitute for an API gateway or shared store in production.
"""

import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import Request

from .config import get_settings


class RateLimiter:
    """Sliding-window limiter keyed by client IP."""

    def __init__(self, max_requests: int, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()
        self._last_cleanup = time.monotonic()

    def allow(self, client_id: str) -> bool:
        now = time.monotonic()
        window_start = now - self.window_seconds
        with self._lock:
            hits = self._hits[client_id]
            # Drop hits outside the window.
            while hits and hits[0] < window_start:
                hits.popleft()
            if len(hits) >= self.max_requests:
                return False
            hits.append(now)
            self._cleanup(now, window_start)
            return True

    def _cleanup(self, now: float, window_start: float) -> None:
        """Periodically drop empty client buckets to bound memory use."""
        if now - self._last_cleanup < max(self.window_seconds, 60):
            return
        self._last_cleanup = now
        stale = [key for key, hits in self._hits.items() if not hits or hits[-1] < window_start]
        for key in stale:
            del self._hits[key]


def api_key_configured() -> bool:
    """Return True when a Gemini API key is present. Never returns the value."""
    return bool(get_settings().GEMINI_API_KEY)


def get_client_id(request: Request) -> str:
    """Return the client IP. Behind a proxy, configure trusted forwarded headers."""
    return request.client.host if request.client else "unknown"


_rate_limiter = RateLimiter(max_requests=get_settings().RATE_LIMIT_REQUESTS_PER_MINUTE)


def get_rate_limiter() -> RateLimiter:
    return _rate_limiter


def rate_limit_allows(request: Request) -> bool:
    """Apply the per-IP rate limit and return False when it is exceeded."""
    return get_rate_limiter().allow(get_client_id(request))
