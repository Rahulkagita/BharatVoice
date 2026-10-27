"""Request ID helpers shared by middleware and route handlers.

Request IDs are always generated on the server. Client-supplied identifiers are
ignored so they cannot be used for log injection or to spoof correlation.
"""

from uuid import uuid4

from fastapi import Request

REQUEST_ID_HEADER = "X-Request-ID"


def new_request_id() -> str:
    """Return a compact, URL/log-safe request identifier."""

    return uuid4().hex


def request_id_from_scope(scope: dict) -> str:
    """Read the request ID stored by the middleware, or generate a fallback."""

    state = scope.get("state") or {}
    return state.get("request_id") or new_request_id()


def request_id_from_request(request: Request) -> str:
    """Read the request ID from a FastAPI/Starlette request.

    The middleware is responsible for generating and storing the request ID.
    If it is missing, we log/handle defensively but avoid generating a new ID
    that would break correlation with middleware-set headers. However, for
    robustness in error paths, we still fall back safely.
    """

    request_id = getattr(request.state, "request_id", "")
    if request_id:
        return request_id
    # Try to get from scope if request.state wasn't populated
    scope = getattr(request, "scope", {}) or {}
    state = scope.get("state") or {}
    request_id = state.get("request_id", "")
    if request_id:
        return request_id
    # Last resort: generate a new ID. This should be rare and indicates
    # middleware ordering issues, but we must not crash.
    return new_request_id()
