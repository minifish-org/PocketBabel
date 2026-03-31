export interface RuntimeSupport {
  supported: boolean;
  missing: string[];
}

interface RuntimeTarget {
  Worker?: typeof Worker;
  indexedDB?: IDBFactory;
  caches?: CacheStorage;
}

export function getRuntimeSupport(target: RuntimeTarget = window): RuntimeSupport {
  const missing: string[] = [];

  if (typeof target.Worker !== 'function') {
    missing.push('Web Workers');
  }

  if (!('indexedDB' in target)) {
    missing.push('IndexedDB');
  }

  if (!('caches' in target)) {
    missing.push('Cache Storage');
  }

  return {
    supported: missing.length === 0,
    missing,
  };
}

export function getConnectivityLabel(isOnline: boolean): string {
  return isOnline ? 'Online' : 'Offline';
}

export function getOfflineActionError(hasOfflineModel: boolean, isOnline: boolean): string {
  if (hasOfflineModel || isOnline) {
    return '';
  }

  return 'This direction is not downloaded yet. Go online once to download the model before using it offline.';
}
