# BharatVoice — Stage 1: Chrome Extension Foundation

BharatVoice is a multilingual, voice-first accessibility assistant that helps
Indian citizens understand and navigate government websites in their own
languages. This repository contains **Stage 1**: a working, installable Chrome
Extension (Manifest V3) with a side panel UI and a real browser speech
recognition/synthesis foundation. The assistant in Stage 1 is a **local
demonstration only** — there is no AI backend, no government data, and no
scheme verification yet (those come in later stages).

## What Stage 1 includes

- **Chrome Extension Manifest V3** with a background service worker and the
  Chrome Side Panel API (clicking the extension icon opens the side panel).
- **React + TypeScript** side panel, built with **Vite**.
- **UI**: BharatVoice branding, description, Telugu/Hindi/English language
  selector, microphone button, text input, send button, conversation area
  (user + assistant messages), listening/processing/speaking indicators,
  error and permission messages, stop-speech button, and clear-conversation
  control. Designed for Chrome's narrow side panel, with keyboard navigation
  and focus styles.
- **Real voice interaction**: browser `SpeechRecognition` (`te-IN`, `hi-IN`,
  `en-IN`) where available, with recognized text shown in the input so users
  can edit or correct it before sending; `speechSynthesis` playback for
  assistant responses in the selected language; stop button; graceful handling
  of unsupported browsers, denied permissions, and recognition errors. Text
  input always works as an alternative.
- **Deterministic demonstration assistant**: accepts typed or recognized
  speech, shows the user's question, and returns a clearly identified demo
  response (never presented as real AI or verified government information).
- **Modular architecture**: extension config, background worker, React UI,
  voice input/output, conversation handling, browser messaging, and
  content-script integration points kept separate, ready for Stage 2 (AI) and
  Stage 3 (contextual webpage help).

## Project structure

```
bharatvoice/
├── public/                 # Copied verbatim into dist/
│   ├── manifest.json       # Manifest V3 extension manifest
│   └── icons/              # Extension icons (SVG)
├── src/
│   ├── background/service-worker.ts   # Service worker: side panel setup
│   ├── messaging.ts                   # Typed message contract (Stages 2-3 ready)
│   ├── types.ts                       # Shared types
│   ├── locales.ts                     # en / hi / te UI strings
│   ├── assistant.ts                   # Stage 1 deterministic demo assistant
│   ├── voice/speech.ts                # SpeechRecognition / speechSynthesis wrappers
│   ├── hooks/useSpeech.ts             # React voice hook
│   └── sidepanel/
│       ├── index.html                 # Side panel entry point
│       ├── main.tsx                   # React bootstrap
│       ├── App.tsx                    # Shell: conversation, input, status
│       ├── index.css                  # Lightweight purpose-built styles
│       └── components/                # BrandHeader, LanguageSelector, Conversation,
│                                      # MessageBubble, StatusBanner, InputArea
├── package.json
├── tsconfig.json
├── vite.config.ts                     # Multi-entry Vite build (side panel + service worker)
└── README.md
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |

## Building

```bash
npm install
npm run build
```

The build output in `dist/` contains:
- `manifest.json` — valid Manifest V3
- `background/service-worker.js` — background service worker (module)
- `sidepanel/index.html` — side panel entry point
- `sidepanel/assets/` — bundled JS + CSS
- `icons/` — extension icons

## Loading into Chrome ("Load unpacked")

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (toggle at top right).
3. Click **Load unpacked** and select the `dist/` folder of this project.
4. The **BharatVoice** extension appears in your toolbar. Click its icon — the
   side panel opens alongside the current page (if the side panel does not
   open, click the extension icon again or check `chrome://extensions` →
   BharatVoice → "Side panel" permissions).

## How to test Stage 1

1. Open any website (e.g. a government portal) and click the BharatVoice icon.
   The side panel opens without navigating away.
2. The panel greets you in the selected language (English by default).
3. Change the language using the selector (Telugu / Hindi / English). The
   greeting restarts in the new language.
4. Type a question in the text input and press **Send** (or Enter). The demo
   assistant replies and reads the reply aloud (if a suitable synthesis voice
   is installed). Every assistant reply ends with a disclaimer stating this is
   a Stage 1 demonstration, not real AI or verified government information.
5. Click the microphone button (**🎙**) to speak. Recognized text appears in
   the input box — edit it if needed, then send. Grant microphone permission
   when prompted.
6. While the assistant is speaking or while listening, a **⏹ Stop** button is
   visible to halt speech/listening.
7. **Clear conversation** resets the chat.
8. If speech recognition is unsupported in your browser, a notice appears and
   typing continues to work; microphone denial shows a permission message.

## What Stage 1 deliberately does NOT include

No Gemini/LLM API, no backend, no database, no authentication, no government
scheme data or scraping, no automated form filling, no WhatsApp/email, and no
API keys in extension code. See the product roadmap (Stage 2–5) for what is
planned next.

## Manual testing note

This environment cannot drive Chrome automatically, so "Load unpacked" and the
voice interactions above must be verified manually. Browser speech
recognition/synthesis support varies by operating system and Chrome version;
Telugu/Hindi recognition is available only where the browser provides it.
Unsupported voice features are surfaced as explicit UI messages rather than
silent failures.

## License

Private — BharatVoice project.

## Privacy and data handling (Stage 1)

### What data BharatVoice processes

- Text you type into the input box is held in memory only for the current side-panel session. It is passed to the local, deterministic demonstration assistant to generate a reply, then spoken aloud using the browser's built-in speech synthesis if you choose.
- Recognized speech (when you press the microphone button) is captured by the browser's SpeechRecognition API and shown in the input box so you can edit or correct it before sending. BharatVoice itself does not record or store audio.
- Language selection (Telugu/Hindi/English) is held in memory for the current session only.
- Conversation history (user messages and assistant replies) is held in React component memory only while the side panel is open.

### What BharatVoice stores

- Nothing on disk. There is no localStorage, sessionStorage, IndexedDB, chrome.storage, cookies, or database. Conversation history, recognized speech, and any text you type exist only in memory for the current side-panel session and are cleared when you close the panel or click "Clear conversation."

### What BharatVoice does NOT transmit

- The extension itself makes no network requests — no fetch, XMLHttpRequest, WebSocket, or sendBeacon calls exist in the code.
- BharatVoice does not send audio, recognized text, conversation contents, personal information, or webpage contents to a BharatVoice server or to any third-party AI service.
- There are no analytics, tracking pixels, telemetry, or third-party scripts of any kind.

### Browser speech-recognition privacy limitations

BharatVoice uses Chrome's built-in SpeechRecognition API (te-IN, hi-IN, en-IN) where the browser provides it. Whether the browser sends your audio to an external speech-recognition service is determined by Chrome and your operating system, not by BharatVoice. BharatVoice cannot verify or control this, and does not label speech recognition as local or offline. If you are concerned about audio leaving your device, use the text-input alternative instead of the microphone button.

### Microphone activation and controls

- Microphone recognition starts only after you explicitly click the microphone button (a direct user action). There is no background or automatic recording.
- A Stop button halts ongoing listening and speech playback.
- Clear conversation removes all in-memory messages and stops speech.
- Text input always works as an alternative to speaking; you never need to use the microphone.

### Current limitations

- Browser speech-recognition quality and language coverage (te-IN, hi-IN, en-IN) vary by Chrome version and operating system.
- This privacy assessment is based on source-code inspection of the extension itself. It does not independently verify Chrome's internal speech-recognition behavior or your operating system's audio handling.
- Do not interpret the absence of BharatVoice network requests as a guarantee that the browser or OS makes none.
