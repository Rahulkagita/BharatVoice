import { useCallback, useEffect, useRef, useState } from 'react';
import { LANGUAGES, LOCALES } from '../locales';
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

function languageNameFor(lang: LanguageCode): string {
  return LANGUAGES.find((language) => language.code === lang)?.nativeName ?? lang;
}

export function useSpeech(lang: LanguageCode): UseSpeechResult {
  const [status, setStatus] = useState<ListenStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [voicesReady, setVoicesReady] = useState(false);
  const transcriptRef = useRef('');
  const statusRef = useRef<ListenStatus>('idle');
  const speechRequestRef = useRef(0);

  const updateStatus = useCallback((next: ListenStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  // Load voices once. Guard against state updates after the panel closes.
  useEffect(() => {
    let active = true;
    loadSynthesisVoices()
      .then(() => {
        if (active) {
          setVoicesReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setVoicesReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Language changes invalidate any in-flight recognition or speech so an old
  // language's audio can never appear under the new selection.
  useEffect(() => {
    setError(null);
    transcriptRef.current = '';
    updateStatus('idle');
    stopRecognition();
    stopSpeech();

    return () => {
      speechRequestRef.current += 1;
      stopRecognition();
      stopSpeech();
    };
  }, [lang, updateStatus]);

  const startListening = useCallback(
    (onTranscript: (text: string) => void) => {
      setError(null);
      transcriptRef.current = '';
      updateStatus('listening');

      startRecognition(recognitionLangFor(lang), {
        onStart: () => updateStatus('listening'),
        onResult: (transcript) => {
          transcriptRef.current = transcript;
          onTranscript(transcript);
        },
        onError: (code, message) => {
          updateStatus('idle');
          setError(voiceErrorMessage(code, message, lang));
        },
        onEnd: () => {
          // Do not clobber a newer recognition or speech session.
          if (statusRef.current === 'listening') updateStatus('idle');
        },
      });
    },
    [lang, updateStatus]
  );

  const stopListening = useCallback(() => {
    stopRecognition();
    updateStatus('idle');
  }, [updateStatus]);

  const speakText = useCallback(
    (text: string) => {
      const requestId = ++speechRequestRef.current;
      setError(null);

      if (!isSynthesisSupported()) {
        setError(LOCALES[lang].errorNotSupported);
        return;
      }

      // Wait for the asynchronous voice list before deciding whether a matching
      // voice exists. A newer speak/stop/language change invalidates this call.
      void loadSynthesisVoices().then(() => {
        if (requestId !== speechRequestRef.current) return;

        // Do not silently read Hindi/Telugu with an English voice.
        if (!selectVoiceForLang(synthesisLangFor(lang))) {
          setError(
            LOCALES[lang].errorVoiceMissing.replaceAll('{{language}}', languageNameFor(lang))
          );
          return;
        }

        speak(text, synthesisLangFor(lang), {
          onStart: () => {
            if (requestId !== speechRequestRef.current) return;
            updateStatus('speaking');
          },
          onEnd: () => {
            if (requestId !== speechRequestRef.current) return;
            if (statusRef.current === 'speaking') updateStatus('idle');
          },
          onError: (code) => {
            if (requestId !== speechRequestRef.current) return;
            updateStatus('idle');
            setError(synthesisErrorMessage(code, lang));
          },
        });
      });
    },
    [lang, updateStatus]
  );

  const stopAll = useCallback(() => {
    speechRequestRef.current += 1;
    stopRecognition();
    stopSpeech();
    updateStatus('idle');
  }, [updateStatus]);

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

function synthesisErrorMessage(code: string, lang: LanguageCode): string {
  const messages = LOCALES[lang];
  switch (code) {
    case 'not-supported':
      return messages.errorNotSupported;
    case 'language-unavailable':
    case 'voice-unavailable':
      return messages.errorVoiceMissing.replaceAll('{{language}}', languageNameFor(lang));
    case 'network':
      return messages.errorNetwork;
    case 'not-allowed':
      return messages.errorSynthesisBlocked;
    default:
      return messages.errorSynthesis;
  }
}
