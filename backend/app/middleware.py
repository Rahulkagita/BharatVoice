"""ASGI middleware for request correlation and request-body limits.

The body limiter deliberately counts the actual stream rather than trusting
``Content-Length``. To enforce the limit correctly, it buffers the request
body up to the configured limit (rejecting when exceeded) before forwarding
it downstream, so oversized or chunked bodies are rejected even when headers
are missing or understated. For valid requests under the limit, the entire
body is buffered in memory for replay.
"""

import logging
import time
from typing import Callable

from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse

from .request_context import REQUEST_ID_HEADER, new_request_id, request_id_from_scope

logger = logging.getLogger("bharatvoice")


class RequestContextMiddleware:
    """Assign a server-generated request ID and log request metadata only."""

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = new_request_id()
        scope.setdefault("state", {})["request_id"] = request_id
        start = time.monotonic()
        status_code = 500

        async def send_with_request_id(message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                headers = MutableHeaders(scope=message)
                if REQUEST_ID_HEADER not in headers:
                    headers.append(REQUEST_ID_HEADER, request_id)
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            duration_ms = int((time.monotonic() - start) * 1000)
            logger.info(
                "%s %s -> %s in %dms request_id=%s",
                scope.get("method", ""),
                scope.get("path", ""),
                status_code,
                duration_ms,
                request_id,
            )


class BodySizeLimitMiddleware:
    """Reject bodies larger than a configured limit, including chunked bodies."""

    def __init__(self, app, max_bytes: Callable[[], int]) -> None:
        self.app = app
        self._max_bytes = max_bytes

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http" or scope.get("method") not in {"POST", "PUT", "PATCH"}:
            await self.app(scope, receive, send)
            return

        limit = self._max_bytes()
        request_id = request_id_from_scope(scope)
        headers = Headers(scope=scope)
        content_length_values = headers.getlist("content-length")

        if content_length_values:
            if len(content_length_values) > 1:
                await self._reject(
                    scope,
                    receive,
                    send,
                    request_id,
                    400,
                    "Invalid Content-Length header.",
                )
                return
            content_length = content_length_values[0]
            try:
                declared_length = int(content_length)
            except (TypeError, ValueError):
                await self._reject(
                    scope, receive, send, request_id, 400, "Invalid Content-Length header."
                )
                return
            if declared_length < 0:
                await self._reject(
                    scope, receive, send, request_id, 400, "Invalid Content-Length header."
                )
                return
            if declared_length > limit:
                await self._reject_too_large(scope, receive, send, request_id, limit)
                return

        body = bytearray()
        try:
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                if message["type"] != "http.request":
                    # Pass through unexpected message types without consuming unexpectedly
                    # but we need to be careful not to break ASGI flow.
                    # For http.request we expect body chunks.
                    if message.get("more_body", False):
                        continue
                    break
                chunk = message.get("body", b"") or b""
                if len(body) + len(chunk) > limit:
                    await self._reject_too_large(scope, receive, send, request_id, limit)
                    return
                body.extend(chunk)
                if not message.get("more_body", False):
                    break
        except Exception:
            # If reading fails due to disconnect or other errors, do not hang;
            # attempt to reject safely if possible, otherwise return.
            try:
                await self._reject(
                    scope,
                    receive,
                    send,
                    request_id,
                    400,
                    "Invalid request body.",
                )
            except Exception:
                return
            return

        replayed = False

        async def replay_body():
            nonlocal replayed
            if not replayed:
                replayed = True
                return {
                    "type": "http.request",
                    "body": bytes(body),
                    "more_body": False,
                }
            # If downstream tries to read again, signal end
            return {"type": "http.request", "body": b"", "more_body": False}

        try:
            await self.app(scope, replay_body, send)
        except Exception:
            # If downstream fails, ensure we don't leak details
            raise

    async def _reject_too_large(
        self, scope, receive, send, request_id: str, limit: int
    ) -> None:
        await self._reject(
            scope,
            receive,
            send,
            request_id,
            413,
            f"Request body is too large. The current limit is {limit} bytes.",
        )

    async def _reject(
        self,
        scope,
        receive,
        send,
        request_id: str,
        status_code: int,
        message: str,
    ) -> None:
        # Import lazily to avoid a circular import while the app is assembled.
        from .schemas import ChatResponse

        body = ChatResponse(
            answer="",
            provider="gemini",
            status="error",
            error=message,
            request_id=request_id,
        ).model_dump()
        response = JSONResponse(
            status_code=status_code,
            content=body,
            headers={REQUEST_ID_HEADER: request_id},
        )
        await response(scope, receive, send)
