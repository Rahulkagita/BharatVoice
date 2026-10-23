# BharatVoice Backend

FastAPI backend for the BharatVoice Chrome extension. It provides:

- `POST /api/chat` — validates a message/language, calls Google Gemini through
  the official `google-genai` SDK, and returns a structured answer.
- `GET /healthz` — liveness and whether a Gemini key is configured.

The extension calls this service directly. The Gemini API key never leaves the
backend and is never embedded in extension code.

## Architecture and request flow

```text
Chrome side panel
  └── POST /api/chat { "message": "...", "language": "en|hi|te" }
            │
            ▼
      FastAPI route
        ├── validate size / message / language
        ├── check GEMINI_API_KEY
        ├── in-memory per-IP rate limit
        └── GeminiProvider
              └── google-genai → Google Gemini API
            │
            ▼
      { answer, provider, status, error }
```

Only the current message is accepted; there is no conversation-history field.
The backend is stateless and stores no messages.

## Requirements

- Python 3.10+
- A Gemini API key: <https://aistudio.google.com/app/apikey>

The default model is `gemini-3.5-flash-lite`, selected as a current free-tier
model at the time of writing. Model availability and quota depend on your Google
account. Override with `GEMINI_MODEL` if needed. A `gemini-3.8-flash` model may
be available with a lower free daily quota; this project does not guarantee free
tier access.

## Windows PowerShell setup

```powershell
cd E:\BharatVoice\backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
notepad .env
```

If PowerShell blocks activation, run
`Set-ExecutionPolicy -Scope Process Bypass` in that terminal, or skip activation
and use `.\.venv\Scripts\python.exe` for every command.

Edit `backend/.env`:

```dotenv
GEMINI_API_KEY=your_real_key
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_TIMEOUT_SECONDS=30
GEMINI_MAX_OUTPUT_TOKENS=512
MAX_REQUEST_BODY_BYTES=4096
RATE_LIMIT_REQUESTS_PER_MINUTE=30

# Exact origin of the loaded extension. Replace the ID.
CORS_ORIGINS=chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef
```

`backend/.env` is gitignored. `.env.example` contains placeholders only. Never
commit a real key.

### Where to get the extension ID

1. Build the extension (`npm run build` at the repository root).
2. Load `E:\BharatVoice\dist` at `chrome://extensions` with Developer mode on.
3. Copy the ID shown on the BharatVoice card.
4. Put `chrome-extension://<id>` in `CORS_ORIGINS`.
5. Restart uvicorn.

If you load the extension from a different path later, its unpacked ID can
change, so update CORS.

## Running

```powershell
cd E:\BharatVoice\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Without activation:

```powershell
cd E:\BharatVoice\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health check:

```powershell
Invoke-RestMethod http://localhost:8000/healthz | ConvertTo-Json
```

```json
{ "status": "ok", "provider": "gemini", "configured": true }
```

`configured` reports whether the key string is present. It does not prove the key
or model works; send one real chat request to verify provider access.

### Chat example

```powershell
$body = @{ message = "What does this form field mean?"; language = "en" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/chat `
  -ContentType "application/json" -Body $body | ConvertTo-Json
```

Success:

```json
{
  "answer": "…",
  "provider": "gemini",
  "status": "ok",
  "error": null
}
```

Errors use the same shape with `status: "error"`, `answer: ""`, and a safe
message in `error`.

## Configuration

| Variable | Default | Notes |
|----------|---------|-------|
| `GEMINI_API_KEY` | empty | Required for chat. Missing/whitespace-only returns 503. |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Must be a model your key can use. |
| `GEMINI_TIMEOUT_SECONDS` | `30` | (0, 120]; applied to the SDK HTTP client and `asyncio.wait_for`. |
| `GEMINI_MAX_OUTPUT_TOKENS` | `512` | 32-4096; keeps replies suitable for text-to-speech. |
| `CORS_ORIGINS` | empty | Exact comma-separated origins. `*`, paths, and queries are rejected. |
| `MAX_REQUEST_BODY_BYTES` | `4096` | 256-1000000. |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | `30` | 1-10000, per client IP, in-process. |
| `LOG_LEVEL` | `INFO` | `CRITICAL`, `ERROR`, `WARNING`, `INFO`, or `DEBUG`. |

Settings are loaded from `backend/.env` using a path relative to the application
files, so uvicorn behaves the same whether started from the repository root or
from `backend/`.

## API and error behavior

- `message` is required, stripped, non-empty, and at most 1000 characters.
- `language` must be `en`, `hi`, or `te`; unknown values return 422.
- Request bodies larger than `MAX_REQUEST_BODY_BYTES` return 413.
- Missing key returns 503.
- Local rate limit returns 429 with `Retry-After: 60`.
- Provider quota returns 429; provider timeout returns 504; auth and empty
  responses return 502; provider unavailability returns 503.
- Unexpected exceptions return a safe 500/502 body with no stack trace.
- Validation and error responses never echo the submitted message.
- `answer` is stripped; empty provider output is treated as an error.

The provider system instruction requires the selected language, simple concise
language, no invented official details, no claim of verification or real-world
actions, no requests for OTPs/passwords/Aadhaar/bank data, and no legal,
financial, or medical advice. These are safety instructions, not guarantees.

## Security and privacy

- The API key is read only from `GEMINI_API_KEY`; it is never returned, logged,
  or written to the extension.
- No database, accounts, analytics, cookies, or persistent conversation storage.
- Only request metadata (method, path, status, latency) and safe error categories
  are logged. Message content, replies, transcripts, API keys, and raw provider
  exception text are not logged.
- CORS is restricted to explicitly configured origins. There is no wildcard
  fallback.
- Per-client-IP rate limiting reduces accidental abuse but is not a security
  boundary. It is process-local and resets on restart.
- The backend is not authenticated. Do not expose it publicly without an
  authenticated gateway, additional rate limiting, and HTTPS.
- Requests are not end-to-end encrypted by this code; use HTTPS in deployment.
  Plain HTTP is for loopback development only.
- If behind a reverse proxy, client-IP rate limiting requires trusted forwarded
  headers/configuration; this app uses the direct socket client by default.

## Tests

Install test dependencies and run from `backend/`:

```powershell
cd E:\BharatVoice\backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest
```

The suite is fully offline. It fakes the FastAPI provider and the
`google-genai` client, so no key or network access is required. It covers:

- health with/without a key and no key leakage;
- successful chat and current-message-only forwarding;
- language validation, empty/whitespace/oversized/malformed JSON, body limits;
- missing key, provider timeout/auth/quota/unavailable/empty/unexpected errors;
- rate limiting and safe log output;
- Gemini prompt/system-instruction construction, SDK timeout behavior, and safe
  mapping of SDK errors.

Live Gemini behavior is intentionally not automated because it requires a real
key, quota, and model access. Verify manually with a real request.

Import check:

```powershell
.\.venv\Scripts\python.exe -c "import app.main; print('import ok')"
```

## Deployment notes

1. Use HTTPS for any non-loopback deployment.
2. Set `CORS_ORIGINS` to the exact extension origin(s); do not use `*`.
3. Put the service behind an authenticated gateway if it is internet-facing.
4. Use a shared rate limiter/API gateway for multiple workers or replicas.
5. Keep `backend/.env` out of containers/images and source control; inject
   `GEMINI_API_KEY` through the deployment secret mechanism.
6. Rebuild the extension with the public backend origin using
   `BHARATVOICE_BACKEND_URL` and reload it.
7. Monitor error rates and Gemini quota, not message content.

The in-memory limiter works per process. With `--workers 4`, each worker allows
its own quota, so effective limits multiply.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `/healthz` says `configured: false` | `.env` missing, key empty/whitespace, or backend not restarted after editing. |
| `503` "not configured" on chat | Set `GEMINI_API_KEY` and restart. |
| `502` "not configured correctly" | Key invalid/revoked, or the key cannot access `GEMINI_MODEL`. Test the key in AI Studio and change the model. |
| `429` from Gemini | Free-tier or rate quota exhausted. Wait or check AI Studio quota/billing. |
| Browser reports CORS | Add the exact `chrome-extension://<id>` origin and restart. IDs change if the unpacked path changes. |
| Extension cannot connect | Backend not running, wrong backend URL baked into `dist/`, or stale extension. Rebuild/reload. |
| `uvicorn` not found | Activate `.venv` or run `python -m uvicorn`. |
| Port in use | Use `--port 8001` and rebuild the extension with the matching URL. |
| Empty answer errors | Provider returned no text; retry or check model/quota. |

## Related documentation

- Repository setup, extension loading, privacy/data flow, and manual Chrome
  checks: `../README.md`.
- Frontend build-time backend URL and CSP/host-permission rewrite:
  `../vite.config.ts`.
