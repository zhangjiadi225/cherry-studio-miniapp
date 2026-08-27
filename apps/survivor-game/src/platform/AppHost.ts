export interface AppStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface AppHost {
  kind: 'browser' | 'cherry';
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
  return {
    kind: 'cherry',
    storage: createSerializedStorage({
      async get(key) {
        const { value } = await cherry.storage.get(key);
        return value;
      },
      async set(key, value) {
        await cherry.storage.set(key, value);
      },
    }),
    onVisibilityChange(handler) {
      return cherry.on('app.visibilityChange', ({ visible }) => handler(visible));
    },
  };
}

function createBrowserHost(): AppHost {
  return {
    kind: 'browser',
    storage: createSerializedStorage({
      async get(key) {
        return window.localStorage.getItem(key);
      },
      async set(key, value) {
        window.localStorage.setItem(key, value);
      },
    }),
    onVisibilityChange(handler) {
      const listener = () => handler(!document.hidden);
      document.addEventListener('visibilitychange', listener);
      return () => document.removeEventListener('visibilitychange', listener);
    },
  };
}

export function createAppHost(): AppHost {
  return typeof cherry !== 'undefined' ? createCherryHost() : createBrowserHost();
}
