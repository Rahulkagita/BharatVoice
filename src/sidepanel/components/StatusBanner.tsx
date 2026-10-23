import { useCallback } from 'react';
import { type LanguageCode, type LocaleKey } from '../../locales';

interface StatusBannerProps {
  status: 'idle' | 'listening' | 'processing' | 'speaking';
  error: string | null;
  capabilities: { recognition: boolean; synthesis: boolean };
  voicesReady: boolean;
  t: (key: LocaleKey, currentLang: LanguageCode) => string;

  lang: LanguageCode;
  onDismissError: () => void;
}

export default function StatusBanner({
  status,
  error,
  capabilities,
  voicesReady,
  t,
  lang,
  onDismissError,
}: StatusBannerProps) {
  const dismiss = useCallback(() => onDismissError(), [onDismissError]);

  if (error) {
    return (
      <div className="bv-banner bv-banner--error" role="alert" aria-live="polite">
        <span className="bv-banner-icon" aria-hidden="true">
          !!
        </span>
        <span className="bv-banner-text">{error}</span>
        <button
          className="bv-banner-dismiss"
          onClick={dismiss}
          aria-label={t('errorDismiss', lang)}
        >
          ✕
        </button>
      </div>
    );
  }

  if (status === 'listening') {
    return (
      <div className="bv-banner bv-banner--listening" role="status" aria-live="polite">
        <span className="bv-banner-icon" aria-hidden="true">
          ◍
        </span>
        <span className="bv-banner-text">{t('listening', lang)}</span>
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div className="bv-banner bv-banner--processing" role="status" aria-live="polite">
        <span className="bv-banner-icon" aria-hidden="true">
          ◍
        </span>
        <span className="bv-banner-text">{t('processing', lang)}</span>
      </div>
    );
  }

  if (status === 'speaking') {
    return (
      <div className="bv-banner bv-banner--speaking" role="status" aria-live="polite">
        <span className="bv-banner-icon" aria-hidden="true">
          〰
        </span>
        <span className="bv-banner-text">{t('speaking', lang)}</span>
      </div>
    );
  }

  if (!capabilities.recognition) {
    return (
      <div className="bv-banner bv-banner--notice" role="status" aria-live="polite">
        <span className="bv-banner-icon" aria-hidden="true">
          ℹ
        </span>
        <span className="bv-banner-text">
          {t('voiceUnavailable', lang)}
        </span>
      </div>
    );
  }

  if (!voicesReady) {
    return (
      <div className="bv-banner bv-banner--notice bv-banner--subtle" role="status" aria-live="polite">
        <span className="bv-banner-icon" aria-hidden="true">
          ◍
        </span>
        <span className="bv-banner-text">{t('preparingVoices', lang)}</span>
      </div>
    );
  }

  return null;
}
