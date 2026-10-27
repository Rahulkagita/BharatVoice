import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackendError, sendChat } from './api';

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  } as unknown as Response;
}

function malformedResponse(status: number, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => {
      throw new SyntaxError('invalid JSON');
    },
  } as unknown as Response;
}

describe('sendChat', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends only the current message and language', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        200,
        {
          answer: 'నమస్తే',
          provider: 'gemini',
          status: 'ok',
          error: null,
          request_id: 'req-1',
        },
        { 'x-request-id': 'req-1' }
      )
    );

    const result = await sendChat('ఇది ఏ ఫారమ్?', 'te');

    expect(result).toEqual({
      answer: 'నమస్తే',
      provider: 'gemini',
      status: 'ok',
      error: null,
      request_id: 'req-1',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8000/api/chat');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      message: 'ఇది ఏ ఫారమ్?',
      language: 'te',
    });
  });

  it('falls back to the X-Request-ID header when the body omits it', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        200,
        { answer: 'ok', provider: 'gemini', status: 'ok', error: null },
        { 'x-request-id': 'header-only-id' }
      )
    );

    const result = await sendChat('hello', 'en');

    expect(result.request_id).toBe('header-only-id');
  });

  it('surfaces safe backend errors with their request ID', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        422,
        {
          answer: '',
          provider: 'gemini',
          status: 'error',
          error: 'Invalid request. Send a non-empty message.',
          request_id: 'req-422',
        },
        { 'x-request-id': 'req-422' }
      )
    );

    const error = await sendChat('', 'en').catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BackendError);
    const backendError = error as BackendError;
    expect(backendError.kind).toBe('validation');
    expect(backendError.requestId).toBe('req-422');
    expect(backendError.message).toBe('Invalid request. Send a non-empty message.');
  });

  it('keeps the request ID from the header when an error body is malformed', async () => {
    fetchMock.mockResolvedValue(
      malformedResponse(503, { 'x-request-id': 'req-header-503' })
    );

    const error = await sendChat('hello', 'en').catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BackendError);
    const backendError = error as BackendError;
    expect(backendError.kind).toBe('unavailable');
    expect(backendError.requestId).toBe('req-header-503');
    expect(backendError.message).toContain('status 503');
  });

  it('reports an invalid success body without exposing it', async () => {
    fetchMock.mockResolvedValue(
      malformedResponse(200, { 'x-request-id': 'req-invalid' })
    );

    const error = await sendChat('hello', 'en').catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BackendError);
    const backendError = error as BackendError;
    expect(backendError.kind).toBe('provider');
    expect(backendError.requestId).toBe('req-invalid');
    expect(backendError.message).toContain('invalid response');
  });

  it('maps transport failures to a safe network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await sendChat('hello', 'en').catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BackendError);
    const backendError = error as BackendError;
    expect(backendError.kind).toBe('network');
    expect(backendError.requestId).toBeNull();
    expect(backendError.message).not.toContain('Failed to fetch');
  });
});
