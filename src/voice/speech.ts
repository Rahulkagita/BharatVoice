import type { LanguageCode } from '../types';

/** Browser capability flags for the voice layer. Stage 1 relies on built-in
 *  SpeechRecognition / SpeechSynthesis where available. Unsupported features
 *  fail gracefully and are explicitly surfaced to the user. */
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
  if (voicesLoaded) return Promise.resolve(synthesisVoices);
  if (voicesLoading) return voicesLoading.then(() => synthesisVoices);

  const synth = window.speechSynthesis!;
  const available = synth.getVoices();
  if (available && available.length > 0) {
    synthesisVoices = available;
    voicesLoaded = true;
    return Promise.resolve(synthesisVoices);
  }

  voicesLoading = new Promise<void>((resolve, reject) => {
    const onVoicesChanged = () => {
      synthesisVoices = synth.getVoices();
      voicesLoaded = true;
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      resolve();
    };
    synth.addEventListener('voiceschanged', onVoicesChanged);
    setTimeout(() => {
      if (!voicesLoaded) {
        synthesisVoices = synth.getVoices();
        voicesLoaded = true;
        synth.removeEventListener('voiceschanged', onVoicesChanged);
        resolve();
      }
    }, 1500);
  });

  return voicesLoading.then(() => synthesisVoices);
}

/** Pick a voice matching the requested language, falling back to English then any voice. */
export function selectVoiceForLang(langCode: string): SpeechSynthesisVoice | undefined {
  if (!voicesLoaded) return undefined;
  const prefix = langCode.split('-')[0];
  return (
    synthesisVoices.find((v) => v.lang.toLowerCase().startsWith(prefix.toLowerCase())) ||
    synthesisVoices.find((v) => v.lang.toLowerCase().startsWith('en')) ||
    synthesisVoices[0]
  );
}

export interface RecognitionHandlers {
  onStart?: () => void;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (code: string, message: string) => void;
  onEnd?: () => void;
}

let recognitionInstance: any = null;

/** Start a single-shot recognition session. Results (interim + final) are
 *  surfaced via handlers so the UI can show recognized text while listening. */
export function startRecognition(lang: string, handlers: RecognitionHandlers): void {
  if (!isRecognitionSupported()) {
    handlers.onError?.('not-supported', 'Speech recognition is not supported by this browser.');
    return;
  }
  stopRecognition();

  const rec = new SpeechRecognitionCtor();
  rec.lang = lang;
  rec.continuous = false;
  rec.interimResults = true;
  recognitionInstance = rec;

  rec.onstart = () => {
    handlers.onStart?.();
  };
  rec.onresult = (event: any) => {
    let finalTranscript = '';
    let interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }
    handlers.onResult?.(finalTranscript || interimTranscript, !!finalTranscript);
  };
  rec.onerror = (event: any) => {
    const errorMap: Record<string, string> = {
      'not-allowed': 'not-allowed',
      'audio-capture': 'audio-capture',
      'not-supported': 'not-supported',
      'network': 'network',
      'no-match': 'no-match',
      'service-not-allowed': 'service-not-allowed',
    };
    handlers.onError?.(errorMap[event.error] || 'unknown', event.message || event.error);
  };
  rec.onend = () => {
    recognitionInstance = null;
    handlers.onEnd?.();
  };

  try {
    rec.start();
  } catch (err) {
    recognitionInstance = null;
    handlers.onError?.('unknown', err instanceof Error ? err.message : String(err));
  }
}

export function stopRecognition(): void {
  if (recognitionInstance) {
    try {
      recognitionInstance.stop();
    } catch {
      // ignore
    }
    recognitionInstance = null;
  }
}

let currentUtterance: SpeechSynthesisUtterance | null = null;

/** Speak text with the selected language. Cancels any ongoing utterance. */
export function speak(
  text: string,
  lang: string,
  handlers?: { onStart?: () => void; onEnd?: () => void; onError?: (message: string) => void }
): void {
  if (!isSynthesisSupported()) {
    handlers?.onError?.('Speech synthesis is not supported by this browser.');
    return;
  }
  stopSpeech();

  const synth = window.speechSynthesis!;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  const voice = selectVoiceForLang(lang);
  if (voice) utterance.voice = voice;
  utterance.onstart = () => {
    handlers?.onStart?.();
  };
  utterance.onend = () => {
    currentUtterance = null;
    handlers?.onEnd?.();
  };
  utterance.onerror = (event: any) => {
    currentUtterance = null;
    handlers?.onError?.(event.error || 'synthesis-error');
  };
  currentUtterance = utterance;
  synth.speak(utterance);
}

/** Stop any ongoing speech playback immediately. */
export function stopSpeech(): void {
  if (currentUtterance) {
    try {
      currentUtterance.onend = null;
    } catch {
      // ignore
    }
    currentUtterance = null;
  }
  if (isSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}

