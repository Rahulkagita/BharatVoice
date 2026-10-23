import type { LanguageCode } from '../types';

/** Browser capability flags for the voice layer. */
export interface SpeechCapabilities {
  recognition: boolean;
  synthesis: boolean;
}

const SpeechRecognitionCtor =
  typeof window !== 'undefined'
    ? (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition
    : undefined;

export function isRecognitionSupported(): boolean {
  return !!SpeechRecognitionCtor;
}

export function isSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && !!window.speechSynthesis;
}

export function recognitionLangFor(code: LanguageCode): string {
  switch (code) {
    case 'te':
      return 'te-IN';
    case 'hi':
      return 'hi-IN';
    default:
      return 'en-IN';
  }
}

export function synthesisLangFor(code: LanguageCode): string {
  return recognitionLangFor(code);
}

let synthesisVoices: SpeechSynthesisVoice[] = [];
let voicesLoaded = false;
let voicesLoading: Promise<void> | null = null;

/** Ensures `speechSynthesis.getVoices()` has populated asynchronously. */
export function loadSynthesisVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isSynthesisSupported()) return Promise.resolve([]);

  const synth = window.speechSynthesis!;
  if (voicesLoaded) {
    // Re-read in case the OS installed a voice after the first load.
    const current = synth.getVoices();
    if (current.length > 0) synthesisVoices = current;
    return Promise.resolve(synthesisVoices);
  }
  if (voicesLoading) return voicesLoading.then(() => synthesisVoices);

  const available = synth.getVoices();
  if (available && available.length > 0) {
    synthesisVoices = available;
    voicesLoaded = true;
    return Promise.resolve(synthesisVoices);
  }

  voicesLoading = new Promise<void>((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      synthesisVoices = synth.getVoices();
      voicesLoaded = true;
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      resolve();
    };

    const onVoicesChanged = () => {
      // Some platforms fire voiceschanged before any voices are usable.
      if (synth.getVoices().length > 0) finish();
    };

    synth.addEventListener('voiceschanged', onVoicesChanged);
    setTimeout(finish, 1500);
  });

  return voicesLoading.then(() => synthesisVoices);
}

/**
 * Pick a voice matching the requested language.
 *
 * Deliberately does not fall back to English for Hindi/Telugu: silently
 * speaking a Hindi answer with an English voice would mislead the user. The
 * hook surfaces a missing-voice message instead.
 */
export function selectVoiceForLang(langCode: string): SpeechSynthesisVoice | undefined {
  if (!voicesLoaded) return undefined;

  const requested = langCode.toLowerCase();
  const base = requested.split('-')[0];
  return (
    synthesisVoices.find((voice) => voice.lang.toLowerCase() === requested) ??
    synthesisVoices.find((voice) => voice.lang.toLowerCase().startsWith(`${base}-`)) ??
    synthesisVoices.find((voice) => voice.lang.toLowerCase() === base)
  );
}

export interface RecognitionHandlers {
  onStart?: () => void;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (code: string, message: string) => void;
  onEnd?: () => void;
}

let recognitionInstance: any = null;
let recognitionToken = 0;

/**
 * Start a single-shot recognition session. Results (interim + final) are
 * surfaced via handlers so the UI can show recognized text while listening.
 */
export function startRecognition(lang: string, handlers: RecognitionHandlers): void {
  if (!isRecognitionSupported()) {
    handlers.onError?.('not-supported', 'Speech recognition is not supported by this browser.');
    return;
  }

  stopRecognition();

  const rec = new SpeechRecognitionCtor();
  const token = ++recognitionToken;
  const isCurrent = () => token === recognitionToken && recognitionInstance === rec;

  rec.lang = lang;
  rec.continuous = false;
  rec.interimResults = true;
  recognitionInstance = rec;

  rec.onstart = () => {
    if (!isCurrent()) return;
    handlers.onStart?.();
  };

  rec.onresult = (event: any) => {
    if (!isCurrent()) return;

    let finalTranscript = '';
    let interimTranscript = '';
    for (let i = 0; i < event.results.length; i += 1) {
      const transcript = event.results[i][0]?.transcript ?? '';
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }
    handlers.onResult?.(finalTranscript || interimTranscript, !!finalTranscript);
  };

  rec.onerror = (event: any) => {
    if (!isCurrent()) return;

    const code = String(event.error ?? 'unknown');
    // Abort is our own cancellation path, not a user-facing failure.
    if (code === 'aborted') return;

    const errorMap: Record<string, string> = {
      'not-allowed': 'not-allowed',
      'audio-capture': 'audio-capture',
      'not-supported': 'not-supported',
      'language-not-supported': 'not-supported',
      network: 'network',
      'no-match': 'no-match',
      'no-speech': 'no-match',
      'service-not-allowed': 'service-not-allowed',
    };
    handlers.onError?.(errorMap[code] || 'unknown', event.message || code);
  };

  rec.onend = () => {
    if (!isCurrent()) return;
    recognitionInstance = null;
    handlers.onEnd?.();
  };

  try {
    rec.start();
  } catch (err) {
    if (isCurrent()) recognitionInstance = null;
    handlers.onError?.('unknown', err instanceof Error ? err.message : String(err));
  }
}

/** Stop and invalidate the current recognition session. */
export function stopRecognition(): void {
  recognitionToken += 1;
  const rec = recognitionInstance;
  recognitionInstance = null;
  if (!rec) return;

  try {
    rec.onstart = null;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
  } catch {
    // ignore
  }

  try {
    if (typeof rec.abort === 'function') rec.abort();
    else rec.stop();
  } catch {
    // ignore
  }
}

let currentUtterance: SpeechSynthesisUtterance | null = null;
let synthesisToken = 0;

/**
 * Speak text with the selected language. Cancels any ongoing utterance.
 * Callback codes use browser speech-synthesis error names, or 'not-supported'.
 */
export function speak(
  text: string,
  lang: string,
  handlers?: { onStart?: () => void; onEnd?: () => void; onError?: (code: string) => void }
): void {
  if (!isSynthesisSupported()) {
    handlers?.onError?.('not-supported');
    return;
  }
  if (!text.trim()) return;

  stopSpeech();

  const synth = window.speechSynthesis!;
  const token = ++synthesisToken;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;

  const voice = selectVoiceForLang(lang);
  if (voice) utterance.voice = voice;

  const isCurrent = () => token === synthesisToken && currentUtterance === utterance;

  utterance.onstart = () => {
    if (!isCurrent()) return;
    handlers?.onStart?.();
  };
  utterance.onend = () => {
    if (!isCurrent()) return;
    currentUtterance = null;
    handlers?.onEnd?.();
  };
  utterance.onerror = (event: any) => {
    if (!isCurrent()) return;
    currentUtterance = null;
    const code = String(event.error ?? 'unknown');
    // Cancellation is expected when the user presses Stop or switches language.
    if (code === 'interrupted' || code === 'canceled') return;
    handlers?.onError?.(code);
  };

  currentUtterance = utterance;
  try {
    synth.speak(utterance);
  } catch (err) {
    if (isCurrent()) currentUtterance = null;
    handlers?.onError?.(err instanceof Error ? err.message : 'unknown');
  }
}

/** Stop any ongoing speech playback immediately. */
export function stopSpeech(): void {
  synthesisToken += 1;
  const utterance = currentUtterance;
  currentUtterance = null;

  if (utterance) {
    try {
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
    } catch {
      // ignore
    }
  }

  if (isSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}
