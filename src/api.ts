/**
 * BharatVoice backend HTTP client.
 *
 * The extension talks exclusively to a self-hosted backend (FastAPI) which in
 * turn calls Google Gemini. The provider API key never leaves the backend and
 * is never embedded in extension code or bundles.
 *
 * The backend origin is injected at build time by vite.config.ts. Only the
 * current user message is sent, not the full conversation history.
 */

export type LanguageCode = 'en' | 'hi' | 'te';

export interface ChatResponse {
  answer: string;
  provider: string;
  status: 'ok' | 'error';
  error: string | null;
}

export type BackendErrorKind =
  | 'network'
  | 'timeout'
  | 'rate_limit'
  | 'unavailable'
  | 'provider'
  | 'validation'
  | 'cancelled';

/** Backend failure categories surfaced to the user as safe, generic messages. */
export class BackendError extends Error {
  readonly kind: BackendErrorKind;
  constructor(kind: BackendErrorKind, message: string) {
    super(message);
    this.name = 'BackendError';
    this.kind = kind;
  }
}

/** Backend origin injected by Vite. It is a bare origin (no trailing slash). */
export const BACKEND_URL = __BACKEND_URL__.replace(/\/$/, '');

/**
 * Browser-side deadline. Kept slightly longer than the backend's default
 * GEMINI_TIMEOUT_SECONDS (30 s) so the backend can return a specific 504
 * instead of the browser giving up first.
 */
const REQUEST_TIMEOUT_MS = 35_000;

function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError';
}

/** Map backend HTTP statuses to user-facing error categories. */
function kindForStatus(status: number): BackendErrorKind {
  if (status === 422) return 'validation';
  if (status === 429) return 'rate_limit';
  if (status === 503) return 'unavailable';
  return 'provider';
}

export interface SendChatOptions {
  /** Lets the UI cancel an in-flight request (stop, clear, language change). */
  signal?: AbortSignal;
}

/**
 * Send the user's message to the configured backend.
 * Returns a structured response; throws BackendError on transport failure.
 */
export async function sendChat(
  message: string,
  language: LanguageCode,
  options: SendChatOptions = {}
): Promise<ChatResponse> {
  const controller = new AbortController();
  let timedOut = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const onExternalAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

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
        detail = typeof body.error === 'string' ? body.error : '';
      } catch {
        /* ignore malformed error bodies */
      }
      const kind = kindForStatus(res.status);
      throw new BackendError(
        kind,
        detail || `The assistant backend responded with status ${res.status}.`
      );
    }

    let data: ChatResponse;
    try {
      data = (await res.json()) as ChatResponse;
    } catch {
      throw new BackendError(
        'provider',
        'The assistant backend sent an invalid response. Please try again.'
      );
    }

    return {
      answer: typeof data.answer === 'string' ? data.answer : '',
      provider: typeof data.provider === 'string' ? data.provider : 'gemini',
      status: data.status === 'ok' ? 'ok' : 'error',
      error: typeof data.error === 'string' ? data.error : null,
    };
  } catch (err) {
    if (controller.signal.aborted) {
      if (timedOut) {
        throw new BackendError(
          'timeout',
          'The assistant took too long to respond. Please try again.'
        );
      }
      throw new BackendError('cancelled', 'The request was cancelled.');
    }
    if (err instanceof BackendError) throw err;
    if (isAbortError(err)) {
      throw new BackendError('cancelled', 'The request was cancelled.');
    }
    // DNS failure, connection refused, CORS block, etc.
    throw new BackendError(
      'network',
      'Unable to reach the assistant backend. Check your connection and try again.'
    );
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}
