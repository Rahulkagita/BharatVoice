"""BharatVoice Stage 2 backend — FastAPI application.

Provides a single POST /api/chat endpoint that forwards the user's message to
the configured AI provider (Google Gemini) and returns a structured response.

Design constraints:
- No database, no user accounts, no analytics, no persistent conversation storage.
- Never logs user messages or AI responses.
- Never embeds or returns the API key.
- CORS restricted to explicitly allowed origins (no "*" in production).
- Request size limits, timeouts, input validation, basic rate limiting.
- Safe error messages without stack traces or internal configuration.
"""

import logging
import os
import time
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .deps import RateLimiter, require_api_key, rate_limit
from .schemas import ChatRequest, ChatResponse
from .services.ai_provider import AIProvider
from .services.gemini import build_gemini_provider

logger = logging.getLogger("bharatvoice")
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))

app = FastAPI(title="BharatVoice Backend", version="2.0.0")

settings = get_settings()

# CORS: allow only explicitly configured origins (never "*" in production).
if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["POST"],
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


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception):
    """Convert unexpected errors into safe responses without leaking internals."""
    logger.error("Unhandled error: %s", exc)
    return JSONResponse(
        status_code=500,
        content=ChatResponse(
            answer="",
            provider="gemini",
            status="error",
            error="The assistant could not process your request. Please try again.",
        ).model_dump(),
    )


@app.middleware("http")
async def _request_size_and_timing_middleware(request: Request, call_next):
    """Enforce request body size limits and add request latency logging (no content logged)."""
    # Body size guard: read Content-Length when available.
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            if int(content_length) > settings.MAX_REQUEST_BODY_BYTES:
                return JSONResponse(
                    status_code=413,
                    content=ChatResponse(
                        answer="",
                        provider="gemini",
                        status="error",
                        error="Message is too long. Please keep it under 1000 characters.",
                    ).model_dump(),
                )
        except ValueError:
            pass

    start = time.monotonic()
    response = await call_next(request)
    duration_ms = int((time.monotonic() - start) * 1000)
    # Log only metadata, never message content.
    logger.info("%s %s -> %s in %dms", request.method, request.url.path, response.status_code, duration_ms)
    return response


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: Request, payload: ChatRequest) -> ChatResponse:
    """Handle a chat request from the extension.

    - Validates language is one of en/hi/te.
    - Rate-limits by client IP.
    - Requires a configured GEMINI_API_KEY (503 otherwise).
    - Forwards only the current user message (not full history) to the provider.
    - Returns a structured response; on provider failure returns status="error"
      with a safe user-facing message.
    """
    # Language validation — supported set matches the extension.
    supported_languages = {"en", "hi", "te"}
    if payload.language not in supported_languages:
        return ChatResponse(
            answer="",
            provider="gemini",
            status="error",
            error=f"Unsupported language '{payload.language}'. Use en, hi, or te.",
        )

    require_api_key()
    rate_limit(request)

    provider: AIProvider = _get_provider()
    try:
        answer = await provider.generate(payload.message, payload.language)
    except HTTPException:
        raise
    except Exception as exc:  # provider timeout, network, auth, quota, etc.
        logger.error("Provider error: %s", exc)
        return ChatResponse(
            answer="",
            provider="gemini",
            status="error",
            error="The AI assistant is temporarily unavailable. Please try again later.",
        )

    return ChatResponse(answer=answer, provider="gemini", status="error" if not answer else "ok")


@app.get("/healthz")
async def health() -> dict:
    """Liveness check (no secrets, no message content)."""
    return {"status": "ok", "provider": "gemini", "configured": bool(settings.GEMINI_API_KEY)}