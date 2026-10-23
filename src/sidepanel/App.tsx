import { useCallback, useEffect, useRef, useState } from 'react';
import { LOCALES, type LanguageCode, type LocaleKey } from '../locales';
import { sendChat, BackendError, type ChatResponse } from '../api';
import { useSpeech } from '../hooks/useSpeech';
import { MAX_MESSAGE_LENGTH, type ChatMessage } from '../types';
import BrandHeader from './components/BrandHeader';
import LanguageSelector from './components/LanguageSelector';
import Conversation from './components/Conversation';
import InputArea from './components/InputArea';
import StatusBanner from './components/StatusBanner';

function t(key: LocaleKey, lang: LanguageCode): string {
  return LOCALES[lang][key] ?? LOCALES.en[key];
}

function backendErrorMessage(err: BackendError, lang: LanguageCode): string {
  // English users get the backend's precise, already-safe message. Other
  // languages use localized generic messages because backend text is English.
  if (lang === 'en' && err.message) return err.message;

  switch (err.kind) {
    case 'network':
      return t('errorBackendNetwork', lang);
    case 'timeout':
      return t('errorBackendTimeout', lang);
    case 'rate_limit':
      return t('errorBackendBusy', lang);
    case 'unavailable':
    case 'provider':
      return t('errorBackendUnavailable', lang);
    case 'validation':
      return t('errorBackendValidation', lang);
    default:
      return t('errorBackendUnknown', lang);
  }
}

export default function App() {
  const [lang, setLang] = useState<LanguageCode>('en');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const requestSeq = useRef(0);
  const welcomeTimerRef = useRef<number | null>(null);

  const {
    status,
    error: voiceError,
    capabilities,
    voicesReady,
    startListening,
    stopListening,
    speakText,
    stopSpeech: stopAllSpeech,
    clearError: clearVoiceError,
  } = useSpeech(lang);

  const displayedError = error || voiceError || backendError;

  const abortPendingRequest = useCallback(() => {
    requestSeq.current += 1;
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  const clearAllErrors = useCallback(() => {
    setError(null);
    setBackendError(null);
    clearVoiceError();
  }, [clearVoiceError]);

  // Greet the user in the selected language when the panel opens or the
  // language changes. The timeout is cleared if the language changes again.
  useEffect(() => {
    const welcome: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: t('welcome', lang),
      timestamp: Date.now(),
    };
    setMessages([welcome]);
    welcomeTimerRef.current = window.setTimeout(() => {
      welcomeTimerRef.current = null;
      speakText(t('welcome', lang));
    }, 600);
    return () => {
      if (welcomeTimerRef.current !== null) {
        window.clearTimeout(welcomeTimerRef.current);
        welcomeTimerRef.current = null;
      }
    };
  }, [lang, speakText]);

  // Auto-scroll the conversation to the bottom.
  useEffect(() => {
    const container = conversationRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // Abort in-flight work when the panel closes. No state updates here.
  useEffect(() => () => abortPendingRequest(), [abortPendingRequest]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!text || processing) return;

    const seq = ++requestSeq.current;
    const controller = new AbortController();
    requestRef.current = controller;

    setBackendError(null);
    setError(null);
    setInputValue('');

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setProcessing(true);

    try {
      const res: ChatResponse = await sendChat(text, lang, {
        signal: controller.signal,
      });

      // A newer request, Clear, Stop, or a language change superseded this one.
      if (seq !== requestSeq.current) return;

      if (res.status === 'ok' && res.answer) {
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: res.answer,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        speakText(res.answer);
      } else {
        setBackendError(
          lang === 'en' && res.error ? res.error : t('errorBackendUnknown', lang)
        );
      }
    } catch (err) {
      if (seq !== requestSeq.current) return;
      if (err instanceof BackendError && err.kind === 'cancelled') return;

      if (err instanceof BackendError) {
        setBackendError(backendErrorMessage(err, lang));
      } else {
        setBackendError(t('errorBackendUnknown', lang));
      }
    } finally {
      // Only the current request may clear the processing state.
      if (seq === requestSeq.current) {
        requestRef.current = null;
        setProcessing(false);
      }
    }
  }, [inputValue, processing, lang, speakText]);

  const handleMic = useCallback(() => {
    if (!capabilities.recognition) {
      setError(LOCALES[lang].errorNotSupported);
      return;
    }
    if (status === 'listening') {
      stopListening();
      return;
    }
    setError(null);
    clearVoiceError();
    startListening((transcript) => {
      setInputValue(transcript.slice(0, MAX_MESSAGE_LENGTH));
    });
  }, [capabilities.recognition, status, stopListening, startListening, lang, clearVoiceError]);

  const handleStop = useCallback(() => {
    abortPendingRequest();
    setProcessing(false);
    stopAllSpeech();
  }, [abortPendingRequest, stopAllSpeech]);

  const handleClear = useCallback(() => {
    if (welcomeTimerRef.current !== null) {
      window.clearTimeout(welcomeTimerRef.current);
      welcomeTimerRef.current = null;
    }
    abortPendingRequest();
    setMessages([]);
    setInputValue('');
    setProcessing(false);
    clearAllErrors();
    stopAllSpeech();
  }, [abortPendingRequest, clearAllErrors, stopAllSpeech]);

  const handleLangChange = useCallback(
    (code: LanguageCode) => {
      if (code === lang) return;

      // Do not let a reply in the old language arrive after the switch.
      abortPendingRequest();
      setProcessing(false);
      clearAllErrors();
      stopAllSpeech();
      setLang(code);
    },
    [abortPendingRequest, clearAllErrors, stopAllSpeech, lang]
  );

  const handleDismissError = useCallback(() => {
    clearAllErrors();
  }, [clearAllErrors]);

  return (
    <div className="bv-app" role="region" aria-label="BharatVoice assistant">
      <BrandHeader
        tagline={t('tagline', lang)}
        description={t('description', lang)}
      />
      <div className="bv-body">
        <div className="bv-toolbar">
          <LanguageSelector lang={lang} onChange={handleLangChange} t={t} />
        </div>
        <StatusBanner
          status={processing ? 'processing' : status}
          error={displayedError}
          capabilities={capabilities}
          voicesReady={voicesReady}
          t={t}
          lang={lang}
          onDismissError={handleDismissError}
        />
        <div className="bv-conversation-wrapper" ref={conversationRef}>
          <Conversation messages={messages} t={t} lang={lang} />
        </div>
        <InputArea
          value={inputValue}
          onChange={(value) => setInputValue(value.slice(0, MAX_MESSAGE_LENGTH))}
          onSend={handleSend}
          onMic={handleMic}
          onStop={handleStop}
          disabled={processing}
          processing={processing}
          recognitionSupported={capabilities.recognition}
          listening={status === 'listening'}
          speaking={status === 'speaking'}
          t={t}
          lang={lang}
        />
        <div className="bv-footer">
          <button
            className="bv-button bv-button--ghost bv-button--small"
            onClick={handleClear}
            disabled={messages.length === 0}
            aria-label={t('clearConversation', lang)}
          >
            {t('clearConversation', lang)}
          </button>
          <p className="bv-caption">{t('privacyNote', lang)}</p>
          <p className="bv-caption">{t('disclaimer', lang)}</p>
        </div>
      </div>
    </div>
  );
}
