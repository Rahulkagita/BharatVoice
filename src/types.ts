export type LanguageCode = 'en' | 'hi' | 'te';

/** Keep in sync with MAX_MESSAGE_LENGTH in backend/app/schemas.py. */
export const MAX_MESSAGE_LENGTH = 1000;

export interface Language {
  code: LanguageCode;
  name: string;        // English name
  nativeName: string;  // Name in its own script
  recognitionLang: string; // BCP-47 tag for browser SpeechRecognition (e.g. te-IN)
  synthesisLang: string;   // BCP-47 tag for browser SpeechSynthesis
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export type AppStatus = 'idle' | 'listening' | 'processing' | 'speaking';

export interface VoiceErrorInfo {
  code: 'not-supported' | 'not-allowed' | 'audio-capture' | 'network' | 'no-match' | 'service-not-allowed' | 'unknown';
  message: string;
}
