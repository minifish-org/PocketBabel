const MODEL_CACHE_KEYS = ['transformers-cache'];

export async function clearManagedModelCaches(): Promise<void> {
  if ('caches' in window) {
    await Promise.all(
      MODEL_CACHE_KEYS.map(async (key) => {
        try {
          await caches.delete(key);
        } catch (error) {
          throw new Error(
            `Failed to delete browser cache "${key}": ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }),
    );
  }

  if ('indexedDB' in window && typeof indexedDB.databases === 'function') {
    const databases = await indexedDB.databases();
    const targets = databases
      .map((entry) => entry.name)
      .filter((name): name is string => {
        if (!name) {
          return false;
        }

        return (
          name.includes('transformers') || name.includes('onnx') || name.includes('pocketbabel')
        );
      });

    await Promise.all(
      targets.map(
        (name) =>
          new Promise<void>((resolve, reject) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () =>
              reject(request.error ?? new Error(`Failed to delete IndexedDB database "${name}".`));
            request.onblocked = () =>
              reject(new Error(`Deletion of IndexedDB database "${name}" was blocked.`));
          }),
      ),
    );
  }
}
