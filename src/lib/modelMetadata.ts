import {
  createEmptyOfflineAvailability,
  type Direction,
  type OfflineAvailability,
} from './translation';

const DB_NAME = 'pocketbabel-meta';
const STORE_NAME = 'models';
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'direction' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
): Promise<T> {
  const db = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    };

    run(store, resolve, reject);
  });
}

export async function readOfflineAvailability(): Promise<OfflineAvailability> {
  return withStore('readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const availability = createEmptyOfflineAvailability();
      for (const item of request.result as Array<{ direction: Direction; ready: boolean }>) {
        availability[item.direction] = Boolean(item.ready);
      }
      resolve(availability);
    };
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to read model metadata.'));
  });
}

export async function writeModelReady(direction: Direction, ready: boolean): Promise<void> {
  return withStore('readwrite', (store, resolve, reject) => {
    const request = store.put({
      direction,
      ready,
      updatedAt: Date.now(),
    });
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to update model metadata.'));
  });
}

export async function clearModelMetadata(): Promise<void> {
  return withStore('readwrite', (store, resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to clear model metadata.'));
  });
}
