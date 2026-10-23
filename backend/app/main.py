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
import time
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .deps import api_key_configured, rate_limit_allows
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


app = FastAPI(title="BharatVoice Backend", version="2.1.0")

settings = get_settings()

# CORS: allow only explicitly configured origins (never "*" in production).
if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["POST", "GET", "OPTIONS"],
        allow_headers=["content-type"],
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
    headers: Optional[dict[str, str]] = None,
) -> JSONResponse:
    """Build a consistent, safe ChatResponse-shaped error body."""
    body = ChatResponse(
        answer="",
        provider=PROVIDER_NAME,
        status="error",
        error=message,
    )
    return JSONResponse(status_code=status_code, content=body.model_dump(), headers=headers)


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
    logger.info("Request validation failed on %s", request.url.path)
    return _error_response(
        422,
        (
            "Invalid request. Send a non-empty message of at most "
            f"{MAX_MESSAGE_LENGTH} characters and language en, hi, or te."
        ),
    )


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Convert unexpected errors into safe responses without leaking internals."""
    # Log the exception type only. Exception text can contain user or provider
    # content, so it is deliberately never logged.
    logger.error("Unhandled error on %s (%s)", request.url.path, type(exc).__name__)
    return _error_response(
        500,
        "The assistant could not process your request. Please try again.",
    )


@app.middleware("http")
async def _request_size_and_timing_middleware(request: Request, call_next):
    """Enforce request body size limits and log request latency (no content)."""
    current_settings = get_settings()
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            if int(content_length) > current_settings.MAX_REQUEST_BODY_BYTES:
                return _error_response(
                    413,
                    f"Message is too long. Please keep it under {MAX_MESSAGE_LENGTH} characters.",
                )
        except ValueError:
            return _error_response(400, "Invalid Content-Length header.")

    start = time.monotonic()
    response = await call_next(request)
    duration_ms = int((time.monotonic() - start) * 1000)
    # Log only metadata, never message content.
    logger.info(
        "%s %s -> %s in %dms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


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
    if not api_key_configured():
        return _error_response(
            503,
            "The AI backend is not configured. Please contact the administrator.",
        )

    if not rate_limit_allows(request):
        return _error_response(
            429,
            "Too many requests. Please wait a moment and try again.",
            headers={"Retry-After": "60"},
        )

    try:
        provider = _get_provider()
        answer = await provider.generate(payload.message, payload.language)
    except ProviderError as exc:
        # Log only the safe category, never the provider's raw exception text.
        logger.warning("Provider failure on /api/chat: %s", exc.kind)
        status_code, message = _PROVIDER_ERROR_RESPONSES.get(
            exc.kind, _PROVIDER_ERROR_RESPONSES["unavailable"]
        )
        return _error_response(status_code, message)
    except Exception as exc:
        logger.error("Unexpected provider error on /api/chat (%s)", type(exc).__name__)
        return _error_response(
            502,
            "The AI assistant is temporarily unavailable. Please try again later.",
        )

    answer = (answer or "").strip()
    if not answer:
        return _error_response(
            502,
            "The AI assistant returned an empty response. Please try again.",
        )

    return ChatResponse(answer=answer, provider=PROVIDER_NAME, status="ok")


@app.get("/healthz")
async def health() -> dict:
    """Liveness check (no secrets, no message content)."""
    return {
        "status": "ok",
        "provider": PROVIDER_NAME,
        "configured": api_key_configured(),
    }
