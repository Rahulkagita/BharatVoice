"""Google Gemini AI provider implementation.

Isolated behind the :class:`AIProvider` protocol so a different provider can
be swapped in later without touching the /api/chat endpoint.

Never logs user messages or AI responses. The API key is read exclusively
from the GEMINI_API_KEY environment variable.
"""

import os
from typing import Optional

import google.generativeai as genai

# System instruction: shapes assistant behavior without web browsing, RAG,
# scheme databases, or automated government access.
SYSTEM_INSTRUCTION = (
    "You are BharatVoice, a helpful multilingual accessibility assistant for "
    "Indian citizens using government websites. "
    "Rules: "
    "1) Reply in the same language the user used (English, Hindi, or Telugu). "
    "2) Use simple, accessible language. "
    "3) Explain government-related terminology clearly. "
    "4) Distinguish general information from verified official information. "
    "5) Never claim that a scheme, eligibility rule, deadline, or benefit has "
    "been officially verified unless you actually have reliable supporting "
    "sources. "
    "6) Admit uncertainty and encourage users to consult the relevant official "
    "government source when appropriate. "
    "7) Never request Aadhaar numbers, OTPs, passwords, bank details, or other "
    "unnecessary sensitive information. "
    "8) Never claim to submit applications, check private government records, "
    "or perform actions you cannot perform. "
    "9) Never invent official URLs, scheme details, or eligibility rules. "
    "Keep responses concise and suitable for a Chrome side panel read aloud by "
    "speech synthesis."
)


class GeminiProvider:
    def __init__(self, api_key: str, model_name: str = "gemini-1.5-flash") -> None:
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured on the backend.")
        genai.configure(api_key=api_key)
        self._model = genai.GenerativeModel(model_name, system_instruction=SYSTEM_INSTRUCTION)

    async def generate(self, message: str, language: str) -> str:
        # google-generativeai's generate_content is synchronous; run in the
        # default executor so FastAPI's event loop is not blocked.
        import asyncio

        loop = asyncio.get_running_loop()

        def _call() -> str:
            prompt = f"User language hint: {language}\n\nUser message: {message}"
            response = self._model.generate_content(prompt)
            text = getattr(response, "text", None)
            if not text:
                raise RuntimeError("The AI provider returned an empty response.")
            return text

        return await loop.run_in_executor(None, _call)


def build_gemini_provider(api_key: Optional[str] = None, model_name: Optional[str] = None) -> GeminiProvider:
    """Factory used by the route layer; keeps configuration out of the route itself."""
    key = api_key or os.environ.get("GEMINI_API_KEY", "")
    model = model_name or os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
    return GeminiProvider(api_key=key, model_name=model)