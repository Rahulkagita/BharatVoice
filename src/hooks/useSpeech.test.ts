import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LanguageCode } from '../types';
import { useSpeech } from './useSpeech';

const voice = vi.hoisted(() => ({
  isRecognitionSupported: vi.fn(() => false),
  isSynthesisSupported: vi.fn(() => true),
  loadSynthesisVoices: vi.fn(() => Promise.resolve([])),
  recognitionLangFor: vi.fn((code: string) =>
    code === 'te' ? 'te-IN' : code === 'hi' ? 'hi-IN' : 'en-IN'
  ),
  selectVoiceForLang: vi.fn<(lang: string) => unknown>(() => undefined),
  speak: vi.fn(),
  startRecognition: vi.fn(),
  stopRecognition: vi.fn(),
  stopSpeech: vi.fn(),
  synthesisLangFor: vi.fn((code: string) =>
    code === 'te' ? 'te-IN' : code === 'hi' ? 'hi-IN' : 'en-IN'
  ),
}));

vi.mock('../voice/speech', () => voice);

describe('useSpeech', () => {
  beforeEach(() => {
    voice.selectVoiceForLang.mockReturnValue(undefined);
    voice.speak.mockReset();
    voice.stopSpeech.mockReset();
  });

  it('speaks with the matching installed voice', async () => {
    voice.selectVoiceForLang.mockReturnValue({ lang: 'te-IN' });
    voice.speak.mockImplementation((_text: string, _lang: string, handlers: any) => {
      handlers?.onStart?.();
    });

    const { result } = renderHook(() => useSpeech('te'));
    await waitFor(() => expect(result.current.voicesReady).toBe(true));

    await act(async () => {
      result.current.speakText('నమస్తే');
    });

    expect(voice.speak).toHaveBeenCalledTimes(1);
    expect(voice.speak.mock.calls[0][0]).toBe('నమస్తే');
    expect(voice.speak.mock.calls[0][1]).toBe('te-IN');
    expect(result.current.status).toBe('speaking');
    expect(result.current.error).toBeNull();
  });

  it('shows one clear message and never substitutes a voice when none exists', async () => {
    const { result, rerender } = renderHook(
      ({ lang }: { lang: LanguageCode }) => useSpeech(lang),
      { initialProps: { lang: 'te' } }
    );
    await waitFor(() => expect(result.current.voicesReady).toBe(true));

    await act(async () => {
      result.current.speakText('నమస్తే');
    });
    const firstError = result.current.error;
    expect(firstError).toContain('తెలుగు');
    expect(voice.speak).not.toHaveBeenCalled();

    // Asking again keeps the same message instead of stacking or repeating it.
    await act(async () => {
      result.current.speakText('మళ్లీ');
    });
    expect(result.current.error).toBe(firstError);
    expect(voice.speak).not.toHaveBeenCalled();

    // A language change resets the message and still does not fall back.
    await act(async () => {
      rerender({ lang: 'hi' });
    });
    expect(result.current.error).toBeNull();

    await act(async () => {
      result.current.speakText('नमस्ते');
    });
    expect(result.current.error).toContain('हिन्दी');
    expect(voice.speak).not.toHaveBeenCalled();
  });

  it('does not speak on repeated renders or state changes', async () => {
    const { result, rerender } = renderHook(
      ({ lang }: { lang: LanguageCode }) => useSpeech(lang),
      { initialProps: { lang: 'en' } }
    );
    await waitFor(() => expect(result.current.voicesReady).toBe(true));

    rerender({ lang: 'en' });
    rerender({ lang: 'en' });

    expect(voice.speak).not.toHaveBeenCalled();
  });
});
