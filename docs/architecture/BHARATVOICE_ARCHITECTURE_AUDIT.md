# BharatVoice Architecture Audit

**Repository:** `E:\BharatVoice`  
**Audited commit:** `630ec2d` (`just changes`)  
**Audit date:** 2026-10-27  
**Audit mode:** Read-only. No source code, configuration, environment variables, dependencies, deployments, or Git state were changed.  
**Scope:** The extension, web shell, FastAPI backend, provider integration, speech path, documentation, and tests as they exist in the repository. The requested target architecture is treated as intent, not as evidence of implementation.

**Labels used in this report**

| Label | Meaning |
|---|---|
| `[EXISTING]` | Present in the repository and verified by source inspection. |
| `[PARTIAL]` | Present but limited, fragile, or not connected end to end. |
| `[MISSING]` | Not implemented in the repository. |
| `[PROPOSED]` | A recommendation in this audit. It is not implemented. |
| `[VERIFIED]` | Confirmed against source code, a command result, or official provider documentation. |
| `[UNVERIFIED]` | Not executed in this audit, or dependent on an account, browser, OS, voice, or external service that was not tested. |

---

## A. Executive summary

BharatVoice is a working, narrowly scoped multilingual chat MVP, not the page-aware accessibility platform described by the target architecture. The current product is a Chrome side panel that sends one typed or browser-recognized message to a FastAPI backend, receives a non-streaming Gemini reply, displays it, and optionally reads it with the browser's `speechSynthesis`. The backend has exactly two application endpoints: `POST /api/chat` and `GET /healthz` (`backend/app/main.py:172`, `backend/app/main.py:223`). It is stateless and does not receive conversation history.

The strongest parts of the current repository are the security-conscious backend boundary, the small provider interface, and the offline backend tests. The Gemini API key is server-side only. Request validation, upstream timeouts, safe error mapping, CORS validation, request-size checks, basic rate limiting, and log-content avoidance are implemented. The backend suite ran successfully in this audit: **40 tests passed**.

The largest confirmed gaps are:

1. **No backend text-to-speech.** The Telugu read-aloud failure is not a backend defect; it is the expected consequence of a browser-only TTS design. `src/voice/speech.ts:94` deliberately requires a matching `te-IN` voice and `src/hooks/useSpeech.ts:130` surfaces a missing-voice error instead of using an English voice. The repository contains no server-side TTS provider or `/api/speech/synthesize` endpoint. The welcome message is auto-spoken 600 ms after load (`src/sidepanel/App.tsx:78-89`), so the missing voice is often exposed immediately.
2. **No page awareness or website navigation.** The manifest requests only `sidePanel` (`public/manifest.json:28`) and declares no content scripts. There is no `activeTab`, `scripting`, or `tabs` permission, no DOM extraction, no element finding, no highlighting, and no scrolling. `src/messaging.ts` and the background `onConnect` handler are placeholders. The UI copy nevertheless says "right on the page you are using" (`src/locales.ts:73`), which overstates current behavior.
3. **No document processing.** There is no upload endpoint, PDF/DOCX parsing, OCR, document store, or document dependency.
4. **No provider registry or capability endpoint.** The provider is hard-coded as `gemini` (`backend/app/main.py:32`) and the only provider is chat generation (`backend/app/services/ai_provider.py:24`).
5. **The API contract is a flat chat-specific shape**, not the requested `success/data/error/request_id` envelope. There is no request ID, no API versioning, and no structured error code beyond the HTTP status and a human-readable string (`backend/app/schemas.py:28-36`).
6. **Production hardening is incomplete.** There is no backend authentication, the rate limiter is process-local and IP-keyed (`backend/app/deps.py:6-9`, `backend/app/deps.py:61-75`), and the body-size guard trusts `Content-Length` only (`backend/app/main.py:143-156`).
7. **Verification coverage is one-sided.** Backend tests exist and pass. There are no frontend or extension tests, no end-to-end browser tests, no lint script, and no CI configuration.

The recommended next phase is **not a rewrite**. Stabilize the existing chat path, make the product claim honest, add a small speech-provider abstraction with a backend TTS endpoint and browser fallback, and then add read-only page context before any navigation actions. DOM operations such as finding, highlighting, and scrolling should remain extension-side; they should not become backend endpoints.

**Audit conclusion:** the current code is a credible MVP foundation with a clean security boundary, but most of the target architecture is absent. The gap is primarily missing capability, not a defective Gemini integration.

---

## B. Actual repository architecture

### B.1 Actual runtime diagram

```text
+-------------------------------------------------------------+
| Chrome extension (Manifest V3)                              |
|                                                             |
|  Side panel (React 19 + TypeScript)                         |
|    - typed input                                            |
|    - SpeechRecognition (Chrome / OS)                        |
|    - speechSynthesis (Chrome / OS)                          |
|    - messages in React memory only                          |
|           |                                                 |
|           | POST /api/chat { message, language }            |
|           v                                                 |
|  Background service worker                                  |
|    - sets side panel open-on-action behavior                |
|    - placeholder onConnect("bharatvoice") only              |
|    - no content script, no DOM access                       |
+-----------------------------|-------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| FastAPI backend (single process, stateless)                 |
|                                                             |
|  POST /api/chat  -> AIProvider protocol -> GeminiProvider   |
|  GET  /healthz   -> status/provider/configured              |
|                                                             |
|  CORS (only if CORS_ORIGINS set)                            |
|  request-size + timing middleware                           |
|  in-memory per-IP rate limiter                              |
|  no database, no accounts, no history, no request IDs       |
+-----------------------------|-------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| Google Gemini API (google-genai, gemini-3.5-flash-lite)     |
+-------------------------------------------------------------+
```

The optional web build reuses the same React app and calls `/api/chat` on its own origin (`src/web/main.tsx`, `vite.config.web.ts`). It is a shell around the same UI, not a separate product architecture.

### B.2 Components that actually exist

| Layer | Component | Evidence | What it does |
|---|---|---|---|
| Extension UI | Side panel app | `src/sidepanel/App.tsx:38-258` | Language state, welcome message, chat submission, abort, clear, voice orchestration. |
| Extension UI | Components | `src/sidepanel/components/*` | Header, language selector, conversation, input, message bubble, status banner. |
| Extension client | Backend HTTP client | `src/api.ts:71-157` | `fetch` to `${BACKEND_URL}/api/chat`, 35 s client timeout, abort handling, status-to-error mapping. |
| Extension voice | Browser speech wrapper | `src/voice/speech.ts:16-296` | Capability detection, voice loading, language tags, recognition lifecycle, synthesis lifecycle. |
| Extension hook | Voice lifecycle | `src/hooks/useSpeech.ts:36-221` | Voice readiness, cancellation, matching-voice requirement, localized errors. |
| Extension background | Service worker | `src/background/service-worker.ts` | Side-panel behavior; placeholder port handler; no provider calls. |
| Extension manifest | MV3 manifest | `public/manifest.json:1-33` | Side panel, service worker, `sidePanel` permission, localhost host permission, CSP. |
| Shared extension code | Message contract | `src/messaging.ts` | Types and helpers only; not imported by the running UI. |
| Legacy code | Demo assistant | `src/assistant.ts` | Unused keyword demo responses; README labels it unused. |
| Backend app | FastAPI entry point | `backend/app/main.py:50-230` | Routes, middleware, CORS, exception handlers, logging policy. |
| Backend contract | Pydantic schemas | `backend/app/schemas.py:8-36` | `ChatRequest`, `ChatResponse`, language enum, 1,000-character cap. |
| Backend config | Settings | `backend/app/config.py:22-121` | Gemini key/model/timeouts/CORS/body/rate settings and validators. |
| Backend protection | Rate limit and key check | `backend/app/deps.py:22-75` | Process-local sliding window; key presence check. |
| Backend provider port | `AIProvider` protocol | `backend/app/services/ai_provider.py:10-34` | One method: `generate(message, language) -> str`; safe `ProviderError`. |
| Backend provider | Gemini adapter | `backend/app/services/gemini.py:81-168` | SDK client, system instruction, timeout, error categorization. |
| Backend tests | Offline tests | `backend/tests/test_api.py`, `test_config.py`, `test_gemini_provider.py` | Route, config, and provider behavior with fakes. |
| Web shell | Web entry point | `src/web/main.tsx` | Reuses the side-panel App; no extension APIs. |

### B.3 Actual request flow

1. The user types text or starts browser recognition in the side panel.
2. `App.handleSend` trims the input to `MAX_MESSAGE_LENGTH` and appends a user message (`src/sidepanel/App.tsx:109-127`).
3. `sendChat` posts `{ message, language }` to the backend (`src/api.ts:93-99`).
4. `POST /api/chat` checks key presence, applies the local rate limit, calls `GeminiProvider.generate`, and returns a flat `ChatResponse` (`backend/app/main.py:172-220`).
5. Gemini receives a fixed system instruction plus the current message; no history is sent (`backend/app/services/gemini.py:27-54`, `gemini.py:109-125`).
6. The extension appends the assistant message and calls `speakText` (`src/sidepanel/App.tsx:138-146`).
7. `useSpeech` waits for browser voices, requires a matching language voice, and calls `speechSynthesis` (`src/hooks/useSpeech.ts:126-151`).

### B.4 Actual build and deployment model

| Item | Actual state | Evidence |
|---|---|---|
| Extension build | Vite builds `dist/`; rewrites manifest host permission and CSP to the build-time backend origin. | `vite.config.ts:57-110`, `vite.config.ts:124-147` |
| Web build | Vite builds `dist-web/`; `/api` proxied to localhost in development. | `vite.config.web.ts` |
| Backend runtime | Local `uvicorn` process; no container, process manager, or cloud manifest in the repo. | `README.md:113-126` |
| Database | None. | `README.md:271-282`, `backend/app/main.py:8` |
| Authentication | None. | `README.md:323-325` |
| CI/CD | None found. No `.github/` directory. | Repository inspection |
| Observability | Standard logging plus request timing; no metrics, tracing, or request IDs. | `backend/app/main.py:34-47`, `main.py:143-169` |
| Storage in extension | React memory only; no `chrome.storage`, localStorage, or IndexedDB. | `README.md:271-276` |

### B.5 Architecture observations

- The backend is intentionally stateless, which is a good fit for a privacy-first MVP, but it also means the model cannot resolve follow-up questions without the client sending history.
- The extension and web shell share the same UI, so a change to the chat flow affects both. Any extension-only feature must be guarded by capability detection or a separate adapter.
- The service worker and `src/messaging.ts` imply a future content-script architecture, but neither is wired into the UI. They are structural placeholders, not working page integration.
- `src/assistant.ts` is legacy code. It increases the apparent feature surface without being reachable.
- The local `dist/` and `dist-web/` directories exist but are gitignored. Their contents were not treated as source of truth.

---

## C. Current feature inventory

### C.1 Feature matrix

| Feature | Status | Evidence | Notes |
|---|---|---|---|
| English, Hindi, Telugu UI strings | `[EXISTING]` | `src/locales.ts:5-27`, `src/locales.ts:69+` | UI copy is localized; the HTML document itself remains `lang="en"`. |
| Language selector | `[EXISTING]` | `src/sidepanel/components/LanguageSelector.tsx`, `App.tsx:230-232` | Switching aborts in-flight work and resets the welcome message. |
| Typed chat | `[EXISTING]` | `App.tsx:109-168`, `src/api.ts:71-157` | Non-streaming request/response. |
| Gemini-generated replies | `[EXISTING]` | `backend/app/services/gemini.py:81-144` | Single-turn; system instruction enforces selected language and safety rules. |
| Conversation history sent to model | `[MISSING]` | `README.md:21-22`, `README.md:313-314` | Only the current message is forwarded. |
| Follow-up context within the panel | `[PARTIAL]` | `App.tsx:40`, `App.tsx:109-168` | Messages are displayed, but the model never sees them. |
| Streaming responses | `[MISSING]` | `src/api.ts:94-133` | Full JSON response only. |
| Browser speech recognition | `[EXISTING]` | `src/voice/speech.ts:120-190` | Single-shot, interim + final results, browser/OS dependent. |
| Browser speech synthesis | `[EXISTING]` | `src/voice/speech.ts:44-104`, `speech.ts:223-271` | Requires a matching installed voice. |
| Backend speech recognition | `[MISSING]` | No route or provider | All recognition is browser-side. |
| Backend speech synthesis | `[MISSING]` | No route or provider | All synthesis is browser-side. |
| Telugu read-aloud | `[PARTIAL]` | `speech.ts:94-104`, `useSpeech.ts:126-135` | Works only if the OS/Chrome exposes a `te-IN` voice; otherwise shows an error. |
| Missing-voice safety behavior | `[EXISTING]` | `speech.ts:87-93` | Deliberately does not substitute English for Hindi/Telugu. |
| Page context extraction | `[MISSING]` | `public/manifest.json:28`, no content script | The backend never receives page text. |
| Element finding and highlighting | `[MISSING]` | `src/messaging.ts` placeholder | Types exist but no content script or DOM code. |
| Scrolling to an element | `[MISSING]` | No DOM code | No implementation. |
| Website navigation | `[MISSING]` | No `tabs`/`navigation` code | Cannot open, click, or submit on a page. |
| Form filling | `[MISSING]` | No DOM code | Not implemented. |
| Translation | `[MISSING]` | No translation route or prompt feature | The model is instructed to answer in the selected language, but the product does not translate page content. |
| Document upload | `[MISSING]` | No upload route or UI | Not implemented. |
| PDF/DOCX extraction | `[MISSING]` | No document dependencies | Not implemented. |
| OCR (Telugu/Hindi/English) | `[MISSING]` | No OCR dependency or route | Not implemented. |
| Provider registry | `[MISSING]` | `main.py:32` hard-codes `gemini` | One chat provider only. |
| Provider capability endpoint | `[MISSING]` | No route | Clients cannot discover speech/document support. |
| Request IDs and structured errors | `[MISSING]` | `schemas.py:28-36`, `main.py:77-89` | Flat response; no correlation identifier. |
| Health check | `[EXISTING]` | `main.py:223-230` | Reports provider and key presence, not upstream validity. |
| Privacy notices | `[EXISTING]` | `src/locales.ts:120-123` | Text shown in the UI; README documents the data flow. |
| AI limitation disclaimer | `[EXISTING]` | `src/locales.ts:122-123` | Explicitly says replies are unverified. |
| Web application shell | `[PARTIAL]` | `src/web/main.tsx`, `vite.config.web.ts` | Same UI; no separate web-only features or deployment config. |
| Backend tests | `[EXISTING]` | `backend/tests/` | 40 passed in this audit. |
| Frontend/extension tests | `[MISSING]` | No test files or test runner | No unit, component, or E2E tests. |
| Lint/format configuration | `[MISSING]` | `package.json` scripts | No ESLint, Prettier, or equivalent. |
| CI pipeline | `[MISSING]` | No `.github/` | Checks are manual. |
| Dynamic document language | `[MISSING]` | `src/sidepanel/index.html:2`, `src/web/index.html:2` | HTML stays `lang="en"` when the UI language changes. |
| Offline mode | `[MISSING]` | No service-worker caching or local model | Requires backend and browser speech services. |
| Authentication / accounts | `[MISSING]` | `README.md:323-325` | Anyone who can reach the backend can consume quota. |

### C.2 Product behavior that is easy to misread

- The panel says it helps "right on the page you are using" (`src/locales.ts:73`), but the extension has no access to the active page. The claim should be treated as a product intent, not a current capability.
- The welcome message is spoken automatically. On a machine without a Telugu voice, switching to Telugu produces an immediate "no Telugu voice" banner even before the user asks anything (`App.tsx:78-89`, `useSpeech.ts:130-135`). This is a UX defect independent of the missing backend TTS.
- The "Stop" control aborts both the HTTP request and speech (`App.tsx:186-190`), which is correct, but there is no separate retry affordance.
- The UI does not expose voice selection, speech rate, pitch, or a text-only fallback control. Text replies remain available, which is the main mitigation.

---

## D. Existing API inventory

### D.1 Application endpoints

| Method | Path | Status | Request | Success response | Error behavior |
|---|---|---|---|---|---|
| `POST` | `/api/chat` | `[EXISTING]` | `ChatRequest` JSON | `200` + `ChatResponse` | `422`, `429`, `502`, `503`, `504` with the same flat body and `status="error"`. |
| `GET` | `/healthz` | `[EXISTING]` | None | `200` + `{status, provider, configured}` | No application error path. |
| `GET` | `/docs` | Framework default | None | Swagger UI | Enabled by default by FastAPI. Not hardened or documented as a product endpoint. |
| `GET` | `/openapi.json` | Framework default | None | OpenAPI schema | Enabled by default. |
| `GET` | `/redoc` | Framework default | None | ReDoc UI | Enabled by default. |

No `/api/speech/*`, `/api/translate`, `/api/document*`, `/api/providers`, `/api/conversations`, or authentication routes exist.

### D.2 Chat request and response contracts

**Request** (`backend/app/schemas.py:18-25`):

```json
{
  "message": "What documents are needed for this scheme?",
  "language": "en"
}
```

- `message`: required, whitespace-trimmed, 1 to 1,000 characters.
- `language`: optional, defaults to `"en"`; allowed values are exactly `"en"`, `"hi"`, `"te"`.

**Success response** (`backend/app/schemas.py:28-36`, `backend/app/main.py:220`):

```json
{
  "answer": "The reply text.",
  "provider": "gemini",
  "status": "ok",
  "error": null
}
```

**Error response** (`backend/app/main.py:77-89`):

```json
{
  "answer": "",
  "provider": "gemini",
  "status": "error",
  "error": "A safe, user-facing English message."
}
```

### D.3 HTTP status mapping

| Condition | Status | Body message source | Evidence |
|---|---|---|---|
| Validation failure | `422` | Fixed message, no echoed input | `main.py:116-128` |
| Body too large | `413` | Fixed message | `main.py:150-154` |
| Invalid `Content-Length` | `400` | Fixed message | `main.py:155-156` |
| Missing key | `503` | Fixed message | `main.py:183-187` |
| Local rate limit | `429` + `Retry-After: 60` | Fixed message | `main.py:189-194` |
| Provider timeout | `504` | Fixed message | `main.py:92-96`, `main.py:199-205` |
| Provider auth/config | `502` | Fixed message | `main.py:97-100` |
| Provider quota | `429` | Fixed message | `main.py:101-104` |
| Provider unavailable | `503` | Fixed message | `main.py:105-108` |
| Empty provider output | `502` | Fixed message | `main.py:109-112`, `main.py:213-218` |
| Unexpected error | `500` | Fixed message | `main.py:131-140` |

### D.4 Contract gaps

1. **No common envelope.** There is no `success`, `data`, `error` object, or `request_id`. The requested envelope is not implemented.
2. **No machine-readable error code.** Clients must branch on HTTP status and English text (`src/api.ts:55-60`). Hindi/Telugu users receive localized generic text from the client (`App.tsx:16-36`), not from the backend.
3. **No API version.** `/api/chat` is unversioned; adding incompatible fields will be harder to roll out.
4. **No request correlation.** Neither responses nor logs contain a request ID. This makes support and incident investigation slower.
5. **No idempotency or retry semantics.** A client retry can duplicate a provider call; the backend has no idempotency key.
6. **No streaming contract.** The full reply must be generated before the user sees anything, which increases perceived latency for long answers.
7. **Provider name is baked into the response.** `provider: "gemini"` is hard-coded at `main.py:32` and used in error bodies, even though the provider port exists.
8. **OpenAPI is exposed by default.** For a public deployment, `/docs`, `/redoc`, and `/openapi.json` should be disabled or protected unless intentionally public `[PROPOSED]`.

---

## E. Provider and API audit

### E.1 Implemented provider configuration

| Setting | Current value | Evidence |
|---|---|---|
| Chat provider | Google Gemini via `google-genai` | `backend/app/services/gemini.py:18-20` |
| Default model | `gemini-3.5-flash-lite` | `backend/app/config.py:30`, `.env.example` |
| SDK pin | `google-genai==1.75.0` | `backend/requirements.txt` |
| Timeout | 30 s default, enforced by SDK HTTP options and `asyncio.wait_for` | `config.py:34`, `gemini.py:97-102`, `gemini.py:118-125` |
| Output cap | 512 tokens default | `config.py:37`, `gemini.py:103-107` |
| Temperature | `0.3` | `gemini.py:105` |
| System instruction | Language selection, plain language, no browsing/RAG, no invented facts, no sensitive data requests, no real-world action claims, prompt-injection resistance | `gemini.py:27-54` |
| Error categories | `timeout`, `auth`, `quota`, `unavailable`, `empty` | `gemini.py:63-78`, `gemini.py:126-143` |
| Key location | Backend environment only | `config.py:22-30`, `README.md:25-27` |

### E.2 Provider capability matrix

| Capability | Provider / route | Status | Evidence / caveat |
|---|---|---|---|
| Chat completion | Gemini `generate_content` | `[EXISTING]` | Only implemented model call. |
| Conversation memory | None | `[MISSING]` | Backend is stateless; client does not send history. |
| Gemini TTS | Gemini speech generation models | `[MISSING]` | Not implemented. Pinned SDK `1.75.0` predates the documented requirement of `google-genai >= 2.25.0`. |
| Google Cloud TTS | Cloud Text-to-Speech | `[MISSING]` | Not implemented. Requires Google Cloud billing; supports `te-IN` voices according to official docs. |
| Google Cloud STT | Cloud Speech-to-Text | `[MISSING]` | Not implemented. V1 has a monthly free allowance; V2 is paid per official pricing. |
| Gemini transcription | Gemini transcription models | `[MISSING]` | Not implemented. Official docs describe multilingual/low-latency transcription; exact `te-IN`/`hi-IN` behavior for this account is `[UNVERIFIED]`. |
| Browser STT | Chrome `SpeechRecognition` | `[EXISTING]` | Browser/OS/network dependent; may send audio to a browser vendor service. |
| Browser TTS | Chrome/OS `speechSynthesis` | `[EXISTING]` | Requires a matching installed voice; no Telugu guarantee. |
| AI4Bharat IndicF5 | Local/open model | `[MISSING]` | Not implemented. Official project supports 11 Indian languages including Telugu and Hindi, but requires reference audio and local execution; commercial/license terms need review. |
| Translation | None | `[MISSING]` | The model answers in the selected language but does not translate page or document content. |
| OCR | None | `[MISSING]` | No OCR engine or cloud OCR integration. |

### E.3 Provider claims verified against official documentation

| Claim | Result | Basis |
|---|---|---|
| `gemini-3.5-flash-lite` is a real, current Gemini model | `[VERIFIED]` | Google AI for Developers Gemini models documentation. |
| Gemini 3.8 Flash TTS / Flash-Lite TTS support Telugu and Hindi | `[VERIFIED]` | Google Gemini speech-generation documentation. |
| Gemini TTS has no free usage tier | `[VERIFIED]` | Google Gemini pricing documentation. |
| Gemini TTS requires `google-genai >= 2.25.0` | `[VERIFIED]` | Google Gemini speech-generation documentation. The repository pins `1.75.0`. |
| Google Cloud TTS supports `te-IN` and requires billing | `[VERIFIED]` | Google Cloud Text-to-Speech supported voices and pricing documentation. |
| Google Cloud TTS offers monthly free allowances (for example, Chirp 3 HD and Standard/WaveNet tiers) | `[VERIFIED]` | Google Cloud Text-to-Speech pricing documentation. Allowances can change. |
| Google Cloud STT V1 offers 60 free minutes per month and V2 is paid | `[VERIFIED]` | Google Cloud Speech-to-Text pricing documentation. |
| Gemini 3.5 Transcribe supports low-latency multilingual transcription | `[VERIFIED]` | Google Gemini transcription documentation. |
| This repository's Gemini key can access any specific TTS/STT model | `[UNVERIFIED]` | No live call was made; model access depends on account, region, and billing. |
| Telugu synthesis quality is acceptable for government-form guidance | `[UNVERIFIED]` | Requires listening tests with native speakers. |
| AI4Bharat IndicF5 can be used commercially | `[UNVERIFIED]` | License/commercial terms were not confirmed. |
| PyMuPDF is AGPL or commercially licensed | `[VERIFIED]` | PyMuPDF license documentation. |
| pypdf is a permissive alternative | `[VERIFIED]` | pypdf project/license documentation, with fewer layout capabilities. |

### E.4 Provider recommendations

1. **Do not switch chat providers now.** Gemini chat works and is covered by tests. Provider abstraction already exists at the port level; extend it rather than replace it.
2. **For Telugu TTS, evaluate two options in this order:**
   - **Gemini TTS** after a deliberate `google-genai` upgrade to at least `2.25.0`. Benefits: one vendor, native multilingual output, simple server integration. Costs: paid usage, SDK upgrade risk, new audio error modes.
   - **Google Cloud TTS** as a fallback or primary if Gemini TTS account access is unavailable. Benefits: explicit `te-IN` voices and mature audio formats. Costs: separate Google Cloud project/billing, credential management, another SDK.
3. **Keep browser TTS as the final fallback**, not the only path. It is free and offline-capable only in the sense that the OS may have a voice; it is not guaranteed and cannot be described as private or offline.
4. **Treat AI4Bharat IndicF5 as an experiment**, not a production default. It requires local model hosting, reference audio, GPU capacity, and license review.
5. **For STT, defer until page context and TTS are stable.** Browser STT is adequate for the MVP; a backend STT path adds audio privacy, cost, and upload concerns.
6. **Introduce a provider registry and capabilities endpoint** before adding a second speech provider. Do not hard-code provider names in routes.

### E.5 Provider risks

| Risk | Impact | Mitigation `[PROPOSED]` |
|---|---|---|
| SDK upgrade breaks chat | Regression in the only working feature | Pin both versions in a branch, run all 40 tests, add a TTS contract test, canary the chat route. |
| No free TTS tier | Unexpected cost | Per-user/IP quotas, text-length caps, cost logging without content, provider budget alerts, feature flag. |
| Model access differs by key | Feature appears configured but fails at runtime | `/api/providers` capability check and a startup or admin diagnostic that does not expose secrets. |
| Vendor retention of text/audio | Privacy mismatch | Minimize text, disclose provider processing, avoid persistent audio, document retention. |
| Output language drift | Telugu reply in Hindi/English | Keep explicit language instruction; add automated language-identification checks on sampled outputs. |
| TTS voice quality | Users cannot understand guidance | Native-speaker review, voice/rate controls, text fallback, browser voice option. |

---

## F. Speech audit

### F.1 Current speech architecture

```text
Microphone
   |
   v
Chrome SpeechRecognition (lang = te-IN / hi-IN / en-IN)
   |
   v
useSpeech.startListening -> transcript -> input box
   |
   v
POST /api/chat (text only; no audio ever reaches the backend)
   |
   v
reply text
   |
   v
useSpeech.speakText
   |
   v
loadSynthesisVoices -> selectVoiceForLang
   |                         |
   | no matching voice       | matching voice
   v                         v
localized error         window.speechSynthesis.speak
```

### F.2 Speech-to-text path

| Aspect | Current behavior | Evidence |
|---|---|---|
| API | Browser `SpeechRecognition` / `webkitSpeechRecognition` | `src/voice/speech.ts:9-18` |
| Language tags | `en-IN`, `hi-IN`, `te-IN` | `speech.ts:24-33` |
| Mode | Single-shot, `continuous = false`, interim results enabled | `speech.ts:132-134` |
| Transcript handling | Final or interim text is written into the input; user can edit and send | `App.tsx:181-183` |
| Cancellation | Token invalidation, handler removal, `abort()`/`stop()` | `speech.ts:193-214` |
| Error mapping | Permission, audio capture, unsupported language, network, no match, service blocked | `speech.ts:165-175`, `useSpeech.ts:182-204` |
| Backend audio upload | None | No route or dependency |
| Privacy | Browser/OS may send audio to a vendor service; BharatVoice cannot verify the path | `README.md:284-294` |
| Telugu recognition | Depends on Chrome/OS service availability | `[UNVERIFIED]` on the audit machine |

### F.3 Text-to-speech path

| Aspect | Current behavior | Evidence |
|---|---|---|
| API | Browser `window.speechSynthesis` | `speech.ts:20-22`, `speech.ts:223-271` |
| Voice loading | `getVoices()` plus `voiceschanged` event, 1.5 s fallback | `speech.ts:44-85` |
| Voice matching | Exact language, then same base language, then bare base code | `speech.ts:94-104` |
| English fallback | Deliberately disabled for Hindi/Telugu | `speech.ts:87-93` |
| Missing voice | Localized `errorVoiceMissing` message; no speech | `useSpeech.ts:126-135`, `locales.ts:97-98` |
| Auto-play | Welcome message spoken 600 ms after panel load/language change | `App.tsx:78-89` |
| Stop | Cancels the utterance and invalidates the token | `speech.ts:274-296` |
| Backend TTS | None | No route or provider |

### F.4 Root cause of the Telugu failure

The Telugu failure is a **capability gap plus an explicit safety decision**, not a Gemini or FastAPI bug:

1. `synthesisLangFor('te')` returns `te-IN` (`speech.ts:35-37`, `speech.ts:24-33`).
2. `selectVoiceForLang('te-IN')` searches the browser's installed voice list for an exact or base-language match (`speech.ts:94-104`).
3. If no `te-IN` voice is installed, it returns `undefined`.
4. `useSpeech.speakText` sees the missing voice and sets `errorVoiceMissing` rather than speaking Telugu text with an English voice (`useSpeech.ts:126-135`).
5. The repository has no backend TTS endpoint that could supply a Telugu voice independently of the OS.
6. The welcome effect calls `speakText` automatically (`App.tsx:86-89`), which makes the error appear before a user action.

This behavior is safer than mispronouncing Telugu with an English voice, but it means "Telugu read-aloud works" is not a supported product guarantee today.

### F.5 Language coverage matrix

| Language | Recognition | Browser synthesis | Backend synthesis | Overall speech status |
|---|---|---|---|---|
| English (`en-IN`) | `[EXISTING]`, browser/OS dependent | `[EXISTING]`, usually available | `[MISSING]` | Good on typical desktop Chrome; `[UNVERIFIED]` on this machine. |
| Hindi (`hi-IN`) | `[EXISTING]`, browser/OS dependent | `[EXISTING]`, voice may be missing | `[MISSING]` | `[PARTIAL]`; quality and availability vary. |
| Telugu (`te-IN`) | `[EXISTING]`, browser/OS dependent | `[PARTIAL]`, often missing | `[MISSING]` | The confirmed failing path; dependent on installed voice. |

### F.6 Speech accessibility and UX findings

| Finding | Severity | Evidence | Recommendation `[PROPOSED]` |
|---|---|---|---|
| Telugu read-aloud can fail with no server fallback | High | `useSpeech.ts:130-135` | Add backend TTS with browser fallback. |
| Welcome autoplay exposes missing voice immediately | Medium | `App.tsx:78-89` | Speak only after a user gesture, or make welcome speech opt-in. |
| HTML `lang` is always `en` | Medium | `src/sidepanel/index.html:2`, `src/web/index.html:2` | Set `document.documentElement.lang` from the selected language. |
| No voice/rate/pitch controls | Low/Medium | `speech.ts:223-271` | Add voice selection and rate control where supported. |
| No visible "read aloud" control per message | Medium | `Conversation.tsx`, `MessageBubble.tsx` | Allow replay per message without re-sending. |
| No captions/transcript for synthesized audio | Medium | No implementation | The text reply is the transcript; keep it visible and focusable. |
| Speech errors are transient banners | Low | `StatusBanner.tsx` | Provide a persistent text fallback hint. |
| No speech tests | Medium | No frontend tests | Add unit tests for voice matching and error mapping; manual browser test for Telugu. |

### F.7 Proposed speech contracts

`[PROPOSED]` only. No endpoint or provider was implemented.

```text
POST /api/v1/speech/synthesize
Content-Type: application/json

{
  "text": "మీరు ఈ ఫారమ్‌లో పేరు నమోదు చేయాలి.",
  "language": "te",
  "voice": null,
  "format": "mp3"
}

200 OK
Content-Type: audio/mpeg
X-Request-Id: <id>
X-Provider: gemini-tts | google-cloud-tts
Cache-Control: no-store
```

A binary audio response is preferable to base64 inside JSON: it avoids 33% size overhead and lets the client stream/play it. If the project standardizes on the `success/data/error/request_id` envelope for every endpoint, document this endpoint as the deliberate binary exception.

```text
POST /api/v1/speech/transcribe
Content-Type: multipart/form-data

audio=<file>
language=te
```

Response: standard envelope with `data.transcript`, `data.language`, `data.duration_ms`, and provider metadata (no raw audio retention).

**Fallback order `[PROPOSED]`:** configured backend provider -> browser `speechSynthesis` (only if a matching voice exists) -> show text and a clear "audio unavailable" message. Never silently substitute an English voice for Telugu or Hindi.

---

## G. Website navigation audit

### G.1 Current state

| Capability | Status | Evidence |
|---|---|---|
| Read active tab URL/title | `[MISSING]` | No `tabs` permission, no content script. |
| Read page text/DOM | `[MISSING]` | No content script. |
| Extract form fields/labels | `[MISSING]` | No DOM code. |
| Find an element by description | `[MISSING]` | No selector logic or model tool. |
| Highlight an element | `[MISSING]` | `src/messaging.ts` defines `HIGHLIGHT_FIELD` but nothing handles it. |
| Scroll to an element | `[MISSING]` | No implementation. |
| Navigate to another page | `[MISSING]` | No `chrome.tabs` navigation code. |
| Click a link/button | `[MISSING]` | No DOM action code. |
| Fill a form | `[MISSING]` | No implementation. |
| Submit a form | `[MISSING]` | No implementation. |

`public/manifest.json:28` grants only `sidePanel`. There is no `content_scripts` block, no `activeTab`, no `scripting`, and no `tabs` permission. `src/background/service-worker.ts` registers an `onConnect` listener for a port named `bharatvoice`, but no code connects to it. `src/messaging.ts` defines message types and a `sendToTab` helper, but the helper is unused. The extension cannot see or act on the current page.

### G.2 The misleading page claim

`src/locales.ts:73` says the assistant helps with forms, schemes, and eligibility "right on the page you are using." In reality:

- No page content is read.
- No page element is highlighted.
- No page is scrolled or navigated.
- The backend system instruction explicitly says it has no web browsing or document retrieval (`gemini.py:38-40`).

This is a trust and accessibility issue: a user may believe the assistant can see the form in front of them when it cannot. The wording should be corrected immediately, or the page-context feature should be delivered. `[PROPOSED]` Phase 1 includes the wording fix.

### G.3 What real page awareness would require

| Requirement | Why | Risk / control `[PROPOSED]` |
|---|---|---|
| Content script injected on demand | Read the current page only when the user asks | Prefer `activeTab` + `chrome.scripting.executeScript` over broad host permissions. |
| Page text extraction | Give the model relevant context | Extract visible text, headings, labels, and field metadata; never send the full DOM or scripts. |
| Character/token budget | Avoid huge prompts and cost | Cap extracted text (for example 8,000-12,000 characters) and prioritize the selection/visible region. |
| Sensitive-data redaction | Avoid sending Aadhaar/OTP/password fields | Detect and omit sensitive input values by default; send labels, not values. |
| Prompt-injection defense | Page text is untrusted | Wrap context in delimiters, label it as untrusted, instruct the model to ignore page-embedded instructions. |
| User preview/consent | The user should know what leaves the device | Show "what I can see" summary before the first page-context request; allow disabling. |
| Element identity | Highlight the right field | Use stable selectors plus text/role fallbacks; never rely on brittle absolute XPath alone. |
| Highlighting and scrolling | Help the user locate a field | Inject CSS outline/overlay; remove on clear; restore focus. |
| Navigation | Open official pages | Allowlist schemes (`https`), confirm external navigation, never auto-submit forms. |
| Accessibility | Work with screen readers | Announce highlight/scroll actions via `aria-live`; preserve keyboard focus. |

### G.4 Recommended boundary

**Keep DOM operations extension-side.** Finding an element, highlighting it, scrolling to it, and reading the current tab are browser capabilities. Sending a "highlight selector" request to FastAPI would add latency, a privacy hop, and no value. The backend should receive **only the minimized text context** needed for reasoning, never raw DOM or page credentials.

`[PROPOSED]` message contract:

```ts
type PageContextRequest = {
  type: 'PAGE_CONTEXT_REQUEST';
  payload: { maxChars: number; includeSelection: boolean };
};

type PageContextResult = {
  type: 'PAGE_CONTEXT_RESULT';
  payload: {
    url: string;
    title: string;
    selection?: string;
    headings: string[];
    text: string;
    fields: Array<{ label: string; type: string; required: boolean }>;
    truncated: boolean;
  };
};

type HighlightElement = {
  type: 'HIGHLIGHT_ELEMENT';
  payload: { selector: string; scroll: boolean; durationMs: number };
};
```

`[PROPOSED]` navigation sequence:

1. Read-only context first.
2. Find/highlight/scroll second.
3. Open an allowlisted URL only after explicit confirmation.
4. Never auto-click a destructive action, auto-fill a sensitive field, or auto-submit a government form.

---

## H. Document-processing audit

### H.1 Current state

| Capability | Status | Evidence |
|---|---|---|
| Upload UI | `[MISSING]` | No file input in `src/sidepanel`. |
| Upload endpoint | `[MISSING]` | No route in `backend/app/main.py`. |
| PDF text extraction | `[MISSING]` | No PDF dependency. |
| DOCX extraction | `[MISSING]` | No DOCX dependency. |
| Image OCR | `[MISSING]` | No OCR dependency. |
| Telugu/Hindi OCR | `[MISSING]` | No language packs or cloud OCR. |
| Document Q&A / summarization | `[MISSING]` | No pipeline. |
| Document storage/retention | `[MISSING]` | No database or object storage. |
| Document tests | `[MISSING]` | No fixtures or tests. |

The only document-related statement in the repository is a disclaimer that the model has no document retrieval access (`gemini.py:38-40`) and a README limitation (`README.md:310-312`). There is no implementation.

### H.2 What the target requires

A document pipeline is materially different from chat. It needs ingestion, validation, extraction, possibly OCR, chunking, retrieval, and deletion. For a government-form assistant, the highest-value use case is probably **"explain this notice/form/PDF"**, not full RAG over a large corpus.

`[PROPOSED]` minimum pipeline:

```text
User selects a file
   -> client validates size/type
   -> POST /api/v1/documents/extract (multipart)
   -> server validates magic bytes, size, page count
   -> text PDFs: pypdf/pdfminer extraction
   -> scanned PDFs/images: OCR (Tesseract or cloud OCR)
   -> normalize text, cap pages/characters
   -> return extracted text + page metadata (no storage)
   -> client sends selected text to /api/v1/chat for explanation
   -> server discards the upload after the response
```

### H.3 Library and license options

| Option | Strength | Limitation | License / cost | Recommendation |
|---|---|---|---|---|
| `pypdf` | Pure Python, permissive, simple text extraction | Weaker layout/table handling; no OCR | BSD-style permissive | Start here for text PDFs. |
| `pdfminer.six` | Better text positioning than simple extraction | Slower, more complex | MIT | Consider for layout-sensitive forms. |
| `pdfplumber` | Good tables/layout | Depends on pdfminer; heavier | MIT | Consider for tabular forms. |
| PyMuPDF | Fast, high-quality rendering/extraction | AGPL or commercial license | AGPL/commercial | Avoid unless the license is approved. |
| `python-docx` | DOCX paragraphs/tables | No legacy `.doc` | MIT | Add with DOCX support. |
| Tesseract + `pytesseract` | Local OCR, language packs | Accuracy/latency; system dependency | Apache 2.0 engine; check language data | First local OCR option. |
| Google Cloud Vision / Document AI | Strong OCR, Telugu/Hindi support | Billing, data leaves device, setup | Paid | Evaluate if local OCR quality is insufficient. |
| Gemini native PDF/image input | Fewer moving parts | Model limits, cost, less control over extraction | Paid | Evaluate after the text pipeline is stable. |

### H.4 Security and privacy requirements

| Risk | Control `[PROPOSED]` |
|---|---|
| Oversized upload / zip bomb | Hard byte limit, page limit, decompression ratio limit, timeout. |
| Malicious PDF JavaScript/embedded files | Do not execute; use a parser that ignores scripts; sandbox extraction in a subprocess/container. |
| MIME spoofing | Check magic bytes, not only the filename/Content-Type. |
| Prompt injection inside a document | Label extracted text as untrusted; never follow document instructions; keep system policy separate. |
| PII in documents | Warn the user; redact Aadhaar/OTP/password-like patterns where feasible; do not persist. |
| Retention | Delete uploads and extracted text immediately after the response; no logs with content. |
| OCR language quality | Test Telugu/Hindi samples; expose confidence/warnings; allow text correction. |
| Cost abuse | Auth/quota, page caps, per-user rate limits, OCR only when needed. |

### H.5 Proposed document endpoints

`[PROPOSED]` only:

```text
POST /api/v1/documents/extract
Content-Type: multipart/form-data
file=<pdf|png|jpg|docx>
language=te

200 OK
{
  "success": true,
  "data": {
    "filename": "notice.pdf",
    "pages": 3,
    "text": "...",
    "truncated": false,
    "ocr_used": false,
    "language": "te"
  },
  "error": null,
  "request_id": "..."
}
```

Do not add document Q&A until extraction, privacy, and retention behavior are proven. The first release should be stateless extraction with an explicit "we do not store this file" statement.

---

## I. Security and privacy audit

### I.1 Confirmed strengths

| Control | Evidence | Assessment |
|---|---|---|
| API key server-side only | `config.py:22-30`, `README.md:25-27` | Good. No key in extension source. |
| Key never returned by health | `main.py:223-230`, `test_api.py` | Good. `configured` is a boolean. |
| Key stripped/validated | `config.py:55-59` | Good. Whitespace-only key is treated as missing. |
| CORS exact origins, wildcard rejected | `config.py:97-109`, `main.py:54-62` | Good when configured. Empty config disables cross-origin middleware. |
| No credentials in CORS | `main.py:59` | Good. |
| Request-size check | `main.py:143-156` | Partial; see findings. |
| Message length cap | `schemas.py:8-15` | Good for the message field. |
| Language allowlist | `schemas.py:10` | Good. |
| Upstream timeout | `gemini.py:97-102`, `gemini.py:118-125` | Good. |
| Safe error mapping | `main.py:77-113`, `main.py:199-211` | Good; no raw provider text. |
| No content logging | `main.py:43-47`, `main.py:160-168`, `main.py:201` | Good; noisy SDK/HTTP loggers forced to WARNING. |
| Stack traces not returned | `main.py:131-140` | Good. |
| Stateless backend | `main.py:8`, `README.md:271-282` | Good privacy default. |
| No client storage | `README.md:271-276` | Good, though it also means no history. |
| Build-time origin validation | `vite.config.ts:16-51` | Good: no wildcard, credentials, path, query, or non-loopback HTTP. |
| Manifest host permission limited | `vite.config.ts:93`, `public/manifest.json:29` | Good; no broad host permission today. |
| System instruction privacy rules | `gemini.py:44-53` | Good baseline, not a guarantee. |
| Offline tests | `backend/tests/` | Good; no live key needed. |

### I.2 Findings and risks

| ID | Severity | Finding | Evidence | Impact | Recommendation `[PROPOSED]` |
|---|---|---|---|---|---|
| SEC-01 | High | No backend authentication or user identity. | `README.md:323-325` | Anyone who can reach a deployed backend can consume Gemini quota and use the service. | Put the backend behind an authenticated gateway or add a signed client token; rate-limit by identity, not only IP. |
| SEC-02 | Medium | Rate limiting is process-local and keyed by client IP. | `deps.py:6-9`, `deps.py:61-75` | Multiple workers/instances multiply the limit; a proxy can make all users share one bucket or spoof `X-Forwarded-For` if trusted incorrectly. | Use a shared store (Redis) or gateway limiter; document trusted proxy configuration. |
| SEC-03 | Medium | Request-size guard checks only `Content-Length`. | `main.py:143-156` | A chunked request without that header can stream a large body; the app still parses it before validation. | Enforce a hard receive limit in the ASGI server/proxy; reject missing/invalid lengths; cap body at the gateway. |
| SEC-04 | Medium | No request IDs or structured audit fields. | `schemas.py:28-36`, `main.py:162-168` | Hard to correlate a user report with a log line; no safe support identifier. | Generate a UUID per request, return it, and log it with metadata only. |
| SEC-05 | Medium | OpenAPI/docs are enabled by default. | `FastAPI(...)` at `main.py:50` | Exposes the API surface and schemas in production. | Disable or protect `/docs`, `/redoc`, `/openapi.json` unless intentionally public. |
| SEC-06 | Medium | The UI claims page awareness that does not exist. | `locales.ts:73` | Users may trust the assistant with a page it cannot see; accessibility/trust harm. | Correct copy now; add page context only when it is real and consented. |
| SEC-07 | Medium | Browser speech privacy is outside BharatVoice's control. | `README.md:284-294` | Audio may be processed by Chrome/OS vendors; users may assume otherwise. | Keep the disclosure; add a server TTS option with explicit processing disclosure. |
| SEC-08 | Medium | No dependency/security scanning or CI. | No `.github/`, no audit script | Vulnerabilities or regressions can ship unnoticed. | Add CI with typecheck, tests, `pip-audit`/`npm audit`, and secret scanning. |
| SEC-09 | Low | Dead/placeholder code increases attack surface and confusion. | `src/messaging.ts`, `src/background/service-worker.ts`, `src/assistant.ts` | Reviewers may assume page messaging exists; unused code can drift. | Remove or clearly mark as experimental; add tests before wiring. |
| SEC-10 | Low | Provider error messages are English-only. | `main.py:92-113`, `App.tsx:16-36` | Non-English users see generic localized text; less actionable. | Return stable error codes and localize in the client. |
| SEC-11 | Low | No idempotency key or retry policy. | `src/api.ts`, `main.py` | User retries can duplicate provider cost. | Add idempotency for write-like operations; use bounded retries only for safe GETs. |
| SEC-12 | Low | CORS is not enabled when `CORS_ORIGINS` is empty. | `main.py:54-62` | Fail-closed, but browser calls fail with an opaque network error. | Provide a clear startup warning and document the required origin. |
| SEC-13 | Low | `CORS_ORIGINS` allows `http://` origins. | `config.py:105` | A deployed extension origin should be `chrome-extension://`; plain HTTP weakens transport assumptions. | Warn or reject non-loopback `http://` in production configuration. |

### I.3 Privacy data flow

| Data | Current path | Current retention | Target change `[PROPOSED]` |
|---|---|---|---|
| Typed message | Extension -> backend -> Gemini | Backend does not persist; provider retention governed by Google. | Keep; add explicit provider disclosure and data-minimization copy. |
| Recognized speech | Browser/OS speech service -> transcript -> extension | Not stored by BharatVoice; vendor behavior unknown. | Keep browser STT initially; disclose; later offer server STT with consent. |
| Reply text | Backend -> extension -> browser TTS | React memory only; not persisted. | Keep in memory; optional local history only with user control. |
| Page content | Never leaves the device today. | None. | Send minimized, redacted text only after consent; cap size; never send full DOM. |
| Audio for TTS | Never sent to backend today. | None. | If server TTS is added, send text only, not microphone audio; disclose provider. |
| Uploaded documents | Not supported. | None. | Process in memory/temporary storage, delete immediately, cap size/pages, warn about PII. |
| API key | Backend environment only. | Server environment. | Keep; use secret manager in production; rotate on exposure. |
| Client IP | In-memory rate limiter key. | Process memory only. | Move to shared limiter with retention policy; avoid logging raw IP. |

### I.4 Threat model summary

| Threat | Current exposure | Priority |
|---|---|---|
| Quota theft from a public backend | High (no auth) | P0 before public deployment |
| Malicious page content manipulating the assistant | None today; High once page context is added | P1 design control |
| Malicious document exploiting a parser | None today; High once uploads exist | P1 design control |
| Prompt injection in user text | Partially mitigated by system instruction | Existing residual risk |
| Secret leakage through logs/bundles | Low; controls exist | Maintain |
| Supply-chain vulnerability | Medium; no CI audit | P1 |
| Cross-tenant data leakage | None; no accounts or storage | Revisit if history/accounts are added |
| Denial of service via large bodies | Medium; header-only limit | P1 |

---

## J. Architecture gap analysis

### J.1 Prioritized gaps

| ID | Gap | Priority | Why it matters | Evidence | Target phase |
|---|---|---|---|---|---|
| GAP-01 | No backend TTS; Telugu read-aloud depends on an installed OS voice | P0 | The headline multilingual promise fails on common machines. | `speech.ts:94-104`, `useSpeech.ts:130-135`, no speech route | Phase 2 |
| GAP-02 | UI claims page awareness that does not exist | P0 | Trust and accessibility harm; misleading product claim. | `locales.ts:73`, `manifest.json:28` | Phase 1 |
| GAP-03 | No authentication for a deployable backend | P0 (before public deployment) | Quota abuse and uncontrolled cost. | `README.md:323-325` | Phase 1/7 |
| GAP-04 | No structured API envelope or request IDs | P1 | Harder client contracts, support, localization, and observability. | `schemas.py:28-36` | Phase 1 |
| GAP-05 | No frontend/extension tests or CI | P1 | Voice and chat regressions are undetected. | `package.json`, no test files, no `.github/` | Phase 1 |
| GAP-06 | No page context or content script | P1 | The core "help on this page" value is absent. | `manifest.json:28`, placeholder `messaging.ts` | Phase 3 |
| GAP-07 | No conversation history sent to the model | P1 | Follow-up questions are incoherent; poor assistant UX. | `README.md:21-22`, `README.md:313-314` | Phase 1/3 |
| GAP-08 | Request-size and rate-limit controls are not production-grade | P1 | DoS/cost risk under load or behind a proxy. | `main.py:143-156`, `deps.py:6-9` | Phase 1/7 |
| GAP-09 | No dynamic document language | P1 accessibility | Screen readers may use English pronunciation for Telugu/Hindi content. | `index.html:2` | Phase 1 |
| GAP-10 | No element finding, highlighting, or scrolling | P2 | Users still have to locate fields themselves. | No DOM code | Phase 4 |
| GAP-11 | No navigation or form actions | P2 | The assistant cannot guide the user through a site. | No `tabs`/DOM code | Phase 4 |
| GAP-12 | No backend STT | P2 | Browser recognition may be unavailable or privacy-ambiguous. | No route | Phase 5 |
| GAP-13 | No translation of page/document content | P2 | The model answers in a language but does not translate source material. | No route | Phase 5 |
| GAP-14 | No document upload, extraction, or OCR | P2 | Cannot explain notices/forms the user already has. | No route/dependency | Phase 6 |
| GAP-15 | No provider registry or capabilities endpoint | P2 | Adding TTS/STT becomes route-level coupling. | `main.py:32` | Phase 2 |
| GAP-16 | No streaming responses | P2 | Perceived latency; poor fit for long explanations. | `src/api.ts`, `main.py` | Phase 5/7 |
| GAP-17 | No metrics/tracing/alerting | P2 | Cannot measure latency, provider errors, or cost. | Logging only | Phase 7 |
| GAP-18 | Dead/placeholder code | P3 | Maintenance and security-review noise. | `assistant.ts`, `messaging.ts`, service worker | Phase 1 |
| GAP-19 | No lint/format configuration | P3 | Style drift and avoidable review friction. | `package.json` | Phase 1 |
| GAP-20 | No offline/local mode | P3 | Requires network for chat; browser speech varies. | No caching/local model | Deferred |

### J.2 Actual versus target capability matrix

| Capability | Actual | Target | Delta |
|---|---|---|---|
| Multilingual chat | `[EXISTING]` | `[TARGET]` | Keep. |
| Chat history/context | `[MISSING]` | `[TARGET]` | Add client-sent history or a short-lived session store. |
| Page context | `[MISSING]` | `[TARGET]` | Content script + consent + minimization. |
| Element find/highlight/scroll | `[MISSING]` | `[TARGET]` | Extension-side only. |
| Navigation/form guidance | `[MISSING]` | `[TARGET]` | Confirmed, allowlisted actions; no auto-submit. |
| Browser STT | `[EXISTING]` | `[TARGET FALLBACK]` | Keep; add backend option. |
| Backend STT | `[MISSING]` | `[TARGET]` | Multipart route + provider. |
| Browser TTS | `[EXISTING]` | `[TARGET FALLBACK]` | Keep as fallback. |
| Backend TTS | `[MISSING]` | `[TARGET]` | Telugu/Hindi-first provider. |
| Translation | `[MISSING]` | `[TARGET]` | Could be a chat mode before a dedicated endpoint. |
| Document extraction/OCR | `[MISSING]` | `[TARGET]` | Text PDF first, OCR later. |
| Provider registry | `[MISSING]` | `[TARGET]` | Capability discovery and clean adapters. |
| Structured API/request IDs | `[MISSING]` | `[TARGET]` | Versioned envelope. |
| Auth and shared limits | `[MISSING]` | `[TARGET]` | Before public deployment. |
| Tests/CI | `[PARTIAL]` | `[TARGET]` | Backend only today. |

### J.3 Architectural mismatches

1. **Capability gap, not a bad provider.** Gemini chat is correctly isolated and tested. The missing pieces are separate services and browser integration.
2. **Chat-specific API shape.** Every new capability would otherwise invent its own response shape. A common envelope is needed before speech/documents.
3. **No capability boundary between page and backend.** The current manifest shows the extension has no page access; adding it later requires a deliberate permission and consent design, not just an endpoint.
4. **No durable identity or quotas.** A stateless, unauthenticated backend is acceptable for local development, not for a public multilingual service.
5. **No test seam for the browser.** The voice layer has no unit tests because it touches globals directly. Introduce a small adapter interface so voice selection and fallback logic can be tested in Node.
6. **No feature flags.** Enabling TTS or page context for a subset of users would currently require a rebuild. Environment/config flags are needed.

### J.4 Recommended architectural decisions

| Decision | Recommendation | Rationale |
|---|---|---|
| Chat provider | Keep Gemini, extend behind the existing `AIProvider` port. | Working, tested, low migration risk. |
| TTS provider | Add `SpeechProvider`; Gemini TTS primary candidate, Cloud TTS fallback. | Decouples product from OS voices. |
| Browser speech | Keep as fallback, not the only path. | Free, but not guaranteed or controllable. |
| Page operations | Extension-side; backend receives minimized text only. | Latency, privacy, and browser API fit. |
| Navigation | Explicit, allowlisted, user-confirmed. | Government forms are high-stakes. |
| Storage | No conversation/document persistence by default. | Privacy-first; add only with explicit user control. |
| API | Versioned envelope with `request_id`; binary exception for audio. | Consistency and supportability. |
| Deployment | Auth gateway + shared rate limit + HTTPS. | Cost and abuse control. |
| Tests | Backend contract tests plus frontend unit tests and browser E2E. | Protect the only critical user journey. |

---

## K. Recommended implementation roadmap

The roadmap is sequenced to deliver the highest user-visible failure first (Telugu read-aloud) without destabilizing the working chat path. The estimates are planning ranges, not commitments.

### K.1 Phase summary

| Phase | Duration | Scope | Exit criteria | Main risk |
|---|---|---|---|---|
| 0. Audit and approval | Complete | This report; no code changes. | User approves scope. | Scope creep. |
| 1. Stabilize and tell the truth | 1-2 weeks | Copy fix, dynamic `lang`, welcome speech behavior, request IDs, error envelope design, body-limit hardening, CI, frontend tests, dead-code cleanup. | Typecheck, backend tests, new frontend tests, CI green; UI claim no longer misleading. | Contract churn if the envelope changes too early. |
| 2. Backend TTS | 2-3 weeks | `SpeechProvider`, `/api/v1/speech/synthesize`, Gemini TTS or Cloud TTS, browser fallback, cost/size limits, tests. | Telugu and Hindi audio play on a machine without OS voices; fallback works; no key leakage. | SDK upgrade, billing, voice quality. |
| 3. Read-only page context | 3-4 weeks | Content script, `activeTab`/`scripting`, context contract, redaction, consent preview, prompt-injection defenses. | User can ask about the current page; only minimized text leaves the device. | Privacy, permissions, extraction quality. |
| 4. Guided page actions | 2-3 weeks | Find/highlight/scroll, focus management, `aria-live`, allowlisted navigation. | Highlight/scroll works on test pages; no auto-submit. | Brittle selectors, accessibility regressions. |
| 5. STT and translation | 2-3 weeks | Backend transcription option, translation mode, streaming evaluation. | Audio can be transcribed server-side with consent; translated page text is available. | Audio privacy, cost, latency. |
| 6. Documents | 4-6 weeks | Upload, text PDF extraction, OCR, limits, deletion, document explanation. | A Telugu/English text PDF can be explained without persistence; OCR path is bounded. | Parser security, OCR quality, PII. |
| 7. Production hardening | Ongoing | Auth, shared rate limit, metrics/tracing, dependency scanning, deployment. | Public deployment passes abuse/cost/observability review. | Operational scope. |

### K.2 Phase 1: Stabilize the existing product

**Goal:** make the current MVP honest, observable, and testable before adding surfaces.

`[PROPOSED]` tasks:

1. Replace "right on the page you are using" with accurate copy until page context exists (`src/locales.ts`).
2. Set `document.documentElement.lang` from the selected language; update `<html lang>` handling in both builds.
3. Stop auto-speaking the welcome message, or only speak after a user gesture. Keep the text welcome.
4. Add a stable `request_id` to responses and logs; define a versioned envelope.
5. Harden body limits at the ASGI/proxy layer and reject missing/invalid `Content-Length` where appropriate.
6. Add frontend unit tests for voice selection, fallback rules, error mapping, abort behavior, and language switching.
7. Add a minimal CI workflow: typecheck, backend pytest, frontend tests, dependency audit, secret scan.
8. Remove or quarantine `src/assistant.ts` and the unused message/port placeholders, or label them as future work.
9. Add a `lint` script and format check.
10. Document the current capabilities and non-capabilities in the README and UI.

**Exit criteria:** no misleading page claim; Telugu missing-voice behavior is explained; request IDs exist; CI runs on every change; all existing tests still pass.

### K.3 Phase 2: Add backend TTS

**Goal:** Telugu and Hindi read-aloud no longer depend on an installed OS voice.

`[PROPOSED]` tasks:

1. Define `SpeechProvider` with `synthesize(text, language, options) -> AudioResult`.
2. Add a provider registry with `tts` capability metadata; keep provider names out of routes.
3. Add `POST /api/v1/speech/synthesize`, with text length cap, language allowlist, rate limit, and no content logging.
4. Implement one provider first:
   - Preferred: Gemini TTS after upgrading `google-genai` to `>= 2.25.0`.
   - Alternative: Google Cloud TTS with explicit `te-IN`/`hi-IN`/`en-IN` voices.
5. Return binary `audio/mpeg` with `X-Request-Id`, `X-Provider`, `Cache-Control: no-store`.
6. Frontend: `backendTts` adapter; try backend first, then browser voice if a matching voice exists, then show text with an "audio unavailable" note.
7. Add a voice/rate selector if the provider supports it.
8. Add contract tests with a fake audio provider and manual Telugu/Hindi listening checks.
9. Add cost guardrails: per-IP/user limits, max characters, provider budget alert, feature flag.

**Exit criteria:** Telugu text produces intelligible audio on a machine with no Telugu OS voice; failure falls back cleanly; chat tests remain green; no audio or text is logged.

### K.4 Phase 3: Read-only page context

**Goal:** the assistant can answer "what does this page/field mean?" using the current tab, without acting on it.

`[PROPOSED]` tasks:

1. Add an on-demand content script injected with `activeTab` + `chrome.scripting.executeScript`; avoid broad host permissions.
2. Extract title, URL, selection, headings, visible text, and form labels/types/required flags; omit input values by default.
3. Cap context size and mark it truncated; add a user preview/consent step.
4. Add `PAGE_CONTEXT_REQUEST` / `PAGE_CONTEXT_RESULT` messages and a background relay.
5. Update the chat contract to accept optional page context; wrap it as untrusted content in the prompt.
6. Add redaction for Aadhaar/OTP/password-like patterns and a "do not send this page" control.
7. Add tests with a local fixture page and adversarial prompt-injection text.

**Exit criteria:** a user can ask about the active page; only minimized text is sent; consent is visible; no navigation or form mutation occurs.

### K.5 Phase 4: Guided page actions

**Goal:** help the user find, see, and reach the right field or page.

`[PROPOSED]` tasks:

1. Implement `FIND_ELEMENT` with role/label/text heuristics and stable selectors.
2. Implement `HIGHLIGHT_ELEMENT`, `CLEAR_HIGHLIGHTS`, and `SCROLL_TO_ELEMENT` entirely in the content script.
3. Announce actions via `aria-live`; restore focus when clearing.
4. Add allowlisted external navigation with a confirmation dialog; never auto-submit.
5. Add an action audit log in the panel (local only) so the user can see what happened.
6. Test on representative government-style forms, including keyboard-only and screen-reader paths.

**Exit criteria:** highlight/scroll is reliable on fixtures; no destructive action occurs without explicit confirmation.

### K.6 Phase 5: STT and translation

**Goal:** reduce dependence on browser speech services and translate source content.

`[PROPOSED]` tasks:

1. Add `POST /api/v1/speech/transcribe` with multipart limits (duration, bytes), language allowlist, and immediate deletion.
2. Evaluate Gemini transcription or Cloud STT; keep browser STT as fallback.
3. Add a translation mode that preserves meaning and flags uncertainty; do not silently alter official wording.
4. Evaluate streaming for chat and transcription; add only if latency measurements justify it.

**Exit criteria:** server STT works with consent and bounded retention; translation is labeled as assistive and not official.

### K.7 Phase 6: Documents

**Goal:** explain a user-provided notice, form, or PDF.

`[PROPOSED]` tasks:

1. Add upload UI with file type/size/page limits and a "not stored" notice.
2. Implement text PDF extraction with `pypdf`; add DOCX if needed.
3. Add OCR only for scanned PDFs/images, with Telugu/Hindi language packs or cloud OCR.
4. Add magic-byte validation, parser sandboxing, timeouts, and deletion.
5. Return extracted text; reuse the chat endpoint for explanation with explicit document context.
6. Add fixtures for Telugu/English PDFs, malformed files, and oversized inputs.

**Exit criteria:** a text PDF can be explained reliably; no file persists; parser and size limits are tested.

### K.8 Phase 7: Production hardening

`[PROPOSED]` tasks: authenticated gateway or signed client identity, shared rate limiting, TLS everywhere, metrics/tracing/alerting, dependency and container scanning, backup/retention policy (if storage is added), incident runbook, and load tests.

### K.9 Suggested first pull request

Do not combine phases. The first code change after approval should be a narrow Phase 1 PR containing:

- copy correction;
- dynamic `lang`;
- welcome-speech change;
- request ID plumbing and envelope design document/tests;
- CI skeleton;
- frontend test harness for voice selection.

Do not upgrade `google-genai` in the same PR as the UI changes. Keep the SDK upgrade isolated with its own test evidence.

---

## L. Proposed target architecture

Everything in this section is `[PROPOSED]`. It is a direction, not an implemented state.

### L.1 Target diagram

```text
+-----------------------------------------------------------------------+
| Chrome extension                                                      |
|                                                                       |
|  Side panel (React)                                                   |
|    chat + language + consent + audio controls                         |
|         |                         ^                                   |
|         | HTTPS JSON              | audio / transcript / text         |
|         v                         |                                   |
|  Background service worker                                            |
|    - side panel behavior                                               |
|    - relay between side panel and content script                      |
|    - no provider secrets                                              |
|         |                                                             |
|         v                                                             |
|  Content script (on demand, activeTab)                                |
|    - read page context                                                |
|    - find / highlight / scroll                                        |
|    - no auto-submit                                                   |
+------------------------------|----------------------------------------+
                               | minimized text only, with consent
                               v
+-----------------------------------------------------------------------+
| FastAPI backend                                                       |
|                                                                       |
|  /api/v1/chat          -> ChatService -> ChatProvider (Gemini)         |
|  /api/v1/speech/*      -> SpeechService -> TTS/STT providers          |
|  /api/v1/documents/*   -> DocumentService -> extract/OCR providers    |
|  /api/v1/providers     -> capability registry (no secrets)            |
|  /healthz              -> liveness/readiness                           |
|                                                                       |
|  auth / quotas / shared rate limit / request IDs / safe errors        |
|  no persistent storage by default; short-lived memory only            |
+------------------------------|----------------------------------------+
                               |
          +--------------------+--------------------+
          |                    |                    |
          v                    v                    v
   Gemini chat          Gemini/Cloud TTS     Cloud/Document OCR
   (existing)           (new)                (only if opted in)
```

### L.2 Proposed module structure

```text
backend/
  app/
    main.py                       # app assembly, middleware, router mounting
    api/
      routes/
        chat.py                   # POST /api/v1/chat
        speech.py                 # synthesize + transcribe
        documents.py              # extract
        providers.py              # capability registry
        health.py                 # /healthz
    core/
      config.py                   # typed settings, fail-fast validation
      errors.py                   # error taxonomy + envelope helpers
      middleware.py               # request ID, body limit, timing
      security.py                 # auth, quotas, rate-limit interface
      logging.py                  # content-safe structured logging
    schemas/
      common.py                   # Envelope, ErrorBody, RequestMeta
      chat.py
      speech.py
      documents.py
    services/
      chat/
        service.py
        prompt.py
      speech/
        service.py
        tts.py
        stt.py
        fallback.py
      documents/
        service.py
        extract.py
        ocr.py
      providers/
        registry.py
        base.py
    adapters/
      gemini_chat.py
      gemini_tts.py
      google_tts.py
      google_stt.py
      indicf5.py
  tests/
    test_chat_api.py
    test_speech_api.py
    test_document_api.py
    test_providers.py
    test_security.py
    fixtures/

src/
  api/
    client.ts                     # shared fetch, envelope, request ID, timeout
    chat.ts
    speech.ts
    documents.ts
  voice/
    browserTts.ts
    browserStt.ts
    backendTts.ts
    selectVoice.ts
  content/
    extractPage.ts
    findElement.ts
    highlight.ts
    scroll.ts
  background/
    service-worker.ts
  shared/
    messages.ts                   # typed, versioned message contracts
  sidepanel/
    App.tsx
    components/
    hooks/

tests/                            # frontend unit tests (Vitest) and browser E2E
```

### L.3 Proposed API envelope

```json
{
  "success": true,
  "data": {},
  "error": null,
  "request_id": "018f5c3e-7b2a-7c4d-9e10-2f6a1b8c9d01"
}
```

Error:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "provider_unavailable",
    "message": "The assistant is temporarily unavailable. Please try again later.",
    "retryable": true
  },
  "request_id": "018f5c3e-7b2a-7c4d-9e10-2f6a1b8c9d01"
}
```

Rules `[PROPOSED]`:

- `code` is stable and machine-readable; `message` is safe and localizable by the client.
- `request_id` is generated server-side, returned to the client, and logged with metadata only.
- No stack traces, provider text, user content, or secrets in errors.
- Binary audio is the only deliberate non-envelope response; it still carries `X-Request-Id`.
- Version the path (`/api/v1`) and keep `/api/chat` as a compatibility shim until the extension migrates.

### L.4 Proposed chat contract

```json
{
  "messages": [
    { "role": "user", "content": "What does this field mean?" }
  ],
  "language": "te",
  "page_context": {
    "url": "https://example.gov.in/form",
    "title": "Application form",
    "text": "minimized, untrusted page text",
    "truncated": false
  }
}
```

Response `data`:

```json
{
  "answer": "...",
  "provider": "gemini",
  "model": "gemini-3.5-flash-lite",
  "language": "te"
}
```

Backward compatibility: accept the existing `{ message, language }` shape at `/api/chat` and translate it into a single-message `messages` array internally. Do not require the old extension to change on day one.

### L.5 Proposed speech contracts

```text
POST /api/v1/speech/synthesize
  { text, language, voice?, format? }
  -> 200 audio/mpeg
     X-Request-Id, X-Provider, Cache-Control: no-store

POST /api/v1/speech/transcribe
  multipart: audio, language
  -> 200 envelope { transcript, language, duration_ms, provider }
```

Constraints `[PROPOSED]`: max 2,000 characters per synthesis request, max 60 seconds/10 MB per transcription, language allowlist `en/hi/te`, no raw audio logging, immediate deletion, per-identity quota.

### L.6 Proposed page-context contracts

See section G.4. Requirements: on-demand injection, activeTab, minimized text, redaction, consent preview, untrusted-content delimiters, and no backend DOM operations.

### L.7 Proposed configuration strategy

| Variable | Purpose | Default | Secret? |
|---|---|---|---|
| `GEMINI_API_KEY` | Chat and optionally TTS | empty | Yes |
| `GEMINI_MODEL` | Chat model | `gemini-3.5-flash-lite` | No |
| `GEMINI_TIMEOUT_SECONDS` | Upstream deadline | `30` | No |
| `GEMINI_MAX_OUTPUT_TOKENS` | Chat output cap | `512` | No |
| `TTS_PROVIDER` | `gemini`, `google_cloud`, `browser`, `none` | `none` until enabled | No |
| `STT_PROVIDER` | `browser`, `gemini`, `google_cloud`, `none` | `browser` | No |
| `GOOGLE_CLOUD_PROJECT` | Cloud TTS/STT project | empty | No |
| `GOOGLE_APPLICATION_CREDENTIALS` | Cloud service account path | empty | Yes |
| `CORS_ORIGINS` | Exact allowed origins | empty | No |
| `MAX_REQUEST_BODY_BYTES` | Body cap | `4096` (raise for documents) | No |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | Per-identity limit | `30` | No |
| `AUTH_MODE` | `none`, `gateway`, `signed_token` | `none` (local only) | No |
| `FEATURE_PAGE_CONTEXT` | Enable page context | `false` | No |
| `FEATURE_TTS` | Enable backend TTS | `false` | No |
| `FEATURE_DOCUMENTS` | Enable uploads | `false` | No |

Configuration rules `[PROPOSED]`: validate at startup, fail fast on impossible combinations (for example, `TTS_PROVIDER=gemini` without a key), never log secret values, and expose only a boolean "configured" state.

### L.8 Proposed error strategy

| Error class | HTTP | Client behavior | Retry? |
|---|---|---|---|
| Validation | `422` | Highlight the field; keep input. | No |
| Unauthorized | `401`/`403` | Re-authenticate or explain access. | No |
| Rate limited | `429` + `Retry-After` | Show wait time; keep input. | After delay |
| Provider timeout | `504` | Offer retry. | Yes, bounded |
| Provider quota | `429` | Show busy state; do not loop. | No immediate retry |
| Provider unavailable | `503` | Offer retry. | Yes, bounded |
| Empty output | `502` | Retry once. | Yes, once |
| Document too large | `413` | Explain limits. | No |
| Unsupported document | `415` | Explain formats. | No |
| Internal | `500` + request ID | "Contact support with this ID." | No |

Client retries `[PROPOSED]`: only for idempotent/safe operations, with exponential backoff and jitter, maximum 2 attempts, never retry validation/auth/quota errors. Add idempotency keys for future write operations.

### L.9 Proposed testing strategy

| Layer | Tooling | What to test |
|---|---|---|
| Backend unit | pytest | Schemas, config, error mapping, provider adapters with fakes. |
| Backend contract | pytest + TestClient | Envelope shape, status codes, request IDs, body limits, CORS, auth. |
| Speech contract | pytest + fake audio | Language allowlist, text caps, provider fallback, binary headers. |
| Frontend unit | Vitest + Testing Library | Voice selection, fallback, abort, language switch, error rendering. |
| Extension integration | Vitest + mocked `chrome.*` | Message contracts, content-script relay, permission guards. |
| Browser E2E | Playwright (Chromium persistent context) | Load unpacked extension, chat, TTS fallback, page context, highlight. |
| Manual | Chrome + Windows/Android voices | Telugu/Hindi listening, screen reader, microphone permission, autoplay policy. |
| Security | pip-audit, npm audit, secret scan, load test | Dependency and abuse regressions. |

No live provider calls in CI. Use recorded fixtures and fake adapters. Add one scheduled/manual smoke test with a dedicated key and budget.

### L.10 Migration path

1. Add the envelope and `/api/v1` routes alongside `/api/chat`.
2. Migrate the extension client to `/api/v1/chat`; keep the old route until the next release.
3. Add TTS without changing chat behavior.
4. Add page context behind a feature flag and consent flow.
5. Add navigation actions only after page-context tests pass.
6. Add documents last, with separate quotas and retention tests.
7. Remove compatibility shims only after telemetry (metadata only) shows no old clients.

---

## M. Testing and verification

### M.1 Checks executed in this audit

| Check | Command / method | Result | Evidence |
|---|---|---|---|
| Git state | `git status --short`; `git log --oneline -3` | Clean working tree at `630ec2d`. | No modified/staged files reported. |
| Extension typecheck | `npx tsc -p tsconfig.extension.json --noEmit` | Passed, exit 0. | Command output in audit session. |
| Web typecheck | `npx tsc -p tsconfig.web.json --noEmit` | Passed, exit 0. | Command output in audit session. |
| Python syntax | AST parse of 12 backend Python files | 0 syntax errors. | Audit session. |
| Backend tests | `pytest` against `backend/` | **40 passed**, 1 Starlette/httpx deprecation warning. | Audit session. The project venv does not contain pytest; the run used the project interpreter with pytest tooling from the local `backend/.venv_old`. No live key or network was used. |
| Secret scan (spot check) | Search built output for obvious Gemini key patterns | None found. | `dist/` and `dist-web/` spot check. |
| Git tracking of secrets/builds | `.gitignore` inspection | `.env`, `backend/.env`, `backend/.venv`, `dist/`, `dist-web/` ignored. | Repository inspection. |
| Documentation presence | Directory check | No pre-existing `docs/` or architecture audit; this file is new. | Repository inspection. |

### M.2 Checks not executed

| Check | Status | Why |
|---|---|---|
| Production extension build | `[UNVERIFIED]` | Not run to avoid overwriting the existing `dist/` and `dist-web/` artifacts. Typechecks were used instead. |
| Live Gemini chat | `[UNVERIFIED]` | Requires the real key/quota; no credentials were used. |
| Live Gemini/Cloud TTS | `[UNVERIFIED]` | Not implemented and would require billing/credentials. |
| Live STT | `[UNVERIFIED]` | Not implemented; browser/OS behavior not exercised. |
| Telugu/Hindi audio quality | `[UNVERIFIED]` | Requires listening tests and native speakers. |
| Chrome side-panel interaction | `[UNVERIFIED]` | No browser automation was run. |
| Microphone permission/device behavior | `[UNVERIFIED]` | Requires Chrome and audio hardware. |
| Screen-reader behavior | `[UNVERIFIED]` | No assistive-technology session. |
| Load/performance test | `[UNVERIFIED]` | No load harness; rate limiter is in-process. |
| Dependency vulnerability scan | `[UNVERIFIED]` | No `pip-audit`/`npm audit` run in this audit. |
| Docker/cloud deployment | `[UNVERIFIED]` | No deployment artifacts or target environment. |

### M.3 Test suite coverage assessment

**Covered by backend tests (`40 passed`):**

- `/healthz` with and without a key; key non-disclosure.
- Successful chat; language forwarding; only the current message forwarded.
- Unsupported language, empty/whitespace messages, oversized messages, malformed JSON, oversized body.
- Missing key, provider timeout, auth failure, quota, unavailable, empty response, unexpected provider error.
- Rate limiting.
- Log leakage checks.
- Config validation: key trimming, empty model, timeout range, CORS wildcard/bare origin, token range.
- Gemini adapter: language/system instruction, empty/None text, timeout mapping, slow-call cutoff, API error categories, missing key at construction.

**Not covered:**

- Any React component or hook.
- Voice selection/fallback behavior.
- Abort/language-switch races in the UI.
- The build-time manifest/CSP rewrite.
- Extension permissions or content-script behavior.
- Any real provider call.
- Any speech audio output.
- Document processing (not implemented).

### M.4 Recommended verification for the next phase

1. **Frontend unit tests** for `selectVoiceForLang`, missing-voice behavior, `speakText` fallback order, and abort races.
2. **Backend contract tests** for the new envelope, request ID, body limit, and TTS route with a fake audio provider.
3. **Playwright extension test**: load unpacked `dist/`, open the side panel, send a message against a fake backend, verify the reply and text fallback.
4. **Manual Telugu/Hindi audio test** on a machine with no matching OS voice.
5. **Manual accessibility test** with keyboard-only navigation and a screen reader; verify `lang` changes and error announcements.
6. **Security checks**: `pip-audit`, `npm audit`, secret scan, and a basic load test for the rate limiter/body limit.
7. **Build verification**: run `npm run build` and `npm run build:web` in CI, inspect the generated manifest/CSP, and only then reload the extension.

### M.5 Audit limitations and assumptions

- The target architecture was inferred from the requested capabilities and the repository's own placeholders. It is not a line-by-line comparison against a separate target specification.
- Provider model names, free tiers, and pricing change frequently. The provider table reflects official documentation at audit time; re-verify before implementation.
- The audit did not inspect `backend/.env` values. Only `.env.example` and configuration code were reviewed.
- The audit did not treat README claims as proof. Each capability claim was checked against source.
- The working tree was clean; no user changes were present to preserve or reconcile.

### M.6 Evidence index

| Topic | Primary evidence |
|---|---|
| Only two application routes | `backend/app/main.py:172`, `backend/app/main.py:223` |
| Flat chat contract | `backend/app/schemas.py:18-36` |
| Config and validation | `backend/app/config.py:22-121` |
| Provider port and Gemini adapter | `backend/app/services/ai_provider.py:24-34`, `backend/app/services/gemini.py:81-168` |
| Rate limiter limitations | `backend/app/deps.py:6-9`, `backend/app/deps.py:61-75` |
| Body-size check | `backend/app/main.py:143-156` |
| Browser STT/TTS | `src/voice/speech.ts:120-296` |
| Telugu missing-voice decision | `src/voice/speech.ts:87-104`, `src/hooks/useSpeech.ts:126-135` |
| Welcome autoplay | `src/sidepanel/App.tsx:78-89` |
| No page access | `public/manifest.json:28`, no content scripts |
| Placeholder messaging | `src/messaging.ts`, `src/background/service-worker.ts` |
| Misleading page claim | `src/locales.ts:73` |
| Static document language | `src/sidepanel/index.html:2`, `src/web/index.html:2` |
| No frontend tests/CI | `package.json`, no test files, no `.github/` |
| Privacy and limitations | `README.md:257-329` |

---

**End of audit.** No source code was modified. The next action requires explicit approval of the proposed phase and scope.
