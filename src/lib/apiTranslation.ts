import { getDirectionDefinition, type Direction } from './translation';
import type { ProviderSettings } from './providerSettings';

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

function buildChatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
}

function extractMessageContent(response: ChatCompletionResponse): string {
  const content = response.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (item.type === 'text' || !item.type ? item.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  return '';
}

export async function translateWithOpenAICompatibleApi(
  settings: ProviderSettings,
  direction: Direction,
  text: string,
): Promise<string> {
  const baseUrl = settings.baseUrl.trim();
  const apiKey = settings.apiKey.trim();
  const model = settings.model.trim();

  if (!baseUrl) {
    throw new Error('OpenAI Base URL is required.');
  }

  if (!apiKey) {
    throw new Error('API Key is required for API provider mode.');
  }

  if (!model) {
    throw new Error('Model is required for API provider mode.');
  }

  const definition = getDirectionDefinition(direction);
  const response = await fetch(buildChatCompletionsUrl(baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `Translate from ${definition.sourceLabel} to ${definition.targetLabel}. Return only the translated text.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
    }),
  });

  let payload: ChatCompletionResponse | undefined;

  try {
    payload = (await response.json()) as ChatCompletionResponse;
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        `API translation failed with HTTP ${response.status} ${response.statusText}`.trim(),
    );
  }

  const translatedText = payload ? extractMessageContent(payload) : '';

  if (!translatedText) {
    throw new Error('API returned an empty translation result.');
  }

  return translatedText;
}
