"""Validation tests for backend settings (offline, no .env file)."""

import pytest
from pydantic import ValidationError

from app.config import Settings


def _settings(**overrides) -> Settings:
    values = {"_env_file": None}
    values.update(overrides)
    return Settings(**values)


def test_whitespace_api_key_is_treated_as_missing():
    settings = _settings(GEMINI_API_KEY="   \n\t ")
    assert settings.GEMINI_API_KEY == ""


def test_empty_model_is_rejected():
    with pytest.raises(ValidationError):
        _settings(GEMINI_MODEL="  ")


def test_timeout_must_be_in_range():
    with pytest.raises(ValidationError):
        _settings(GEMINI_TIMEOUT_SECONDS=0)
    with pytest.raises(ValidationError):
        _settings(GEMINI_TIMEOUT_SECONDS=121)


def test_cors_wildcard_is_rejected():
    with pytest.raises(ValidationError):
        _settings(CORS_ORIGINS="*")


def test_cors_origin_must_be_bare():
    with pytest.raises(ValidationError):
        _settings(CORS_ORIGINS="chrome-extension://abc/path")
    with pytest.raises(ValidationError):
        _settings(CORS_ORIGINS="https://example.com?x=1")


def test_cors_origin_list_is_stripped():
    settings = _settings(
        CORS_ORIGINS=" chrome-extension://abc, https://api.example.com "
    )
    assert settings.cors_origin_list == [
        "chrome-extension://abc",
        "https://api.example.com",
    ]


def test_output_tokens_must_be_in_range():
    with pytest.raises(ValidationError):
        _settings(GEMINI_MAX_OUTPUT_TOKENS=31)
    with pytest.raises(ValidationError):
        _settings(GEMINI_MAX_OUTPUT_TOKENS=4097)
