"""Shared fixtures for backend tests.

All tests are offline: no real Gemini API calls are made. The route is tested
with a fake AIProvider, and the Gemini provider is tested with a fake SDK
client.
"""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import deps, main  # noqa: E402
from app.config import Settings  # noqa: E402
from app.deps import RateLimiter  # noqa: E402


def make_settings(**overrides) -> Settings:
    values = {
        "_env_file": None,
        "GEMINI_API_KEY": "test-key-not-real",
        "GEMINI_MODEL": "test-model",
        "GEMINI_TIMEOUT_SECONDS": 5.0,
        "GEMINI_MAX_OUTPUT_TOKENS": 256,
        "CORS_ORIGINS": "",
        "MAX_REQUEST_BODY_BYTES": 4096,
        "RATE_LIMIT_REQUESTS_PER_MINUTE": 1000,
    }
    values.update(overrides)
    return Settings(**values)


@pytest.fixture
def configure(monkeypatch):
    """Install explicit test settings without reading a developer's .env file."""

    def _configure(**overrides) -> Settings:
        settings = make_settings(**overrides)
        monkeypatch.setattr(main, "get_settings", lambda: settings)
        monkeypatch.setattr(deps, "get_settings", lambda: settings)
        return settings

    return _configure


@pytest.fixture(autouse=True)
def reset_runtime_state():
    main._provider = None
    deps._rate_limiter = RateLimiter(max_requests=1000)
    yield
    main._provider = None
    deps._rate_limiter = RateLimiter(max_requests=1000)


@pytest.fixture
def client():
    with TestClient(main.app) as test_client:
        yield test_client
