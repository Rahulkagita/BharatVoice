# BharatVoice API contract (Phase 1)

This document describes the current backend contract. The goal for Phase 1 is
**groundwork only**: add request correlation and safe error handling without
forcing a breaking envelope change on existing clients.

## Authentication
- No user authentication. The backend is trusted to hold `GEMINI_API_KEY` in its
  environment only.
- If deployed publicly, put it behind an authenticated gateway or restrict access.

## Common response headers
All HTTP responses include `X-Request-ID`. The value is generated server-side
only; client-supplied `X-Request-ID` headers are ignored. Use it for support
correlation in logs (logs never include user messages or secrets).

## POST /api/chat
Send the current user message only. Conversation history is not uploaded.

### Request
```json
{
  "message": "string (non-empty, max 1000 chars)",
  "language": "en" | "hi" | "te"
}
```

### Success response (200)
The schema remains backward-compatible for existing consumers: existing fields
are preserved and only `request_id` was added.
```json
{
  "answer": "string",
  "provider": "gemini",
  "status": "ok",
  "error": null,
  "request_id": "hex-string"
}
```

### Error response (4xx/5xx)
Errors use the same shape as success responses (no new wrapper envelope) so the
extension client continues to parse them consistently.
```json
{
  "answer": "",
  "provider": "gemini",
  "status": "error",
  "error": "A safe, user-readable message",
  "request_id": "hex-string"
}
```

Notes:
- `error` is always a safe string; provider stack traces, raw diagnostics,
  secrets, and API keys are never returned.
- Validation failures (`422`) do not echo the submitted message.
- Provider/auth/config issues are mapped to safe messages (`502`/`503`).
- Rate-limited requests return `429` with `Retry-After: 60`.

## GET /healthz
Liveness/readiness check (no secrets, no message content).
```json
{
  "status": "ok",
  "provider": "gemini",
  "configured": true,
  "request_id": "hex-string"
}
```
`configured` reports whether `GEMINI_API_KEY` is present after trimming; it does
not test key validity or model availability.

## Request body limits
- Size limits are enforced by streaming the request body and counting actual
  bytes. `Content-Length` is not trusted: undersized or missing headers cannot
  bypass the limit. Oversized or chunked bodies are rejected with `413`.
- Default `MAX_REQUEST_BODY_BYTES` is `4096`. The error message references the
  byte limit.
- Invalid `Content-Length` values are rejected with `400`.

## CORS
Allowed origins must be exact (no `*`). The extension build rewrites
`manifest.json` and CSP to match the configured backend origin at build time.

## Migration notes (Phase 1)
- Add `request_id` to any client-side logging/telemetry if desired; it is safe
  to log.
- If you previously asserted exact health/chat JSON equality in tests, update
  them to accept the additional field.
- The proposed envelope `{success, data, request_id}` and `{success:false,...}`
  forms are **not** adopted in Phase 1; they remain future options if a public
  API version is needed.
