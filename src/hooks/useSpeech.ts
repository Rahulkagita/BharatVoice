import { useCallback, useEffect, useRef, useState } from 'react';
import { LOCALES } from '../locales';
import {
  isRecognitionSupported,
  isSynthesisSupported,
  loadSynthesisVoices,
  recognitionLangFor,
  selectVoiceForLang,
  speak,
  startRecognition,
  stopRecognition,
  stopSpeech,
  synthesisLangFor,
} from '../voice/speech';
import type { LanguageCode } from '../types';

type ListenStatus = 'idle' | 'listening' | 'speaking';

interface UseSpeechResult {
  readonly transcript: string;
  status: ListenStatus;
  error: string | null;
  capabilities: { recognition: boolean; synthesis: boolean };
  voicesReady: boolean;
  startListening: (onTranscript: (text: string) => void) => void;
  stopListening: () => void;
  speakText: (text: string) => void;
  stopSpeech: () => void;
  clearError: () => void;
}

export function useSpeech(lang: LanguageCode): UseSpeechResult {
  const [status, setStatus] = useState<ListenStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [voicesReady, setVoicesReady] = useState(false);
  const transcriptRef = useRef('');

  useEffect(() => {
    setError(null);
    loadSynthesisVoices().then(() => setVoicesReady(true));
  }, []);

  const startListening = useCallback(
    (onTranscript: (text: string) => void) => {
      setError(null);
      transcriptRef.current = '';
      setStatus('listening');

      startRecognition(recognitionLangFor(lang), {
        onStart: () => {
          setStatus('listening');
        },
        onResult: (transcript) => {
          transcriptRef.current = transcript;
          onTranscript(transcript);
        },
        onError: (code, message) => {
          setStatus('idle');
          setError(voiceErrorMessage(code, message, lang));
        },
        onEnd: () => {
          if (status === 'listening') setStatus('idle');
        },
      });
    },
    [lang, status]
  );

  const stopListening = useCallback(() => {
    stopRecognition();
    setStatus('idle');
  }, []);

  const speakText = useCallback(
    (text: string) => {
      setError(null);
      // Pre-warm voice selection so the first utterance is not delayed.
      selectVoiceForLang(synthesisLangFor(lang));
      speak(text, synthesisLangFor(lang), {
        onStart: () => setStatus('speaking'),
        onEnd: () => setStatus('idle'),
        onError: (message) => {
          setStatus('idle');
          setError(message);
        },
      });
    },
    [lang]
  );

  const stopAll = useCallback(() => {
    stopRecognition();
    stopSpeech();
    setStatus('idle');
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    status,
    error,
    capabilities: { recognition: isRecognitionSupported(), synthesis: isSynthesisSupported() },
    voicesReady,
    startListening,
    stopListening,
    speakText,
    stopSpeech: stopAll,
    clearError,
    get transcript(): string {
      return transcriptRef.current;
    },
  };
}

function voiceErrorMessage(
  code: string,
  rawMessage: string,
  lang: LanguageCode
): string {
  const messages = LOCALES[lang];
  switch (code) {
    case 'not-supported':
      return messages.errorNotSupported;
    case 'not-allowed':
      return messages.errorMicDenied;
    case 'audio-capture':
      return messages.errorAudioCapture;
    case 'service-not-allowed':
      return messages.errorServiceBlocked;
    case 'network':
      return messages.errorNetwork;
    case 'no-match':
      return messages.errorNoMatch;
    default:
      return messages.errorUnknown || rawMessage || 'Speech recognition failed.';
  }
}
