"""BharatVoice backend — FastAPI application.

Provides a single POST /api/chat endpoint that forwards the user's current
message to the configured AI provider (Google Gemini) and returns a structured
response.

Design constraints:
- No database, no user accounts, no analytics, no persistent conversation storage.
- Never logs user messages, speech transcripts, or AI responses.
- Never embeds or returns the API key.
- CORS restricted to explicitly allowed origins (no "*" in production).
- Request size limits, real upstream timeouts, input validation, basic rate limiting.
- Safe, consistent error responses without stack traces or internal configuration.
"""

import logging
import os
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .deps import api_key_configured, rate_limit_allows
from .middleware import BodySizeLimitMiddleware, RequestContextMiddleware
from .request_context import REQUEST_ID_HEADER, request_id_from_request
from .schemas import MAX_MESSAGE_LENGTH, ChatRequest, ChatResponse
from .services.ai_provider import AIProvider, ProviderError
from .services.gemini import build_gemini_provider

PROVIDER_NAME = "gemini"

_LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
if _LOG_LEVEL not in {"CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"}:
    _LOG_LEVEL = "INFO"
logging.basicConfig(
    level=_LOG_LEVEL,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("bharatvoice")

# Third-party libraries can emit request/response bodies at DEBUG. Keep them at
# WARNING regardless of LOG_LEVEL so user content and credentials cannot leak
# through SDK or HTTP-client logs.
for _noisy_logger in ("google_genai", "google.genai", "httpx", "httpcore"):
    logging.getLogger(_noisy_logger).setLevel(logging.WARNING)


app = FastAPI(title="BharatVoice Backend", version="2.2.0")

settings = get_settings()

# Middleware is added innermost first. CORS is added last so it is the
# outermost layer and can decorate early rejections (for example a 413) too.
app.add_middleware(
    BodySizeLimitMiddleware,
    max_bytes=lambda: get_settings().MAX_REQUEST_BODY_BYTES,
)
app.add_middleware(RequestContextMiddleware)

# CORS: allow only explicitly configured origins (never "*" in production).
if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["POST", "GET", "OPTIONS"],
        allow_headers=["content-type"],
        expose_headers=[REQUEST_ID_HEADER],
    )


# Reusable provider instance. Built lazily on first request so a missing API
# key surfaces as a clear 503 rather than a crash at import time.
_provider: Optional[AIProvider] = None


def _get_provider() -> AIProvider:
    global _provider
    if _provider is None:
        _provider = build_gemini_provider()
    return _provider


def _error_response(
    status_code: int,
    message: str,
    request_id: str,
    headers: Optional[dict[str, str]] = None,
) -> JSONResponse:
    """Build a consistent, safe ChatResponse-shaped error body."""
    body = ChatResponse(
        answer="",
        provider=PROVIDER_NAME,
        status="error",
        error=message,
        request_id=request_id,
    )
    response_headers = {REQUEST_ID_HEADER: request_id}
    if headers:
        response_headers.update(headers)
    return JSONResponse(
        status_code=status_code,
        content=body.model_dump(),
        headers=response_headers,
    )


_PROVIDER_ERROR_RESPONSES: dict[str, tuple[int, str]] = {
    "timeout": (
        504,
        "The AI assistant took too long to respond. Please try again.",
    ),
    "auth": (
        502,
        "The AI assistant is not configured correctly. Please contact the administrator.",
    ),
    "quota": (
        429,
        "The AI assistant is busy right now. Please wait a moment and try again.",
    ),
    "unavailable": (
        503,
        "The AI assistant is temporarily unavailable. Please try again later.",
    ),
    "empty": (
        502,
        "The AI assistant returned an empty response. Please try again.",
    ),
}


@app.exception_handler(RequestValidationError)
async def _validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Return a safe 422 body without echoing the submitted message."""
    request_id = request_id_from_request(request)
    logger.info(
        "Request validation failed on %s request_id=%s",
        request.url.path,
        request_id,
    )
    return _error_response(
        422,
        (
            "Invalid request. Send a non-empty message of at most "
            f"{MAX_MESSAGE_LENGTH} characters and language en, hi, or te."
        ),
        request_id,
    )


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Convert unexpected errors into safe responses without leaking internals."""
    request_id = request_id_from_request(request)
    # Log the exception type only. Exception text can contain user or provider
    # content, so it is deliberately never logged.
    logger.error(
        "Unhandled error on %s (%s) request_id=%s",
        request.url.path,
        type(exc).__name__,
        request_id,
    )
    return _error_response(
        500,
        "The assistant could not process your request. Please try again.",
        request_id,
    )


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: Request, payload: ChatRequest) -> ChatResponse | JSONResponse:
    """Handle a chat request from the extension.

    - Language is validated by the schema (en/hi/te only).
    - Rate-limits by client IP.
    - Requires a configured GEMINI_API_KEY (503 otherwise).
    - Forwards only the current user message (not full history) to the provider.
    - Returns a structured response; on provider failure returns a safe error
      message with an appropriate HTTP status.
    """
    request_id = request_id_from_request(request)

    if not api_key_configured():
        return _error_response(
            503,
            "The AI backend is not configured. Please contact the administrator.",
            request_id,
        )

    if not rate_limit_allows(request):
        return _error_response(
            429,
            "Too many requests. Please wait a moment and try again.",
            request_id,
            headers={"Retry-After": "60"},
        )

    try:
        provider = _get_provider()
        answer = await provider.generate(payload.message, payload.language)
    except ProviderError as exc:
        # Log only the safe category, never the provider's raw exception text.
        logger.warning(
            "Provider failure on /api/chat (%s) request_id=%s",
            exc.kind,
            request_id,
        )
        status_code, message = _PROVIDER_ERROR_RESPONSES.get(
            exc.kind, _PROVIDER_ERROR_RESPONSES["unavailable"]
        )
        return _error_response(status_code, message, request_id)
    except Exception as exc:
        logger.error(
            "Unexpected provider error on /api/chat (%s) request_id=%s",
            type(exc).__name__,
            request_id,
        )
        return _error_response(
            502,
            "The AI assistant is temporarily unavailable. Please try again later.",
            request_id,
        )

    answer = (answer or "").strip()
    if not answer:
        return _error_response(
            502,
            "The AI assistant returned an empty response. Please try again.",
            request_id,
        )

    return ChatResponse(
        answer=answer,
        provider=PROVIDER_NAME,
        status="ok",
        request_id=request_id,
    )


@app.get("/healthz")
async def health(request: Request) -> dict:
    """Liveness check (no secrets, no message content)."""
    return {
        "status": "ok",
        "provider": PROVIDER_NAME,
        "configured": api_key_configured(),
        "request_id": request_id_from_request(request),
    }
