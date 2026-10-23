"""Pydantic request/response schemas for the /api/chat endpoint."""

from pydantic import BaseModel, Field, constr


# Supported languages mirror the extension's LanguageCode type.
class ChatRequest(BaseModel):
    message: constr(strip_whitespace=True, min_length=1, max_length=1000) = Field(
        ..., description="The user's message (typed or recognized speech)."
    )
    language: str = Field(
        default="en",
        description="Selected language code: en, hi, or te.",
    )


class ChatResponse(BaseModel):
    answer: str = Field(..., description="The assistant's reply in the selected language.")
    provider: str = Field(..., description="AI provider that generated the reply (e.g. 'gemini').")
    status: str = Field(..., description="'ok' when successful; 'error' otherwise.")
    error: str | None = Field(default=None, description="Human-readable error message when status is 'error'.")