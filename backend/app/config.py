"""Backend configuration loaded from environment variables.

Real values live in ``backend/.env`` (gitignored). ``backend/.env.example``
contains placeholders only and is safe to commit.

The ``.env`` path is resolved relative to this file, not the process working
directory, so the backend behaves the same whether it is started from the
repository root or from ``backend/``.
"""

from functools import lru_cache
from pathlib import Path
from typing import List
from urllib.parse import urlparse

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # Google Gemini API key — read from environment only, never hard-coded.
    # It is intentionally optional at import time so health checks and tests can
    # run without a real key. Requests fail safely with 503 when it is missing.
    GEMINI_API_KEY: str = ""

    # Gemini model name. Defaults to a current free-tier model; override with
    # GEMINI_MODEL if your API key has access to a different model.
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"

    # Real upstream timeout in seconds (applied to the SDK HTTP client and to
    # an asyncio.wait_for guard).
    GEMINI_TIMEOUT_SECONDS: float = 30.0

    # Response-length cap. Keeps answers concise and suitable for TTS.
    GEMINI_MAX_OUTPUT_TOKENS: int = 512

    # Allowed CORS origins. In production list the exact chrome-extension://<id>
    # origin. Do not use "*" in production.
    CORS_ORIGINS: str = ""

    # Maximum request body size in bytes (default ~4 KB).
    MAX_REQUEST_BODY_BYTES: int = 4096

    # Simple in-memory rate limit: max requests per minute per client IP.
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 30

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("GEMINI_API_KEY")
    @classmethod
    def _normalise_api_key(cls, value: str) -> str:
        # Whitespace-only values from a bad .env must not count as configured.
        return value.strip()

    @field_validator("GEMINI_MODEL")
    @classmethod
    def _validate_model(cls, value: str) -> str:
        model = value.strip()
        if not model:
            raise ValueError("GEMINI_MODEL must not be empty")
        return model

    @field_validator("GEMINI_TIMEOUT_SECONDS")
    @classmethod
    def _validate_timeout(cls, value: float) -> float:
        if value <= 0 or value > 120:
            raise ValueError("GEMINI_TIMEOUT_SECONDS must be greater than 0 and at most 120")
        return float(value)

    @field_validator("GEMINI_MAX_OUTPUT_TOKENS")
    @classmethod
    def _validate_max_tokens(cls, value: int) -> int:
        if value < 32 or value > 4096:
            raise ValueError("GEMINI_MAX_OUTPUT_TOKENS must be between 32 and 4096")
        return value

    @field_validator("MAX_REQUEST_BODY_BYTES")
    @classmethod
    def _validate_body_size(cls, value: int) -> int:
        if value < 256 or value > 1_000_000:
            raise ValueError("MAX_REQUEST_BODY_BYTES must be between 256 and 1000000")
        return value

    @field_validator("RATE_LIMIT_REQUESTS_PER_MINUTE")
    @classmethod
    def _validate_rate_limit(cls, value: int) -> int:
        if value < 1 or value > 10_000:
            raise ValueError("RATE_LIMIT_REQUESTS_PER_MINUTE must be between 1 and 10000")
        return value

    @field_validator("CORS_ORIGINS")
    @classmethod
    def _validate_cors_origins(cls, value: str) -> str:
        origins = [origin.strip() for origin in value.split(",") if origin.strip()]
        for origin in origins:
            if origin == "*":
                raise ValueError("CORS_ORIGINS must not contain '*'")
            parsed = urlparse(origin)
            if parsed.scheme not in {"http", "https", "chrome-extension"} or not parsed.netloc:
                raise ValueError(f"Invalid CORS origin: {origin!r}")
            if parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
                raise ValueError(f"CORS origins must be bare origins: {origin!r}")
        return value

    @property
    def cors_origin_list(self) -> List[str]:
        """Parse comma-separated CORS origins into a list, stripped of whitespace."""
        if not self.CORS_ORIGINS:
            return []
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
