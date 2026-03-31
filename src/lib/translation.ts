export const DIRECTIONS = ['en-zh', 'zh-en'] as const;

export type Direction = (typeof DIRECTIONS)[number];

export type ModelStatus =
  | 'checking'
  | 'not_downloaded'
  | 'downloading'
  | 'ready'
  | 'translating'
  | 'clearing'
  | 'error';

export type OfflineAvailability = Record<Direction, boolean>;

export interface DirectionDefinition {
  id: Direction;
  label: string;
  sourceLabel: string;
  targetLabel: string;
  model: string;
  sampleInput: string;
}

export const DIRECTION_DEFINITIONS: Record<Direction, DirectionDefinition> = {
  'en-zh': {
    id: 'en-zh',
    label: 'English -> Chinese',
    sourceLabel: 'English',
    targetLabel: 'Chinese',
    model: 'Xenova/opus-mt-en-zh',
    sampleInput: 'PocketBabel keeps translation on your device.',
  },
  'zh-en': {
    id: 'zh-en',
    label: 'Chinese -> English',
    sourceLabel: 'Chinese',
    targetLabel: 'English',
    model: 'Xenova/opus-mt-zh-en',
    sampleInput: '离线翻译应该在同一台设备上持续可用。',
  },
};

export const DEFAULT_DIRECTION: Direction = 'en-zh';

export function getDirectionDefinition(direction: Direction): DirectionDefinition {
  return DIRECTION_DEFINITIONS[direction];
}

export function swapDirection(direction: Direction): Direction {
  return direction === 'en-zh' ? 'zh-en' : 'en-zh';
}

export function createEmptyOfflineAvailability(): OfflineAvailability {
  return {
    'en-zh': false,
    'zh-en': false,
  };
}

export function getModelStatusLabel(status: ModelStatus): string {
  switch (status) {
    case 'checking':
      return 'Checking offline availability';
    case 'not_downloaded':
      return 'Not downloaded';
    case 'downloading':
      return 'Downloading model';
    case 'ready':
      return 'Ready for offline use';
    case 'translating':
      return 'Translating';
    case 'clearing':
      return 'Clearing downloaded models';
    case 'error':
      return 'Error';
    default:
      return status satisfies never;
  }
}
