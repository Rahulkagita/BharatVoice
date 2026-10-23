# BharatVoice Stage 2 — Backend

Separate Python/FastAPI backend for the BharatVoice Chrome extension. Provides a
single `POST /api/chat` endpoint that forwards the user's message to Google
Gemini and returns a structured response.

## Security & privacy design

- The Gemini API key is read **only** from the `GEMINI_API_KEY` environment
  variable. It is never embedded in frontend code, extension files, or git-tracked
  configuration, and never returned in API responses.
- User messages and AI responses are **not logged**.
- No database, no user accounts, no analytics, no persistent conversation
  storage.
- CORS is restricted to explicitly allowed origins (the extension's
  `chrome-extension://<id>`). Do not use `"*"` in production.
- Request body size limits, timeouts, input validation, and a simple in-memory
  per-IP rate limiter are enforced.
- Error messages are safe: no stack traces, no internal configuration, no API
  keys.

## Prerequisites

- Python 3.10+
- A Gemini API key from https://aistudio.google.com/app/apikey

## Setup

```bash
# From the repository root
cd backend

# Create a virtual environment (recommended)
python -m venv .venv
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set:
#   GEMINI_API_KEY=your_real_key
#   CORS_ORIGINS=chrome-extension://<your-extension-id>
```

## Running locally

```bash
# From backend/, with the virtual environment activated
uvicorn app.main:app --reload --port 8000
```

The API is then available at `http://localhost:8000`.

- `POST /api/chat` with JSON body `{"message": "...", "language": "en"}`.
- `GET /healthz` for a liveness check.

## Configure the extension to call the backend

The extension reads its backend base URL from the Vite environment variable
`VITE_BACKEND_URL` (defaults to `http://localhost:8000` for local development).

For local development with an unpacked extension:

1. Load the extension's `dist/` folder in Chrome (`chrome://extensions` → Load
   unpacked). Note the extension's ID shown on that page.
2. Add that origin to `backend/.env`:
   ```
   CORS_ORIGINS=chrome-extension://abcdefghijklmnopqrstuvwxyz
   ```
3. Rebuild the extension (`npm run build`) so the manifest picks up the
   `host_permissions` and CSP `connect-src` for the backend origin, then reload
   the extension in Chrome.

## Environment variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `GEMINI_API_KEY` | Google Gemini API key (required) | `AIza...` |
| `GEMINI_MODEL` | Gemini model name | `gemini-1.5-flash` |
| `GEMINI_TIMEOUT_SECONDS` | Upstream call timeout | `30` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `chrome-extension://<id>` |
| `MAX_REQUEST_BODY_BYTES` | Max request body (~4 KB default) | `4096` |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | Per-IP rate limit | `30` |
| `LOG_LEVEL` | Backend log level | `INFO` |

## Tests

```bash
pip install pytest pytest-asyncio httpx
pytest
```

Tests cover request validation, supported/unsupported languages, missing API
key, provider errors/timeouts, empty/over-long messages, and safe error
handling.

## Files not to commit

- `backend/.env` — contains the real API key (gitignored).
- `backend/.venv/` or `venv/` — virtual environment (gitignored).