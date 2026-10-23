"""Tests for the /api/chat route and /healthz.

The provider is always faked so the suite never needs an API key or network
access.
"""

import logging

from app import deps, main
from app.deps import RateLimiter
from app.schemas import MAX_MESSAGE_LENGTH
from app.services.ai_provider import ProviderError


class FakeProvider:
    def __init__(self, answer: str = "Test answer", error: Exception | None = None) -> None:
        self.answer = answer
        self.error = error
        self.calls: list[tuple[str, str]] = []

    async def generate(self, message: str, language: str) -> str:
        self.calls.append((message, language))
        if self.error is not None:
            raise self.error
        return self.answer


def _post(client, message: str, language: str = "en"):
    return client.post("/api/chat", json={"message": message, "language": language})


def _assert_error_shape(response, status_code: int) -> dict:
    assert response.status_code == status_code
    body = response.json()
    assert body["status"] == "error"
    assert body["answer"] == ""
    assert body["provider"] == "gemini"
    assert isinstance(body["error"], str) and body["error"]
    return body


def test_health_without_api_key(client, configure):
    configure(GEMINI_API_KEY="")
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "provider": "gemini", "configured": False}


def test_health_does_not_expose_api_key(client, configure):
    secret = "test-key-should-never-appear"
    configure(GEMINI_API_KEY=secret)
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["configured"] is True
    assert secret not in response.text


def test_whitespace_api_key_counts_as_not_configured(client, configure):
    configure(GEMINI_API_KEY="   ")
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["configured"] is False


def test_successful_chat(client, configure):
    configure()
    provider = FakeProvider(answer="నమస్తే, ఇది పరీక్ష.")
    main._provider = provider

    response = _post(client, "What is this form?", "te")

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "answer": "నమస్తే, ఇది పరీక్ష.",
        "provider": "gemini",
        "status": "ok",
        "error": None,
    }
    assert provider.calls == [("What is this form?", "te")]


def test_only_current_message_is_forwarded(client, configure):
    configure()
    provider = FakeProvider()
    main._provider = provider

    _post(client, "current message only", "hi")

    assert provider.calls == [("current message only", "hi")]


def test_unsupported_language_is_rejected(client, configure):
    configure()
    main._provider = FakeProvider()

    response = _post(client, "hello", "fr")

    body = _assert_error_shape(response, 422)
    assert "en, hi, or te" in body["error"]
    assert "fr" not in response.text


def test_empty_message_is_rejected(client, configure):
    configure()
    main._provider = FakeProvider()

    body = _assert_error_shape(_post(client, ""), 422)
    assert "non-empty" in body["error"]


def test_whitespace_only_message_is_rejected(client, configure):
    configure()
    main._provider = FakeProvider()

    _assert_error_shape(_post(client, "   \n\t  "), 422)


def test_oversized_message_is_rejected(client, configure):
    configure()
    main._provider = FakeProvider()

    body = _assert_error_shape(_post(client, "x" * (MAX_MESSAGE_LENGTH + 1)), 422)
    assert str(MAX_MESSAGE_LENGTH) in body["error"]


def test_malformed_json_is_rejected_safely(client, configure):
    configure()
    main._provider = FakeProvider()

    response = client.post(
        "/api/chat",
        content="{not valid json",
        headers={"content-type": "application/json"},
    )

    _assert_error_shape(response, 422)


def test_oversized_body_is_rejected(client, configure):
    configure(MAX_REQUEST_BODY_BYTES=512)
    main._provider = FakeProvider()

    response = _post(client, "x" * 2000)

    _assert_error_shape(response, 413)


def test_missing_api_key_returns_503_without_calling_provider(client, configure):
    configure(GEMINI_API_KEY="")
    provider = FakeProvider()
    main._provider = provider

    body = _assert_error_shape(_post(client, "hello"), 503)
    assert "not configured" in body["error"]
    assert provider.calls == []


def test_provider_timeout_returns_504(client, configure):
    configure()
    main._provider = FakeProvider(error=ProviderError("timeout"))

    body = _assert_error_shape(_post(client, "hello"), 504)
    assert "too long" in body["error"]


def test_provider_auth_failure_returns_safe_502(client, configure):
    configure()
    main._provider = FakeProvider(error=ProviderError("auth"))

    body = _assert_error_shape(_post(client, "hello"), 502)
    assert "configured correctly" in body["error"]
    assert "key" not in response_text(body).lower()


def test_provider_quota_failure_returns_429(client, configure):
    configure()
    main._provider = FakeProvider(error=ProviderError("quota"))

    body = _assert_error_shape(_post(client, "hello"), 429)
    assert "busy" in body["error"]


def test_provider_unavailable_returns_503(client, configure):
    configure()
    main._provider = FakeProvider(error=ProviderError("unavailable"))

    _assert_error_shape(_post(client, "hello"), 503)


def test_empty_provider_response_returns_502(client, configure):
    configure()
    main._provider = FakeProvider(answer="   ")

    body = _assert_error_shape(_post(client, "hello"), 502)
    assert "empty response" in body["error"]


def test_unexpected_provider_error_returns_safe_502(client, configure):
    configure()
    main._provider = FakeProvider(error=RuntimeError("sensitive provider diagnostic"))

    body = _assert_error_shape(_post(client, "hello"), 502)
    assert "sensitive provider diagnostic" not in body["error"]


def test_rate_limit(client, configure):
    configure()
    main._provider = FakeProvider()
    deps._rate_limiter = RateLimiter(max_requests=2)

    assert _post(client, "one").status_code == 200
    assert _post(client, "two").status_code == 200

    response = _post(client, "three")
    body = _assert_error_shape(response, 429)
    assert "Too many requests" in body["error"]
    assert response.headers.get("retry-after") == "60"


def test_logs_do_not_include_secrets_or_user_content(client, configure, caplog):
    api_key = "test-key-not-real"
    user_message = "My Aadhaar is 1234-5678-9012 and my password is hunter2"
    answer = "This generated answer must not be logged."

    configure(GEMINI_API_KEY=api_key)
    main._provider = FakeProvider(answer=answer)

    with caplog.at_level(logging.INFO):
        response = _post(client, user_message)

    assert response.status_code == 200
    assert user_message not in caplog.text
    assert answer not in caplog.text
    assert api_key not in caplog.text
    assert "1234-5678-9012" not in caplog.text
    assert "hunter2" not in caplog.text


def response_text(body: dict) -> str:
    return " ".join(str(value) for value in body.values())
