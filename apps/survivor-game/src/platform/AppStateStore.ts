import { APP_VERSION } from '../application/AppVersion';
import { MUTE_STORAGE_KEY } from '../game/systems/audio/Audio';
import {
  loadMetaState,
  META_STORAGE_KEY,
  type MetaState,
} from '../game/systems/meta/MetaProgression';
import type { AppStorage } from './AppHost';
import {
  MAX_SAVED_GENERATION_JOBS,
  type GenerationJobV1,
} from '../ai/generation/GenerationJob';
import {
  MAX_ENABLED_GENERATED_WEAPON_PACKS,
  type ContentPackV1,
} from '../content/schema/ContentPack';

export const APP_STATE_STORAGE_KEY = 'survivor-game:app-state';
export const APP_STATE_VERSION = 1;
export const LEGACY_PERF_STORAGE_KEY = 'survivor_perf';
export const MAX_APP_STATE_BYTES = 1_000_000;

export interface AppSettingsV1 {
  muted: boolean;
  perfEnabled: boolean;
}

export interface ContentLibraryStateV1 {
  // Persisted input remains unknown until it is validated while building a runtime snapshot.
  packs: unknown[];
  enabledPackIds: string[];
}

export interface AppStatePayloadV1 {
  meta: MetaState;
  settings: AppSettingsV1;
  contentLibrary: ContentLibraryStateV1;
  generationJobs: unknown[];
  activeRun?: unknown;
}

export interface AppStateEnvelopeV1 extends AppStatePayloadV1 {
  stateVersion: typeof APP_STATE_VERSION;
  revision: number;
  savedAt: string;
  appVersion: string;
}

export class AppStateLoadError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'AppStateLoadError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function createInitialState(
  meta: MetaState = loadMetaState(),
  settings: AppSettingsV1 = { muted: false, perfEnabled: false }
): AppStateEnvelopeV1 {
  return {
    stateVersion: APP_STATE_VERSION,
    revision: 0,
    savedAt: new Date(0).toISOString(),
    appVersion: APP_VERSION,
    meta,
    settings,
    contentLibrary: {
      packs: [],
      enabledPackIds: [],
    },
    generationJobs: [],
  };
}

function parseState(raw: string): AppStateEnvelopeV1 {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) throw new Error('State root must be an object');
    if (parsed.stateVersion !== APP_STATE_VERSION) {
      throw new Error(`Unsupported state version: ${String(parsed.stateVersion)}`);
    }
    if (
      typeof parsed.revision !== 'number' ||
      !Number.isInteger(parsed.revision) ||
      parsed.revision < 0
    ) {
      throw new Error('Invalid state revision');
    }
    if (typeof parsed.savedAt !== 'string' || typeof parsed.appVersion !== 'string') {
      throw new Error('Invalid state metadata');
    }
    if (!isRecord(parsed.meta)) throw new Error('Invalid meta state');
    if (!isRecord(parsed.settings)) throw new Error('Invalid settings');
    if (
      typeof parsed.settings.muted !== 'boolean' ||
      typeof parsed.settings.perfEnabled !== 'boolean'
    ) {
      throw new Error('Invalid settings values');
    }
    if (!isRecord(parsed.contentLibrary)) throw new Error('Invalid content library');
    if (
      !Array.isArray(parsed.contentLibrary.packs) ||
      !isStringArray(parsed.contentLibrary.enabledPackIds)
    ) {
      throw new Error('Invalid content library values');
    }
    if (!Array.isArray(parsed.generationJobs)) throw new Error('Invalid generation jobs');

    return {
      stateVersion: APP_STATE_VERSION,
      revision: parsed.revision,
      savedAt: parsed.savedAt,
      appVersion: parsed.appVersion,
      meta: loadMetaState(JSON.stringify(parsed.meta)),
      settings: {
        muted: parsed.settings.muted,
        perfEnabled: parsed.settings.perfEnabled,
      },
      contentLibrary: {
        packs: [...parsed.contentLibrary.packs],
        enabledPackIds: [...parsed.contentLibrary.enabledPackIds],
      },
      generationJobs: [...parsed.generationJobs],
      ...('activeRun' in parsed ? { activeRun: parsed.activeRun } : {}),
    };
  } catch (error) {
    throw new AppStateLoadError(
      'Saved app state is invalid and was left unchanged',
      error
    );
  }
}

function serializeState(state: AppStateEnvelopeV1): string {
  const serialized = JSON.stringify(state);
  const bytes = new TextEncoder().encode(serialized).byteLength;
  if (bytes > MAX_APP_STATE_BYTES) {
    throw new Error(
      `App state exceeds storage budget (${bytes}/${MAX_APP_STATE_BYTES} bytes)`
    );
  }
  return serialized;
}

export class AppStateStore {
  private writeTail: Promise<void> = Promise.resolve();

  private constructor(
    private readonly storage: AppStorage,
    private state: AppStateEnvelopeV1
  ) {}

  static async open(storage: AppStorage): Promise<AppStateStore> {
    const rawState = await storage.get(APP_STATE_STORAGE_KEY);
    if (rawState !== null) {
      return new AppStateStore(storage, parseState(rawState));
    }

    const [rawMeta, rawMuted, rawPerf] = await Promise.all([
      storage.get(META_STORAGE_KEY),
      storage.get(MUTE_STORAGE_KEY),
      storage.get(LEGACY_PERF_STORAGE_KEY),
    ]);
    const initial = createInitialState(loadMetaState(rawMeta), {
      muted: rawMuted === '1',
      perfEnabled: rawPerf === '1',
    });
    const store = new AppStateStore(storage, initial);
    await store.commit((state) => state);
    return store;
  }

  getSnapshot(): Readonly<AppStateEnvelopeV1> {
    return this.state;
  }

  commit(
    update: (current: Readonly<AppStateEnvelopeV1>) => AppStatePayloadV1
  ): Promise<void> {
    const operation = this.writeTail.then(async () => {
      const payload = update(this.state);
      const next: AppStateEnvelopeV1 = {
        ...payload,
        stateVersion: APP_STATE_VERSION,
        revision: this.state.revision + 1,
        savedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
      };
      const serialized = serializeState(next);
      await this.storage.set(APP_STATE_STORAGE_KEY, serialized);
      this.state = parseState(serialized);
    });
    this.writeTail = operation.catch(() => undefined);
    return operation;
  }

  setMeta(meta: MetaState): Promise<void> {
    return this.commit((state) => ({ ...state, meta }));
  }

  setMuted(muted: boolean): Promise<void> {
    return this.commit((state) => ({
      ...state,
      settings: { ...state.settings, muted },
    }));
  }

  upsertGenerationJob(job: GenerationJobV1): Promise<void> {
    return this.commit((state) => ({
      ...state,
      generationJobs: [
        ...state.generationJobs.filter((candidate) =>
          !isRecord(candidate) || candidate.requestId !== job.requestId
        ),
        job,
      ].slice(-MAX_SAVED_GENERATION_JOBS),
    }));
  }

  acceptGeneratedWeaponPack(
    pack: ContentPackV1,
    acceptedJob: GenerationJobV1
  ): Promise<void> {
    if (acceptedJob.status !== 'accepted' || acceptedJob.acceptedPackId !== pack.id) {
      throw new Error('Accepted generation job must reference the installed ContentPack');
    }

    return this.commit((state) => {
      if (state.contentLibrary.enabledPackIds.length >= MAX_ENABLED_GENERATED_WEAPON_PACKS) {
        throw new Error(
          `Enabled generated weapon limit reached (${MAX_ENABLED_GENERATED_WEAPON_PACKS})`
        );
      }
      const existingPack = state.contentLibrary.packs.find((candidate) =>
        isRecord(candidate) && candidate.id === pack.id
      );
      if (existingPack !== undefined) {
        throw new Error(`ContentPack ID already exists: ${pack.id}`);
      }

      return {
        ...state,
        contentLibrary: {
          packs: [...state.contentLibrary.packs, pack],
          enabledPackIds: [...state.contentLibrary.enabledPackIds, pack.id],
        },
        generationJobs: [
          ...state.generationJobs.filter((candidate) =>
            !isRecord(candidate) || candidate.requestId !== acceptedJob.requestId
          ),
          acceptedJob,
        ].slice(-MAX_SAVED_GENERATION_JOBS),
      };
    });
  }

  setContentPackEnabled(packId: string, enabled: boolean): Promise<void> {
    return this.commit((state) => {
      const pack = state.contentLibrary.packs.find((candidate) =>
        isRecord(candidate) && candidate.id === packId
      );
      if (!isRecord(pack) || pack.status !== 'accepted') {
        throw new Error(`Accepted ContentPack not found: ${packId}`);
      }
      const currentlyEnabled = state.contentLibrary.enabledPackIds.includes(packId);
      if (currentlyEnabled === enabled) return { ...state };
      if (
        enabled &&
        state.contentLibrary.enabledPackIds.length >= MAX_ENABLED_GENERATED_WEAPON_PACKS
      ) {
        throw new Error(
          `Enabled generated weapon limit reached (${MAX_ENABLED_GENERATED_WEAPON_PACKS})`
        );
      }
      return {
        ...state,
        contentLibrary: {
          ...state.contentLibrary,
          enabledPackIds: enabled
            ? [...state.contentLibrary.enabledPackIds, packId]
            : state.contentLibrary.enabledPackIds.filter((id) => id !== packId),
        },
      };
    });
  }
}
