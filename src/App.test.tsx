// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { PROVIDER_SETTINGS_STORAGE_KEY } from './lib/providerSettings';

describe('App settings', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  it('shows the default TTS model next to the API model settings', () => {
    render(<App />);

    expect(screen.getByLabelText('TTS Model')).toHaveValue('local/tts');
  });

  it('does not show the legacy browser built-in provider mode', () => {
    render(<App />);

    expect(screen.queryByText('Provider mode')).not.toBeInTheDocument();
    expect(screen.queryByText('Browser built-in')).not.toBeInTheDocument();
  });

  it('opens API settings even when saved settings used the old browser mode', () => {
    window.localStorage.setItem(
      PROVIDER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        mode: 'browser',
        baseUrl: 'http://localhost:11434/v1',
        apiKey: 'secret',
        model: 'local/chat',
        ttsModel: 'local/tts-voice-design',
      }),
    );

    render(<App />);

    expect(screen.getByLabelText('OpenAI Base URL')).toHaveValue('http://localhost:11434/v1');
    expect(screen.getByLabelText('Model')).toHaveValue('local/chat');
    expect(screen.getByLabelText('TTS Model')).toHaveValue('local/tts-voice-design');
    expect(screen.queryByText('Browser built-in')).not.toBeInTheDocument();
  });
});
