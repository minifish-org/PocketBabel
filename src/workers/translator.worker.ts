import { env, pipeline, type TranslationPipeline } from '@huggingface/transformers';
import { DIRECTION_DEFINITIONS, type Direction } from '../lib/translation';

env.allowLocalModels = false;

const DTYPE_FALLBACKS = ['int8', 'fp32'] as const;
type SupportedDtype = (typeof DTYPE_FALLBACKS)[number];
type TranslationResult = Array<{ translation_text?: string }> | { translation_text?: string };
const createTranslationPipeline = pipeline as unknown as (
  task: 'translation',
  model: string,
  options: {
    dtype: SupportedDtype;
    progress_callback: (progress: unknown) => void;
    session_options: {
      graphOptimizationLevel: 'disabled';
    };
  },
) => Promise<TranslationPipeline>;

interface BaseMessage {
  status: string;
  direction: Direction;
}

type IncomingMessage =
  | { type: 'preload'; direction: Direction }
  | { type: 'translate'; direction: Direction; text: string }
  | { type: 'reset'; direction?: Direction };

type OutgoingMessage =
  | (BaseMessage & { status: 'status'; phase: 'downloading' | 'ready' | 'checking' })
  | (BaseMessage & { status: 'progress'; file: string; progress: number; loaded: number; total: number })
  | (BaseMessage & { status: 'translated'; output: string })
  | (BaseMessage & { status: 'error'; message: string });

const pipelineInstances: Partial<Record<Direction, Promise<TranslationPipeline>>> = {};

function postMessageToMainThread(message: OutgoingMessage) {
  self.postMessage(message);
}

async function getTranslator(
  direction: Direction,
  phase: 'downloading' | 'checking',
): Promise<TranslationPipeline> {
  if (!pipelineInstances[direction]) {
    const model = DIRECTION_DEFINITIONS[direction].model;
    postMessageToMainThread({ status: 'status', phase, direction });

    pipelineInstances[direction] = createTranslatorWithFallbacks(model, direction);
  }

  const translator = await pipelineInstances[direction];
  postMessageToMainThread({ status: 'status', phase: 'ready', direction });
  return translator;
}

async function createTranslatorWithFallbacks(
  model: string,
  direction: Direction,
): Promise<TranslationPipeline> {
  const errors: string[] = [];

  for (const dtype of DTYPE_FALLBACKS) {
    try {
      return await createTranslationPipeline('translation', model, {
        dtype,
        session_options: {
          graphOptimizationLevel: 'disabled',
        },
        progress_callback: (progress) => {
          const progressPayload = progress as {
            status?: string;
            file?: string;
            progress?: number;
            loaded?: number;
            total?: number;
          };

          if (progressPayload.status === 'progress') {
            postMessageToMainThread({
              status: 'progress',
              direction,
              file: `${String(progressPayload.file ?? 'Model file')} (${dtype})`,
              progress: Number(progressPayload.progress ?? 0),
              loaded: Number(progressPayload.loaded ?? 0),
              total: Number(progressPayload.total ?? 0),
            });
          }
        },
      });
    } catch (error) {
      errors.push(formatLoadError(dtype, error));
    }
  }

  throw new Error(
    `Failed to load ${model}. Attempts: ${errors.join(' | ')}. Clear downloaded models and try again.`,
  );
}

function formatLoadError(dtype: SupportedDtype, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${dtype}: ${message}`;
}

function resetTranslator(direction?: Direction) {
  if (direction) {
    delete pipelineInstances[direction];
    return;
  }

  for (const key of Object.keys(pipelineInstances) as Direction[]) {
    delete pipelineInstances[key];
  }
}

self.addEventListener('message', async (event: MessageEvent<IncomingMessage>) => {
  const message = event.data;

  if (message.type === 'reset') {
    resetTranslator(message.direction);
    return;
  }

  try {
    if (message.type === 'preload') {
      await getTranslator(message.direction, 'checking');
      return;
    }

    const translator = await getTranslator(message.direction, 'downloading');
    const output = (await translator(message.text)) as TranslationResult;
    const translatedText = Array.isArray(output)
      ? output[0]?.translation_text
      : output.translation_text;

    if (!translatedText) {
      throw new Error('Model returned an empty translation result.');
    }

    postMessageToMainThread({
      status: 'translated',
      direction: message.direction,
      output: translatedText,
    });
  } catch (error) {
    resetTranslator(message.direction);
    postMessageToMainThread({
      status: 'error',
      direction: message.direction,
      message:
        error instanceof Error ? error.message : 'Unknown translation error while using the model.',
    });
  }
});
