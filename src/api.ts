/**
 * BharatVoice Stage 2 — backend HTTP client.
 *
 * The extension talks exclusively to a self-hosted backend (FastAPI) which in
 * turn calls Google Gemini. The provider API key never leaves the backend and
 * is never embedded in extension code or bundles.
 *
 * Only the current user message is sent (not the full conversation history).
 * All message content is rendered as plain text by the UI — never as HTML.
 */

export type LanguageCode = 'en' | 'hi' | 'te';

export interface ChatResponse {
  answer: string;
  provider: string;
  status: 'ok' | 'error';
  error: string | null;
}

/** Backend failure categories surfaced to the user as safe, generic messages. */
export class BackendError extends Error {
  readonly kind: 'network' | 'timeout' | 'provider' | 'validation';
  constructor(kind: 'network' | 'timeout' | 'provider' | 'validation', message: string) {
    super(message);
    this.name = 'BackendError';
    this.kind = kind;
  }
}

/** Backend base URL. Configurable at build time via VITE_BACKEND_URL. */
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000').replace(/\/$/, '');

/** Upstream call timeout (matches the backend's GEMINI_TIMEOUT_SECONDS). */
const REQUEST_TIMEOUT_MS = 30000;

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Send the user's message to the configured backend.
 * Returns a structured response; throws BackendError on transport failure.
 */
export async function sendChat(message: string, language: LanguageCode): Promise<ChatResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, language }),
      signal: controller.signal,
    });

    // Non-2xx responses from the backend already carry safe user-facing
    // messages (validation, rate-limit, unavailable). Surface them as-is.
    if (!res.ok) {
      let detail = '';
      try {
        const body = (await res.json()) as Partial<ChatResponse>;
        detail = body.error ?? '';
      } catch {
        /* ignore malformed error bodies */
      }
      throw new BackendError('provider', detail || `Backend responded with status ${res.status}`);
    }

    const data = (await res.json()) as ChatResponse;
    return {
      answer: String(data.answer ?? ''),
      provider: String(data.provider ?? 'gemini'),
      status: data.status === 'ok' ? 'ok' : 'error',
      error: data.error ?? null,
    };
  } catch (err) {
    if (isAbortError(err)) {
      throw new BackendError('timeout', 'The assistant took too long to respond. Please try again.');
    }
    if (err instanceof BackendError) throw err;
    // DNS failure, connection refused, CORS block, etc.
    throw new BackendError('network', 'Unable to reach the assistant backend. Check your connection and try again.');
  } finally {
    clearTimeout(timeoutId);
  }
}