import { describe, expect, it } from 'vitest';
import {
  createEmptyOfflineAvailability,
  getDirectionDefinition,
  getModelStatusLabel,
  swapDirection,
} from './translation';

describe('translation config', () => {
  it('maps each direction to the expected model', () => {
    expect(getDirectionDefinition('en-zh').model).toBe('Xenova/opus-mt-en-zh');
    expect(getDirectionDefinition('zh-en').model).toBe('Xenova/opus-mt-zh-en');
  });

  it('swaps directions explicitly', () => {
    expect(swapDirection('en-zh')).toBe('zh-en');
    expect(swapDirection('zh-en')).toBe('en-zh');
  });

  it('starts with no offline models marked ready', () => {
    expect(createEmptyOfflineAvailability()).toEqual({
      'en-zh': false,
      'zh-en': false,
    });
  });

  it('keeps user-visible status labels stable', () => {
    expect(getModelStatusLabel('ready')).toBe('Ready for offline use');
    expect(getModelStatusLabel('error')).toBe('Error');
  });
});
