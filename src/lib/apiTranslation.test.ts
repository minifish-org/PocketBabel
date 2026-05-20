import { afterEach, describe, expect, it, vi } from 'vitest';
import { translateWithOpenAICompatibleApi } from './apiTranslation';
import { DEFAULT_PROVIDER_SETTINGS } from './providerSettings';

describe('OpenAI-compatible API translation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts chat completions with the configured base URL, key, and model', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '你好' } }],
        }),
        { status: 200 },
      ),
    );

    const output = await translateWithOpenAICompatibleApi(
      {
        ...DEFAULT_PROVIDER_SETTINGS,
        apiKey: 'test-key',
        baseUrl: 'http://example.test/v1/',
        model: 'custom/chat',
      },
      'en-zh',
      'Hello',
    );

    expect(output).toBe('你好');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://example.test/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
        },
      }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      model: 'custom/chat',
      messages: [
        {
          role: 'system',
          content: 'Translate from English to Chinese. Return only the translated text.',
        },
        {
          role: 'user',
          content: 'Hello',
        },
      ],
    });
  });

  it('requires an API key in API mode', async () => {
    await expect(
      translateWithOpenAICompatibleApi(DEFAULT_PROVIDER_SETTINGS, 'en-zh', 'Hello'),
    ).rejects.toThrow('API Key is required');
  });
});
