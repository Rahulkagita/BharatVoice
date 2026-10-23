import { useCallback } from 'react';
import { LANGUAGES, type LanguageCode, type LocaleKey } from '../../locales';

interface LanguageSelectorProps {
  lang: LanguageCode;
  onChange: (code: LanguageCode) => void;
  t: (key: LocaleKey, currentLang: LanguageCode) => string;
}

export default function LanguageSelector({
  lang,
  onChange,
  t,
}: LanguageSelectorProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(e.target.value as LanguageCode);
    },
    [onChange]
  );

  return (
    <div className="bv-field">
      <label htmlFor="bv-language" className="bv-label">
        {t('languageLabel', lang)}
      </label>
      <select
        id="bv-language"
        value={lang}
        onChange={handleChange}
        className="bv-select"
        aria-label={t('languageLabel', lang)}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
}
