import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const mocks = vi.hoisted(() => ({
  speakText: vi.fn(),
  sendChat: vi.fn(),
}));

vi.mock('../hooks/useSpeech', () => ({
  useSpeech: () => ({
    status: 'idle',
    error: null,
    capabilities: { recognition: false, synthesis: true },
    voicesReady: true,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    speakText: mocks.speakText,
    stopSpeech: vi.fn(),
    clearError: vi.fn(),
    transcript: '',
  }),
}));

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, sendChat: mocks.sendChat };
});

function selectLanguage(code: string) {
  fireEvent.change(screen.getByRole('combobox'), { target: { value: code } });
}

describe('App', () => {
  beforeEach(() => {
    mocks.speakText.mockReset();
    mocks.sendChat.mockReset();
    document.documentElement.lang = 'fr';
  });

  it('sets the document language on initial render', () => {
    render(<App />);

    expect(document.documentElement.lang).toBe('en-IN');
    expect(screen.getByText(/does not inspect or highlight/i)).toBeTruthy();
  });

  it('updates the document language and welcome text without speaking', () => {
    render(<App />);

    selectLanguage('hi');
    expect(document.documentElement.lang).toBe('hi-IN');
    expect(screen.getByText(/भारतवॉयस अभी आपके द्वारा देखे जा रहे वेबपेज/)).toBeTruthy();

    selectLanguage('te');
    expect(document.documentElement.lang).toBe('te-IN');
    expect(screen.getByText(/భారతవాయిస్ ప్రస్తుతం మీరు చూస్తున్న వెబ్ పేజీని చదవదు/)).toBeTruthy();

    selectLanguage('en');
    expect(document.documentElement.lang).toBe('en-IN');

    // Welcome text must never trigger automatic speech, even after repeated
    // language changes.
    expect(mocks.speakText).not.toHaveBeenCalled();
  });

  it('still speaks assistant replies after an explicit request', async () => {
    mocks.sendChat.mockResolvedValue({
      answer: 'Here is the help you asked for.',
      provider: 'gemini',
      status: 'ok',
      error: null,
      request_id: 'req-test',
    });

    render(<App />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Help me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(mocks.sendChat).toHaveBeenCalledWith(
        'Help me',
        'en',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
    await waitFor(() =>
      expect(mocks.speakText).toHaveBeenCalledWith('Here is the help you asked for.')
    );
    expect(screen.getByText('Here is the help you asked for.')).toBeTruthy();
  });
});
