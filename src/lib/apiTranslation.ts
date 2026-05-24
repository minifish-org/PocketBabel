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

type LocalNetworkRequestInit = RequestInit & { targetAddressSpace?: 'local' };

const ENGLISH_SENTENCE_MARKER_WORDS = new Set([
  'i',
  'you',
  'he',
  'she',
  'it',
  'we',
  'they',
  'me',
  'him',
  'her',
  'us',
  'them',
  'my',
  'your',
  'his',
  'our',
  'their',
]);

function buildChatCompletionsUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

  if (normalizedBaseUrl.endsWith('/chat/completions')) {
    return normalizedBaseUrl;
  }

  if (!normalizedBaseUrl.endsWith('/v1')) {
    return `${normalizedBaseUrl}/v1/chat/completions`;
  }

  return `${normalizedBaseUrl}/chat/completions`;
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

function countCjkCharacters(text: string): number {
  return text.match(/[\u3400-\u9fff]/g)?.length ?? 0;
}

export function shouldUseDictionaryPrompt(text: string, direction: Direction): boolean {
  const trimmed = text.trim();

  if (!trimmed || /[\n.!?。！？；;]/.test(trimmed)) {
    return false;
  }

  if (direction === 'en-zh') {
    const words = trimmed.match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g) ?? [];
    const latinWords = words.length;
    const latinCharacters = trimmed.match(/[A-Za-z]/g)?.length ?? 0;
    const nonSpacingCharacters = trimmed.replace(/\s/g, '').length;

    return (
      latinWords >= 1 &&
      latinWords <= 4 &&
      latinCharacters / nonSpacingCharacters >= 0.7 &&
      !words.some((word) => ENGLISH_SENTENCE_MARKER_WORDS.has(word.toLowerCase()))
    );
  }

  const cjkCharacters = countCjkCharacters(trimmed);

  return (
    cjkCharacters >= 1 &&
    cjkCharacters <= 6 &&
    cjkCharacters === trimmed.replace(/\s/g, '').length &&
    !/[我你您他她它咱]/.test(trimmed)
  );
}

function buildTranslationSystemPrompt(direction: Direction): string {
  if (direction === 'en-zh') {
    return [
      'You are a professional English-to-Chinese translator.',
      "Translate the user's text into natural, fluent Chinese.",
      'Preserve the original meaning, tone, intent, and formatting where reasonable.',
      'Return only the translated text. Do not include explanations, annotations, quotes, alternatives, or the original text.',
    ].join(' ');
  }

  return [
    'You are a professional Chinese-to-English translator.',
    "Translate the user's text into natural, idiomatic English.",
    'Preserve the original meaning, tone, intent, and formatting where reasonable.',
    'Return only the translated text. Do not include explanations, annotations, quotes, alternatives, or the original text.',
  ].join(' ');
}

function buildDictionarySystemPrompt(direction: Direction): string {
  const definition = getDirectionDefinition(direction);

  if (direction === 'en-zh') {
    return [
      'You are a bilingual dictionary and usage guide.',
      "The user's input is an English word or short phrase. Explain it in Chinese with enough detail for practical use.",
      'Return only the dictionary entry. Do not add introductions.',
      'Format:',
      '<word or phrase>',
      'Pronunciation: <IPA if useful>',
      'Parts of speech and meanings:',
      '- [part of speech] <Chinese meaning>; <brief usage note>',
      '- [part of speech] <Chinese meaning>; <brief usage note>',
      'Common phrases:',
      '- <phrase>: <Chinese meaning / usage>',
      'Usage notes:',
      '- <important nuance, register, or common mistake>',
      'Examples:',
      '1. <English example>（<Chinese translation>）',
      '2. <English example>（<Chinese translation>）',
      '3. <English example>（<Chinese translation>）',
    ].join('\n');
  }

  return [
    'You are a bilingual dictionary and usage guide.',
    "The user's input is a Chinese word or short phrase. Explain it in English with enough detail for practical use.",
    'Return only the dictionary entry. Do not add introductions.',
    'Format:',
    '<word or phrase>',
    'Pinyin: <pinyin if useful>',
    'Parts of speech and meanings:',
    '- [part of speech] <English meaning>; <brief usage note>',
    '- [part of speech] <English meaning>; <brief usage note>',
    'Common phrases:',
    '- <phrase>: <English meaning / usage>',
    'Usage notes:',
    '- <important nuance, register, or common mistake>',
    'Examples:',
    '1. <Chinese example> (<English translation>)',
    '2. <Chinese example> (<English translation>)',
    '3. <Chinese example> (<English translation>)',
    `The source language is ${definition.sourceLabel}; the target language is ${definition.targetLabel}.`,
  ].join('\n');
}

function buildSystemPrompt(direction: Direction, text: string): string {
  return shouldUseDictionaryPrompt(text, direction)
    ? buildDictionarySystemPrompt(direction)
    : buildTranslationSystemPrompt(direction);
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

  const requestInit: LocalNetworkRequestInit = {
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
          content: buildSystemPrompt(direction, text),
        },
        {
          role: 'user',
          content: text,
        },
      ],
    }),
    targetAddressSpace: 'local',
  };
  let response: Response;

  try {
    response = await fetch(buildChatCompletionsUrl(baseUrl), requestInit);
  } catch (error) {
    throw new Error(
      error instanceof TypeError
        ? 'API request could not reach the server. Check that the endpoint is reachable from this browser and that it allows CORS for Authorization and Content-Type headers.'
        : error instanceof Error
          ? error.message
          : 'API request failed before receiving a response.',
    );
  }

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
