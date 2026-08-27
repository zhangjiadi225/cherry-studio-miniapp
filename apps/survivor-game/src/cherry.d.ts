/** Cherry Studio mini app bridge used by this game. */
declare global {
  const cherry: CherryApi;

  type CherryErrorName =
    | 'PermissionDenied'
    | 'QuotaExceeded'
    | 'RateLimited'
    | 'Unavailable'
    | 'InvalidArgument'
    | 'Cancelled'
    | 'Internal';

  interface CherryError {
    name: CherryErrorName;
    message: string;
  }

  interface CherryApi {
    storage: {
      get(key: string): Promise<{ value: string | null }>;
      set(key: string, value: string): Promise<{ ok: true }>;
    };
    on(
      event: 'app.visibilityChange',
      handler: (payload: { visible: boolean }) => void,
    ): () => void;
  }
}

export {};
