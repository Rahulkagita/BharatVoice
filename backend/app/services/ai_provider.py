"""Abstract interface for AI providers.

Keeping provider integration isolated behind this interface lets another
provider be evaluated later without rewriting the /api/chat endpoint.
"""

from typing import Protocol, runtime_checkable


class ProviderError(RuntimeError):
    """A provider failure categorised into a safe, route-level error kind.

    ``kind`` is deliberately limited to values the route knows how to translate
    into a safe user-facing message. Provider exception text is never exposed to
    the client or written to logs.
    """

    def __init__(self, kind: str) -> None:
        self.kind = kind
        super().__init__(f"provider error: {kind}")


@runtime_checkable
class AIProvider(Protocol):
    """Port for generating a chat completion."""

    async def generate(self, message: str, language: str) -> str:
        """Return the assistant's reply for ``message`` in ``language``.

        Raises :class:`ProviderError` (or a subclass) when the provider is
        unavailable or the request fails. Callers translate exceptions into
        safe, user-facing error messages.
        """
        ...
