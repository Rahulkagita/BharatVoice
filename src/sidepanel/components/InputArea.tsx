import { useCallback } from 'react';
import { LOCALES, type LanguageCode, type LocaleKey } from '../../locales';

interface InputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onMic: () => void;
  onStop: () => void;
  disabled: boolean;
  recognitionSupported: boolean;
  listening: boolean;
  speaking: boolean;
  t: (key: LocaleKey, currentLang: LanguageCode) => string;
  lang: LanguageCode;

}

export default function InputArea({
  value,
  onChange,
  onSend,
  onMic,
  onStop,
  disabled,
  recognitionSupported,
  listening,
  speaking,
  t,
  lang,
}: InputAreaProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSend();
      }
    },
    [onSend]
  );

  const canSend = value.trim().length > 0 && !disabled && !speaking;
  const micLabel = listening ? t('micStop', lang) : t('micStart', lang);

  return (
    <div className="bv-input-area">
      <textarea
        className="bv-input"
        id="bv-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('placeholder', lang)}
        disabled={disabled}
        rows={2}
        maxLength={500}
        spellCheck={true}
        aria-label={t('placeholder', lang)}
        autoComplete="off"
        autoFocus
      />
      <div className="bv-input-controls">
        <button
          className={`bv-icon-button bv-icon-button--mic ${listening ? 'bv-icon-button--active' : ''}`}
          onClick={onMic}
          disabled={!recognitionSupported || disabled || speaking}
          aria-pressed={listening}
          aria-label={micLabel}
          title={
            !recognitionSupported
              ? 'Voice recognition is not supported in this browser. You can still type.'
              : micLabel
          }
        >
          <span className="bv-icon-button-label" aria-hidden="true">
            {listening ? '⏹' : '🎙'}
          </span>
        </button>
        {(listening || speaking) && (
          <button
            className="bv-icon-button bv-icon-button--stop"
            onClick={onStop}
            aria-label={t('stopSpeech', lang)}
            title={t('stopSpeech', lang)}
          >
            <span className="bv-icon-button-label" aria-hidden="true">⏹</span>
          </button>
        )}
        <button
          className="bv-send-button"
          onClick={onSend}
          disabled={!canSend}
        >
          {t('send', lang)}
        </button>
      </div>
    </div>
  );
}
