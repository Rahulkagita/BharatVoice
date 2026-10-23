"""Backend configuration loaded from environment variables.

Real values live in ``backend/.env`` (gitignored). ``backend/.env.example``
contains placeholders only and is safe to commit.
"""

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Google Gemini API key — read from environment only, never hard-coded.
    GEMINI_API_KEY: str = ""

    # Gemini model name.
    GEMINI_MODEL: str = "gemini-1.5-flash"

    # Upstream Gemini call timeout in seconds.
    GEMINI_TIMEOUT_SECONDS: int = 30

    # Allowed CORS origins. In production list the exact chrome-extension://<id>
    # origin. Do not use "*" in production.
    CORS_ORIGINS: str = ""

    # Maximum request body size in bytes (default ~4 KB).
    MAX_REQUEST_BODY_BYTES: int = 4096

    # Simple in-memory rate limit: max requests per minute per client IP.
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 30

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

    @property
    def cors_origin_list(self) -> List[str]:
        """Parse comma-separated CORS origins into a list, stripped of whitespace."""
        if not self.CORS_ORIGINS:
            return []
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()