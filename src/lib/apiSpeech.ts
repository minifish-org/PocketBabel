import type { ProviderSettings } from './providerSettings';
import type { Direction } from './translation';

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

type LocalNetworkRequestInit = RequestInit & { targetAddressSpace?: 'local' };

export const ZH_TTS_VOICE = 'zf_xiaoxiao';
export const EN_US_TTS_VOICE = 'af_bella';

export function getTtsVoiceForDirection(direction: Direction): string {
  return direction === 'en-zh' ? ZH_TTS_VOICE : EN_US_TTS_VOICE;
}

function buildAudioSpeechUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

  if (normalizedBaseUrl.endsWith('/audio/speech')) {
    return normalizedBaseUrl;
  }

  if (!normalizedBaseUrl.endsWith('/v1')) {
    return `${normalizedBaseUrl}/v1/audio/speech`;
  }

  return `${normalizedBaseUrl}/audio/speech`;
}

async function readApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorResponse;
    return payload.error?.message || '';
  } catch {
    return '';
  }
}

export async function requestOpenAICompatibleSpeech(
  settings: ProviderSettings,
  direction: Direction,
  text: string,
): Promise<Blob> {
  const baseUrl = settings.baseUrl.trim();
  const apiKey = settings.apiKey.trim();
  const model = settings.ttsModel.trim();
  const input = text.trim();

  if (!baseUrl) {
    throw new Error('OpenAI Base URL is required.');
  }

  if (!apiKey) {
    throw new Error('API Key is required for API speech.');
  }

  if (!model) {
    throw new Error('TTS Model is required for API speech.');
  }

  if (!input) {
    throw new Error('Text is required for API speech.');
  }

  const requestInit: LocalNetworkRequestInit = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input,
      voice: getTtsVoiceForDirection(direction),
      response_format: 'mp3',
    }),
    targetAddressSpace: 'local',
  };
  let response: Response;

  try {
    response = await fetch(buildAudioSpeechUrl(baseUrl), requestInit);
  } catch (error) {
    throw new Error(
      error instanceof TypeError
        ? 'API TTS request could not reach the server. Check that the endpoint is reachable from this browser and that it allows CORS for Authorization and Content-Type headers.'
        : error instanceof Error
          ? error.message
          : 'API TTS request failed before receiving a response.',
    );
  }

  if (!response.ok) {
    const apiMessage = await readApiError(response);
    throw new Error(
      apiMessage || `API TTS failed with HTTP ${response.status} ${response.statusText}`.trim(),
    );
  }

  const audio = await response.blob();

  if (!audio.size) {
    throw new Error('API TTS returned an empty audio response.');
  }

  return audio;
}
