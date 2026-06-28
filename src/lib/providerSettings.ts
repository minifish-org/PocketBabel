export const PROVIDER_MODES = ['api', 'browser'] as const;

export type ProviderMode = (typeof PROVIDER_MODES)[number];

export interface ProviderSettings {
  mode: ProviderMode;
  baseUrl: string;
  apiKey: string;
  model: string;
  ttsModel: string;
}

const LEGACY_DEFAULT_BASE_URLS = [
  'http://100.100.89.60:11435',
  'http://100.100.89.60:11435/v1',
];

export const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
  mode: 'api',
  baseUrl: 'http://localhost:11435',
  apiKey: '',
  model: 'standard/chat',
  ttsModel: 'local/tts',
};

export const PROVIDER_SETTINGS_STORAGE_KEY = 'pocketbabel.providerSettings';

function isProviderMode(value: unknown): value is ProviderMode {
  return value === 'api' || value === 'browser';
}

export function normalizeProviderSettings(value: unknown): ProviderSettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_PROVIDER_SETTINGS;
  }

  const candidate = value as Partial<Record<keyof ProviderSettings, unknown>>;
  const savedBaseUrl = typeof candidate.baseUrl === 'string' ? candidate.baseUrl.trim() : '';
  const baseUrl =
    savedBaseUrl && !LEGACY_DEFAULT_BASE_URLS.includes(savedBaseUrl)
      ? savedBaseUrl
      : DEFAULT_PROVIDER_SETTINGS.baseUrl;

  return {
    mode: isProviderMode(candidate.mode) ? candidate.mode : DEFAULT_PROVIDER_SETTINGS.mode,
    baseUrl,
    apiKey: typeof candidate.apiKey === 'string' ? candidate.apiKey : DEFAULT_PROVIDER_SETTINGS.apiKey,
    model:
      typeof candidate.model === 'string' && candidate.model.trim()
        ? candidate.model.trim()
        : DEFAULT_PROVIDER_SETTINGS.model,
    ttsModel:
      typeof candidate.ttsModel === 'string' && candidate.ttsModel.trim()
        ? candidate.ttsModel.trim()
        : DEFAULT_PROVIDER_SETTINGS.ttsModel,
  };
}

export function readProviderSettings(storage: Storage = window.localStorage): ProviderSettings {
  const saved = storage.getItem(PROVIDER_SETTINGS_STORAGE_KEY);

  if (!saved) {
    return DEFAULT_PROVIDER_SETTINGS;
  }

  try {
    return normalizeProviderSettings(JSON.parse(saved));
  } catch {
    return DEFAULT_PROVIDER_SETTINGS;
  }
}

export function writeProviderSettings(
  settings: ProviderSettings,
  storage: Storage = window.localStorage,
) {
  storage.setItem(PROVIDER_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeProviderSettings(settings)));
}
