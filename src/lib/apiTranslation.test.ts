import { afterEach, describe, expect, it, vi } from 'vitest';
import { shouldUseDictionaryPrompt, translateWithOpenAICompatibleApi } from './apiTranslation';
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
      'Hello world from PocketBabel.',
    );

    expect(output).toBe('你好');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://example.test/v1/chat/completions',
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
      model: 'custom/chat',
      messages: [
        {
          role: 'system',
          content:
            "You are a professional English-to-Chinese translator. Translate the user's text into natural, fluent Chinese. Preserve the original meaning, tone, intent, and formatting where reasonable. Return only the translated text. Do not include explanations, annotations, quotes, alternatives, or the original text.",
        },
        {
          role: 'user',
          content: 'Hello world from PocketBabel.',
        },
      ],
    });
  });

  it('uses a dictionary prompt for English words and short phrases', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'respect\n[noun] 尊重；方面' } }],
        }),
        { status: 200 },
      ),
    );

    await translateWithOpenAICompatibleApi(
      {
        ...DEFAULT_PROVIDER_SETTINGS,
        apiKey: 'test-key',
      },
      'en-zh',
      'respect',
    );

    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

    expect(payload.messages[0].content).toContain('bilingual dictionary and usage guide');
    expect(payload.messages[0].content).toContain('Explain it in Chinese with enough detail');
    expect(payload.messages[0].content).toContain('Common phrases');
  });

  it('uses a dictionary prompt for short Chinese terms', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '尊重\n[noun] respect' } }],
        }),
        { status: 200 },
      ),
    );

    await translateWithOpenAICompatibleApi(
      {
        ...DEFAULT_PROVIDER_SETTINGS,
        apiKey: 'test-key',
      },
      'zh-en',
      '尊重',
    );

    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

    expect(payload.messages[0].content).toContain('bilingual dictionary and usage guide');
    expect(payload.messages[0].content).toContain('Explain it in English with enough detail');
    expect(payload.messages[0].content).toContain('Usage notes');
  });

  it('detects dictionary inputs conservatively', () => {
    expect(shouldUseDictionaryPrompt('respect', 'en-zh')).toBe(true);
    expect(shouldUseDictionaryPrompt('in respect of', 'en-zh')).toBe(true);
    expect(shouldUseDictionaryPrompt('I respect your choice', 'en-zh')).toBe(false);
    expect(shouldUseDictionaryPrompt('I respect your choice.', 'en-zh')).toBe(false);
    expect(shouldUseDictionaryPrompt('尊重', 'zh-en')).toBe(true);
    expect(shouldUseDictionaryPrompt('我尊重你', 'zh-en')).toBe(false);
    expect(shouldUseDictionaryPrompt('我尊重你的选择', 'zh-en')).toBe(false);
    expect(shouldUseDictionaryPrompt('我尊重你的选择。', 'zh-en')).toBe(false);
  });

  it('accepts a base URL that already points to chat completions', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '你好' } }],
        }),
        { status: 200 },
      ),
    );

    await translateWithOpenAICompatibleApi(
      {
        ...DEFAULT_PROVIDER_SETTINGS,
        apiKey: 'test-key',
        baseUrl: 'http://example.test/v1/chat/completions',
      },
      'en-zh',
      'Hello',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://example.test/v1/chat/completions',
      expect.anything(),
    );
  });

  it('accepts an origin-only base URL and inserts the OpenAI v1 path', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '你好' } }],
        }),
        { status: 200 },
      ),
    );

    await translateWithOpenAICompatibleApi(
      {
        ...DEFAULT_PROVIDER_SETTINGS,
        apiKey: 'test-key',
        baseUrl: 'http://example.test:11435',
      },
      'en-zh',
      'Hello',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://example.test:11435/v1/chat/completions',
      expect.anything(),
    );
  });

  it('requires an API key in API mode', async () => {
    await expect(
      translateWithOpenAICompatibleApi(DEFAULT_PROVIDER_SETTINGS, 'en-zh', 'Hello'),
    ).rejects.toThrow('API Key is required');
  });

  it('explains browser-level request failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      translateWithOpenAICompatibleApi(
        {
          ...DEFAULT_PROVIDER_SETTINGS,
          apiKey: 'test-key',
        },
        'en-zh',
        'Hello',
      ),
    ).rejects.toThrow('allows CORS');
  });
});
