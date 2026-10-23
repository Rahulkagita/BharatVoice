"""Offline tests for the Gemini provider.

A fake ``google-genai`` client replaces the real SDK client, so these tests
never read an API key or make a network request. They verify prompt/config
construction, safe error mapping, and that raw provider diagnostics never leak
through :class:`ProviderError`.
"""

import asyncio

import pytest
from google.genai import errors as genai_errors

from app.services import gemini
from app.services.ai_provider import ProviderError


class FakeResponse:
    def __init__(self, text: str | None) -> None:
        self.text = text


class FakeModels:
    def __init__(self, outcome) -> None:
        self.outcome = outcome
        self.calls: list[dict] = []

    async def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        if isinstance(self.outcome, BaseException):
            raise self.outcome
        if callable(self.outcome):
            return await self.outcome()
        return self.outcome


class FakeAio:
    def __init__(self, models: FakeModels) -> None:
        self.models = models


class FakeClient:
    """Minimal stand-in for ``google.genai.Client``."""

    def __init__(self, outcome=None, **client_kwargs) -> None:
        self.client_kwargs = client_kwargs
        self.models = FakeModels(outcome)
        self.aio = FakeAio(self.models)


@pytest.fixture
def fake_sdk(monkeypatch):
    """Install a fake SDK client and expose every client instance created."""
    created: list[FakeClient] = []

    def _install(outcome=None):
        def _factory(**kwargs):
            client = FakeClient(outcome=outcome, **kwargs)
            created.append(client)
            return client

        monkeypatch.setattr(gemini.genai, "Client", _factory)
        return created

    return _install


def _provider(timeout_seconds: float = 5.0) -> gemini.GeminiProvider:
    return gemini.GeminiProvider(
        api_key="offline-test-key",
        model_name="test-model",
        timeout_seconds=timeout_seconds,
        max_output_tokens=128,
    )


@pytest.mark.asyncio
async def test_success_uses_selected_language_and_system_instruction(fake_sdk):
    created = fake_sdk(FakeResponse("  नमस्ते  "))

    provider = _provider()
    answer = await provider.generate("What is this field?", "hi")

    assert answer == "नमस्ते"
    assert len(created) == 1
    call = created[0].models.calls[0]
    assert call["model"] == "test-model"
    assert "Hindi" in call["contents"]
    assert "What is this field?" in call["contents"]
    config = call["config"]
    assert config.system_instruction == gemini.SYSTEM_INSTRUCTION
    assert config.temperature == 0.3
    assert config.max_output_tokens == 128

    # The client must receive a real timeout and the key, never the reverse.
    http_options = created[0].client_kwargs["http_options"]
    assert http_options.timeout == 5000
    assert created[0].client_kwargs["api_key"] == "offline-test-key"


@pytest.mark.asyncio
async def test_empty_response_maps_to_empty(fake_sdk):
    fake_sdk(FakeResponse("   \n"))
    with pytest.raises(ProviderError) as exc_info:
        await _provider().generate("hello", "en")
    assert exc_info.value.kind == "empty"


@pytest.mark.asyncio
async def test_none_response_text_maps_to_empty(fake_sdk):
    fake_sdk(FakeResponse(None))
    with pytest.raises(ProviderError) as exc_info:
        await _provider().generate("hello", "en")
    assert exc_info.value.kind == "empty"


@pytest.mark.asyncio
async def test_sdk_timeout_exception_maps_to_timeout(fake_sdk):
    fake_sdk(asyncio.TimeoutError())
    with pytest.raises(ProviderError) as exc_info:
        await _provider().generate("hello", "en")
    assert exc_info.value.kind == "timeout"


@pytest.mark.asyncio
async def test_slow_call_is_cut_off_by_outer_timeout(fake_sdk):
    async def slow():
        await asyncio.sleep(1.0)
        return FakeResponse("too late")

    fake_sdk(slow)
    with pytest.raises(ProviderError) as exc_info:
        await _provider(timeout_seconds=0.01).generate("hello", "en")
    assert exc_info.value.kind == "timeout"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("api_error", "expected_kind"),
    [
        (
            genai_errors.APIError(
                429,
                {"error": {"code": 429, "status": "RESOURCE_EXHAUSTED", "message": "quota"}},
            ),
            "quota",
        ),
        (
            genai_errors.APIError(
                401,
                {"error": {"code": 401, "status": "UNAUTHENTICATED", "message": "bad key"}},
            ),
            "auth",
        ),
        (
            genai_errors.APIError(
                403,
                {"error": {"code": 403, "status": "PERMISSION_DENIED", "message": "denied"}},
            ),
            "auth",
        ),
        (
            genai_errors.APIError(
                404,
                {"error": {"code": 404, "status": "NOT_FOUND", "message": "model missing"}},
            ),
            "auth",
        ),
        (
            genai_errors.APIError(
                408,
                {"error": {"code": 408, "status": "DEADLINE_EXCEEDED", "message": "slow"}},
            ),
            "timeout",
        ),
        (
            genai_errors.APIError(
                500,
                {"error": {"code": 500, "status": "INTERNAL", "message": "sensitive"}},
            ),
            "unavailable",
        ),
    ],
)
async def test_api_errors_map_to_safe_categories(fake_sdk, api_error, expected_kind):
    fake_sdk(api_error)
    with pytest.raises(ProviderError) as exc_info:
        await _provider().generate("hello", "en")
    assert exc_info.value.kind == expected_kind
    # ProviderError exposes only the category, never SDK response text.
    assert "sensitive" not in str(exc_info.value)
    assert "bad key" not in str(exc_info.value)


@pytest.mark.asyncio
async def test_unexpected_exception_maps_to_unavailable(fake_sdk):
    fake_sdk(RuntimeError("raw diagnostic with user content"))
    with pytest.raises(ProviderError) as exc_info:
        await _provider().generate("hello", "en")
    assert exc_info.value.kind == "unavailable"
    assert "raw diagnostic" not in str(exc_info.value)


def test_missing_api_key_is_rejected_at_construction():
    with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
        gemini.GeminiProvider(api_key="", model_name="test-model")
