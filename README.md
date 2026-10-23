# BharatVoice

BharatVoice is a multilingual, voice-first Chrome extension that helps people
understand Indian government websites and forms. A React/TypeScript side panel
handles text and browser speech, while a small FastAPI backend calls Google
Gemini to generate replies. The extension never contains a provider API key.

## Architecture

```text
Chrome side panel (React + TypeScript)
  ├── typed text or browser SpeechRecognition
  ├── POST /api/chat  { message, language }  ─────────────┐
  │                                                       │
  └── browser speechSynthesis reads the reply             │
                                                          ▼
                                             FastAPI backend (Python)
                                               └── google-genai ──► Gemini API
```

- Only the **current message** and language code are sent to the backend; chat
  history is not uploaded.
- The backend is stateless. It does not use a database, accounts, analytics, or
  persistent conversation storage, and it does not log message or reply content.
- `GEMINI_API_KEY` exists only in the backend environment.
- The extension's `host_permissions` and CSP `connect-src` are generated from the
  configured backend origin at build time. No wildcard host permission is used.

### Repository layout

```text
BharatVoice/
├── src/
│   ├── api.ts                    # Typed backend client, timeout + cancellation
│   ├── locales.ts                # English / Hindi / Telugu UI strings
│   ├── voice/speech.ts           # SpeechRecognition / speechSynthesis wrappers
│   ├── hooks/useSpeech.ts        # Voice lifecycle and cancellation
│   ├── background/               # Manifest V3 service worker
│   ├── sidepanel/                # React side-panel app and components
│   └── assistant.ts              # Unused legacy demo responses (not wired in)
├── public/
│   ├── manifest.json             # Source manifest; rewritten in dist/
│   └── icons/
├── backend/
│   ├── app/                      # FastAPI app, config, schemas, Gemini provider
│   ├── tests/                    # Offline API and provider tests
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── .env.example
├── .env.example                  # Backend URL used at extension build time
├── vite.config.ts                # Build, URL validation, manifest/CSP rewrite
└── package.json
```

## Prerequisites

- Windows PowerShell (commands below) or an equivalent shell.
- Node.js 20+ and npm.
- Python 3.10+.
- Google Chrome 114+ (Side Panel API).
- A Google Gemini API key from
  <https://aistudio.google.com/app/apikey>.

## Setup and run (Windows PowerShell)

### 1. Install and build the extension

```powershell
cd E:\BharatVoice
npm install
npm run typecheck
npm run build
```

The default build targets `http://localhost:8000`. See
[Backend URL configuration](#backend-url-configuration) before deploying.

### 2. Load the extension and note its ID

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select `E:\BharatVoice\dist`.
4. Note the extension ID shown on the BharatVoice card. It looks like
   `abcdefghijklmnopqrstuvwxyzabcdef`.

After changing extension source or the backend URL, run `npm run build` again
and click **Reload** on the extension card.

### 3. Create the backend virtual environment and configuration

```powershell
cd E:\BharatVoice\backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
notepad .env
```

Set at least:

```dotenv
GEMINI_API_KEY=your_real_gemini_key
CORS_ORIGINS=chrome-extension://YOUR_EXTENSION_ID
```

`CORS_ORIGINS` must be the exact origin from step 2. Do not use `*`. If
PowerShell blocks activation, either run
`Set-ExecutionPolicy -Scope Process Bypass` in that terminal or use
`.\.venv\Scripts\python.exe` directly instead of activating.

### 4. Start the backend

```powershell
cd E:\BharatVoice\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Or without activation:

```powershell
cd E:\BharatVoice\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Check it:

```powershell
Invoke-RestMethod http://localhost:8000/healthz | ConvertTo-Json
```

Expected shape:

```json
{ "status": "ok", "provider": "gemini", "configured": true }
```

`configured` only reports whether a key is present; it does not verify that the
key or model is valid. Make a real chat request to test that.

### 5. Use the extension

Click the BharatVoice toolbar icon to open the side panel. Type a question or
use the microphone, then press **Send**. Replies are shown as plain text and
read aloud when a matching browser voice is available.

## Gemini key and model

1. Sign in to Google AI Studio and create a key at
   <https://aistudio.google.com/app/apikey>.
2. Put it only in `backend/.env` as `GEMINI_API_KEY=...`.
3. Never put it in the extension, `VITE_*`/`BHARATVOICE_*` variables, source
   control, screenshots, or issue reports.

The backend uses the official `google-genai` Python SDK. The default model is
`gemini-3.5-flash-lite`; override it with `GEMINI_MODEL`. Model availability and
free-tier quotas depend on your Google account and can change. If a model is not
available to your key, choose another supported Gemini Flash/Flash-Lite model.
A `gemini-3.8-flash` model can be used as an alternative but may have a lower
free daily quota. This project does not guarantee free-tier access.

## Backend URL configuration

The extension's backend origin is a **build-time** setting:

- Preferred variable: `BHARATVOICE_BACKEND_URL`
- Backward-compatible alias: `VITE_BACKEND_URL`
- Default: `http://localhost:8000`

Set it for one build in PowerShell:

```powershell
cd E:\BharatVoice
$env:BHARATVOICE_BACKEND_URL = "https://bharatvoice-api.example.com"
npm run build
Remove-Item Env:BHARATVOICE_BACKEND_URL
```

Or copy `.env.example` to `.env` at the repository root and edit it:

```dotenv
BHARATVOICE_BACKEND_URL=https://bharatvoice-api.example.com
```

The build rejects values that are not bare origins. Rules:

- Absolute `http://` or `https://` URL with a host.
- No wildcard, credentials, path, query string, or fragment.
- Plain HTTP is allowed only for loopback (`localhost`, `127.0.0.1`, `::1`).
  A deployed backend must use HTTPS.

On every successful build, Vite rewrites `dist/manifest.json` so:

- `host_permissions` contains only `${BHARATVOICE_BACKEND_URL}/*`.
- The extension-pages CSP contains
  `connect-src 'self' ${BHARATVOICE_BACKEND_URL}`.

After changing the URL you must rebuild **and** reload the unpacked extension.
If the deployed backend is called from the extension, also add the extension's
exact `chrome-extension://<id>` origin to `backend/.env` `CORS_ORIGINS`.

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `GEMINI_API_KEY` | empty (required) | Gemini key; backend-only secret. Requests return 503 when missing. |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Supported Gemini model name. |
| `GEMINI_TIMEOUT_SECONDS` | `30` | Upstream deadline; also enforced with `asyncio.wait_for`. Range (0, 120]. |
| `GEMINI_MAX_OUTPUT_TOKENS` | `512` | Reply-length cap for concise, read-aloud answers. Range 32-4096. |
| `CORS_ORIGINS` | empty | Comma-separated exact origins, e.g. `chrome-extension://<id>`. `*` is rejected. |
| `MAX_REQUEST_BODY_BYTES` | `4096` | Maximum request body size. |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | `30` | Per-client-IP in-memory rate limit. |
| `LOG_LEVEL` | `INFO` | Backend log level. Content is never logged. |

### Extension build (repository root `.env` or shell)

| Variable | Default | Purpose |
|----------|---------|---------|
| `BHARATVOICE_BACKEND_URL` | `http://localhost:8000` | Backend origin baked into the bundle, manifest, and CSP. |
| `VITE_BACKEND_URL` | unset | Accepted alias for the same setting. |

## Common commands

```powershell
# Frontend
cd E:\BharatVoice
npm run typecheck
npm run build

# Backend tests (offline; no key or network required)
cd E:\BharatVoice\backend
.\.venv\Scripts\python.exe -m pytest

# Backend import check
.\.venv\Scripts\python.exe -c "import app.main; print('import ok')"

# Start backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend tests use a fake provider/client. They cover validation, language
handling, missing keys, timeouts, auth/quota/unavailable errors, rate limiting,
empty replies, request-size limits, log leakage, prompt construction, and SDK
error mapping. They do not make live Gemini calls.

## Privacy and data flow

### What leaves the device

1. When you press **Send**, the extension sends only that message and the
   selected language code (`en`, `hi`, or `te`) to the configured backend.
2. The backend adds a fixed system instruction and language instruction, then
   sends the message to the Google Gemini API using the server-side key.
3. Gemini returns generated text to the backend, which returns it to the
   extension. The reply is displayed and may be read aloud by the browser.

The conversation history is not sent. There is no page-content extraction,
scraping, form filling, or automatic browsing.

### What is stored

- The extension keeps messages in React memory only while the side panel is
  open. It uses no `localStorage`, `sessionStorage`, IndexedDB, `chrome.storage`,
  cookies, or disk database. **Clear conversation** removes messages and stops
  speech/recognition.
- The backend has no database and does not persist messages or replies.
- The backend logs request metadata only: HTTP method, path, status, latency,
  and safe provider error category. It must not log message text, replies, API
  keys, or raw provider exception text.
- Client IP addresses are used transiently for the in-memory rate limiter. They
  are not stored by this application.

### Browser speech privacy

- Speech recognition and synthesis are provided by Chrome and the operating
  system. Whether recognition audio or synthesis is processed locally or sent to
  an external service depends on Chrome/OS/voice configuration, not on
  BharatVoice. BharatVoice cannot verify or control that path.
- Do not describe browser speech as offline or private. Microphone use starts
  only after an explicit click. The Stop button cancels recognition or playback.
  Typing is always available and never requires the microphone.
- Some voices may be missing. BharatVoice does not substitute an English voice
  for Hindi/Telugu; it tells you when no matching read-aloud voice is installed.

### Third parties

- **Google Gemini** receives submitted message text selected for a chat request.
- **Chrome/OS speech services** may receive audio if speech recognition is used,
  depending on browser configuration.
- There are no analytics, tracking pixels, telemetry, advertising, or other
  third-party scripts.

Do not submit OTPs, passwords, Aadhaar numbers, bank details, or other sensitive
information. The backend instructs the model not to request or repeat such data,
but this is a safety prompt, not a guarantee.

## Limitations

- No official government database, web browsing, retrieval, or verification. AI
  replies can be incomplete or wrong and are not official scheme information.
- No page context, form filling, scraping, accounts, or authentication.
- Only the current message is sent; the model does not receive conversation
  history.
- Responses are non-streaming.
- Browser speech recognition/synthesis coverage varies by Chrome/OS and installed
  voices. Telugu/Hindi recognition may be unavailable.
- The rate limiter is in-process and per instance. Multiple uvicorn workers or
  replicas each keep separate counters. Use a shared API gateway/limiter for
  production.
- CORS must list the exact extension origin. An unpacked extension ID can change
  if you load it from a different path.
- The backend has no user authentication. If deployed publicly, put it behind an
  authenticated gateway or restrict access; otherwise anyone who can reach it
  can consume your Gemini quota.
- Free-tier quotas, pricing, and model availability are controlled by Google and
  can change.
- Automated tests do not exercise Chrome UI, microphone hardware, browser
  speech services, or a live Gemini key. See manual checks below.

## Manual Chrome checks

1. Build, reload the unpacked extension, and confirm `chrome://extensions` shows
   no manifest or service-worker errors.
2. Open the side panel. Confirm the privacy and AI disclaimers appear and the
   language selector offers English, हिन्दी, and తెలుగు.
3. Send an English question. Confirm the processing indicator appears, a real
   Gemini reply is shown, and read-aloud works if an English voice exists.
4. Switch to Hindi and Telugu. Confirm a new welcome appears and replies are in
   the selected language. If no matching voice is installed, confirm the app says
   so instead of speaking with an English voice.
5. Use the microphone (if supported). Confirm the transcript appears in the
   input, can be edited, and can be sent. Press Stop while listening.
6. Send a request and press the stop control while it is processing. Confirm the
   request is cancelled and no late reply is appended.
7. Press Stop while speaking and confirm playback ends without an error banner.
8. Press Clear conversation and confirm messages, input, and speech are cleared.
9. Stop the backend and send a message. Confirm a localized "cannot reach the
   backend" message appears and typing still works.
10. Start the backend with `GEMINI_API_KEY` empty. Confirm `/healthz` reports
    `configured: false` and chat returns a safe "not configured" message.
11. Change `BHARATVOICE_BACKEND_URL`, rebuild, reload, and inspect
    `dist/manifest.json`. Confirm `host_permissions` and CSP `connect-src`
    contain only the new origin.

## Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| `The AI backend is not configured` (503) | `GEMINI_API_KEY` is empty or `.env` was not loaded. Edit `backend/.env` and restart uvicorn. |
| Extension says it cannot reach the backend | Backend not running, wrong build-time URL, HTTPS/HTTP mismatch, or stale `dist/`. Start the backend, check `/healthz`, rebuild, reload. |
| Browser console shows a CORS error | Add the exact `chrome-extension://<id>` to `CORS_ORIGINS`, comma-separated, and restart the backend. |
| `429` / "assistant is busy" | Gemini quota or the local per-IP rate limit was hit. Wait, reduce requests, or check AI Studio quota. |
| `502` "not configured correctly" | Invalid/revoked key, missing permission, or no access to the configured model. Test the key and set `GEMINI_MODEL`. |
| `503` / `504` provider messages | Gemini is temporarily unavailable or slow. Retry; increase `GEMINI_TIMEOUT_SECONDS` only if appropriate. |
| Manifest still points at localhost | `dist/` was not rebuilt. Run `npm run build` and reload the extension. |
| Build fails with `BHARATVOICE_BACKEND_URL ...` | Use a bare origin. No wildcard, path, query, credentials, or plain HTTP outside localhost. |
| `uvicorn` is not recognized | Activate `.venv` or run `.\.venv\Scripts\python.exe -m uvicorn ...`. |
| PowerShell refuses `.ps1` activation | `Set-ExecutionPolicy -Scope Process Bypass`, then activate; or call `.\.venv\Scripts\python.exe` directly. |
| Microphone permission denied | Allow microphone access for the extension in Chrome and Windows privacy settings. Typing still works. |
| No Telugu/Hindi read-aloud voice | Install the language voice in Windows/Chrome speech settings. The app reports a missing voice rather than using English. |
| Speech recognition network error | Chrome's recognition service needs connectivity/availability. Check connection or type instead. |
| Port 8000 already in use | Stop the other process or run `--port 8001` and rebuild the extension with the matching URL. |

## Secret-handling note

`backend/.env`, `.env`, `backend/.venv`, and `dist/` are ignored by git. If a real
key is ever committed, revoke it in Google AI Studio, remove it from history with
the team's approved process, and rotate it. Never force-push or rewrite shared
history without explicit approval.

## License

Private — BharatVoice project.
