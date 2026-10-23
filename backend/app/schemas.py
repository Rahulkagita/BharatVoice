"""Pydantic request/response schemas for the /api/chat endpoint."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

# Keep this in sync with the extension's input limit and the backend docs.
MAX_MESSAGE_LENGTH = 1000

LanguageCode = Literal["en", "hi", "te"]

MessageText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_MESSAGE_LENGTH),
]


class ChatRequest(BaseModel):
    message: MessageText = Field(
        ..., description="The user's current message (typed or recognized speech)."
    )
    language: LanguageCode = Field(
        default="en",
        description="Selected language code: en, hi, or te.",
    )


class ChatResponse(BaseModel):
    answer: str = Field(..., description="The assistant's reply in the selected language.")
    provider: str = Field(..., description="AI provider that generated the reply (e.g. 'gemini').")
    status: Literal["ok", "error"] = Field(
        ..., description="'ok' when successful; 'error' otherwise."
    )
    error: str | None = Field(
        default=None, description="Human-readable error message when status is 'error'."
    )
