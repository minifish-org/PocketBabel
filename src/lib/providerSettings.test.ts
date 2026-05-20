import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROVIDER_SETTINGS,
  PROVIDER_SETTINGS_STORAGE_KEY,
  normalizeProviderSettings,
  readProviderSettings,
  writeProviderSettings,
} from './providerSettings';

function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key) => entries.delete(key),
    setItem: (key, value) => entries.set(key, value),
  };
}

describe('provider settings', () => {
  it('defaults to OpenAI-compatible API mode', () => {
    expect(DEFAULT_PROVIDER_SETTINGS).toEqual({
      mode: 'api',
      baseUrl: 'http://100.100.89.60:11435/v1',
      apiKey: '',
      model: 'standard/chat',
    });
  });

  it('normalizes missing or invalid saved values', () => {
    expect(
      normalizeProviderSettings({
        mode: 'invalid',
        baseUrl: '',
        apiKey: 123,
        model: 'custom/model',
      }),
    ).toEqual({
      ...DEFAULT_PROVIDER_SETTINGS,
      model: 'custom/model',
    });
  });

  it('persists settings in localStorage-compatible storage', () => {
    const storage = createMemoryStorage();
    const settings = {
      mode: 'browser' as const,
      baseUrl: 'http://localhost:11434/v1',
      apiKey: 'secret',
      model: 'local/chat',
    };

    writeProviderSettings(settings, storage);

    expect(storage.getItem(PROVIDER_SETTINGS_STORAGE_KEY)).toContain('local/chat');
    expect(readProviderSettings(storage)).toEqual(settings);
  });
});
