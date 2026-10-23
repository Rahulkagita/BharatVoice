"""Abstract interface for AI providers.

Keeping provider integration isolated behind this interface lets another
provider be evaluated later without rewriting the /api/chat endpoint.
"""

from abc import ABC, abstractmethod
from typing import Protocol, runtime_checkable


@runtime_checkable
class AIProvider(Protocol):
    """Port for generating a chat completion."""

    async def generate(self, message: str, language: str) -> str:
        """Return the assistant's reply for ``message`` in ``language``.

        Raises :class:`RuntimeError` (or a subclass) when the provider is
        unavailable or the request fails. Callers translate exceptions into
        safe, user-facing error messages.
        """
        ...