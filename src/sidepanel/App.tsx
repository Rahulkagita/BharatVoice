import { useCallback, useEffect, useRef, useState } from 'react';
import { LANGUAGES, LOCALES, type LanguageCode, type LocaleKey } from '../locales';
import { sendChat, BackendError, type ChatResponse } from '../api';
import { useSpeech } from '../hooks/useSpeech';
import type { ChatMessage } from '../types';
import BrandHeader from './components/BrandHeader';
import LanguageSelector from './components/LanguageSelector';
import Conversation from './components/Conversation';
import InputArea from './components/InputArea';
import StatusBanner from './components/StatusBanner';

function t(key: LocaleKey, lang: LanguageCode): string {
  return LOCALES[lang][key] ?? LOCALES.en[key];
}

export default function App() {
  const [lang, setLang] = useState<LanguageCode>('en');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const sendCancelled = useRef(false);

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

  // Greet the user in the selected language when the panel opens or language changes.
  useEffect(() => {
    const welcome: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: t('welcome', lang),
      timestamp: Date.now(),
    };
    setMessages([welcome]);
    const timer = setTimeout(() => {
      speakText(t('welcome', lang));
    }, 600);
    return () => clearTimeout(timer);
  }, [lang, speakText, t]);

  // Auto-scroll the conversation to the bottom.
  useEffect(() => {
    const container = conversationRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || processing) return;

    sendCancelled.current = false;
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
      const res: ChatResponse = await sendChat(text, lang);

      // Component may have unmounted or the user may have cleared/sent again.
      if (sendCancelled.current) return;

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
        setBackendError(res.error ?? 'The assistant could not produce a reply.');
      }
    } catch (err) {
      if (sendCancelled.current) return;

      let msg: string;
      if (err instanceof BackendError) {
        msg = err.message;
      } else {
        msg = 'An unexpected error occurred. Please try again.';
      }
      setBackendError(msg);
    } finally {
      if (!sendCancelled.current) setProcessing(false);
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
      setInputValue(transcript);
    });
  }, [capabilities.recognition, status, stopListening, startListening, lang, clearVoiceError]);

  const handleStop = useCallback(() => {
    stopAllSpeech();
    setProcessing(false);
  }, [stopAllSpeech]);

  const handleClear = useCallback(() => {
    sendCancelled.current = true;
    setMessages([]);
    setInputValue('');
    setProcessing(false);
    setBackendError(null);
    setError(null);
    stopAllSpeech();
    clearVoiceError();
  }, [stopAllSpeech, clearVoiceError]);

  const handleLangChange = useCallback((code: LanguageCode) => {
    setLang(code);
  }, []);

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
          status={status}
          error={displayedError}
          capabilities={capabilities}
          voicesReady={voicesReady}
          t={t}
          lang={lang}
          onDismissError={() => setError(null)}
        />
        <div className="bv-conversation-wrapper" ref={conversationRef}>
          <Conversation messages={messages} />
        </div>
        <InputArea
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          onMic={handleMic}
          onStop={handleStop}
          disabled={processing}
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
          <p className="bv-caption">
            BharatVoice sends your message to a secure backend assistant.
            Conversation history stays in memory while the panel is open and is
            not stored on disk.
          </p>
        </div>
      </div>
    </div>
  );
}
