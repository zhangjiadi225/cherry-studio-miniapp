import { getCherry, hasCherryHost, onAppVisibility } from '@cherry-miniapp/kit';

export interface AppStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface AppHost {
  kind: 'cherry';
  storage: AppStorage;
  onVisibilityChange(handler: (visible: boolean) => void): () => void;
}

interface StorageBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

function createSerializedStorage(backend: StorageBackend): AppStorage {
  let writeTail: Promise<void> = Promise.resolve();

  return {
    async get(key) {
      await writeTail;
      return backend.get(key);
    },
    set(key, value) {
      const write = writeTail.then(() => backend.set(key, value));
      writeTail = write.catch(() => undefined);
      return write;
    },
  };
}

function createCherryHost(): AppHost {
  const api = getCherry();
  return {
    kind: 'cherry',
    storage: createSerializedStorage({
      async get(key) {
        const { value } = await api.storage.get(key);
        return value;
      },
      async set(key, value) {
        await api.storage.set(key, value);
      },
    }),
    onVisibilityChange(handler) {
      return onAppVisibility(handler);
    },
  };
}

export function createAppHost(): AppHost {
  if (!hasCherryHost()) {
    throw new Error('Cherry Studio Host is unavailable');
  }
  return createCherryHost();
}
