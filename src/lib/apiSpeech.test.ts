import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EN_US_TTS_VOICE,
  ZH_TTS_VOICE,
  getTtsVoiceForDirection,
  requestOpenAICompatibleSpeech,
} from './apiSpeech';
import { DEFAULT_PROVIDER_SETTINGS } from './providerSettings';

describe('OpenAI-compatible API speech', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('selects Kokoro voices for the translated output language', () => {
    expect(ZH_TTS_VOICE).toBe('zf_xiaoxiao');
    expect(EN_US_TTS_VOICE).toBe('af_bella');
    expect(getTtsVoiceForDirection('en-zh')).toBe('zf_xiaoxiao');
    expect(getTtsVoiceForDirection('zh-en')).toBe('af_bella');
  });

  it('posts audio speech requests with the configured TTS model, voice, and MP3 format', async () => {
    const mp3 = new Blob(['ID3'], { type: 'audio/mpeg' });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(mp3, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      }),
    );

    const audio = await requestOpenAICompatibleSpeech(
      {
        ...DEFAULT_PROVIDER_SETTINGS,
        apiKey: 'test-key',
        baseUrl: 'http://example.test/v1/',
        ttsModel: 'local/tts',
      },
      'en-zh',
      '你好',
    );

    expect(audio.type).toBe('audio/mpeg');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://example.test/v1/audio/speech',
      expect.objectContaining({
        method: 'POST',
        targetAddressSpace: 'local',
        headers: {
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
        },
      }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      model: 'local/tts',
      input: '你好',
      voice: 'zf_xiaoxiao',
      response_format: 'mp3',
    });
  });

  it('requires a TTS model before calling the API', async () => {
    await expect(
      requestOpenAICompatibleSpeech(
        {
          ...DEFAULT_PROVIDER_SETTINGS,
          apiKey: 'test-key',
          ttsModel: ' ',
        },
        'zh-en',
        'Hello',
      ),
    ).rejects.toThrow('TTS Model is required');
  });

  it('surfaces model availability failures for browser fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: 'Model local/tts does not support endpoint audio_speech' },
        }),
        { status: 400, statusText: 'Bad Request' },
      ),
    );

    await expect(
      requestOpenAICompatibleSpeech(
        {
          ...DEFAULT_PROVIDER_SETTINGS,
          apiKey: 'test-key',
        },
        'zh-en',
        'Hello',
      ),
    ).rejects.toThrow('Model local/tts does not support endpoint audio_speech');
  });
});
