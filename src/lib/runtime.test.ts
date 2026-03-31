import { describe, expect, it } from 'vitest';
import { getConnectivityLabel, getOfflineActionError, getRuntimeSupport } from './runtime';

describe('runtime helpers', () => {
  it('reports missing runtime features', () => {
    const support = getRuntimeSupport({} as Window);

    expect(support.supported).toBe(false);
    expect(support.missing).toEqual(['Web Workers', 'IndexedDB', 'Cache Storage']);
  });

  it('reports supported runtime features', () => {
    const support = getRuntimeSupport({
      Worker: function Worker() {},
      indexedDB: {},
      caches: {},
    } as unknown as Window);

    expect(support.supported).toBe(true);
    expect(support.missing).toEqual([]);
  });

  it('formats connectivity label', () => {
    expect(getConnectivityLabel(true)).toBe('Online');
    expect(getConnectivityLabel(false)).toBe('Offline');
  });

  it('blocks first download while offline', () => {
    expect(getOfflineActionError(false, false)).toMatch('not downloaded yet');
    expect(getOfflineActionError(true, false)).toBe('');
    expect(getOfflineActionError(false, true)).toBe('');
  });
});
