import { APP_VERSION } from '../../application/AppVersion';
import { createAcceptedWeaponPack, type ContentPackV1, type WeaponGenerationProposalV1 } from '../../content/schema/ContentPack';
import { validateContentPack, validateWeaponGenerationProposal, type ContentValidationIssue } from '../../content/schema/ContentPackValidator';
import { createCoreEngineRegistrySnapshot } from '../../game/systems/weapon/Weapon';
import { createWeaponCapabilityCatalog } from '../../game/recipes/weapon/WeaponRecipeCompiler';
import type { AppStateStore } from '../../platform/AppStateStore';
import type { AiGateway } from '../AiGateway';
import { extractSingleJsonObject } from './JsonObjectExtractor';
import {
  GENERATION_JOB_VERSION,
  type GenerationJobErrorV1,
  type GenerationJobV1,
  updateGenerationJob,
} from './GenerationJob';
import {
  createWeaponGenerationMessages,
  WEAPON_GENERATION_PROMPT_VERSION,
} from './WeaponGenerationPrompt';

export interface WeaponForgePreview {
  readonly requestId: string;
  readonly proposal: WeaponGenerationProposalV1;
  readonly validationIssues: readonly ContentValidationIssue[];
}

export interface GenerateWeaponOptions {
  readonly onChunk?: (chunk: string, accumulated: string) => void;
}

export class WeaponForgeError extends Error {
  constructor(
    message: string,
    readonly issues: readonly ContentValidationIssue[] = []
  ) {
    super(message);
    this.name = 'WeaponForgeError';
  }
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().toLowerCase()}`;
}

function errorDetails(gateway: AiGateway, error: unknown): GenerationJobErrorV1 {
  if (gateway.isGatewayError(error)) {
    return {
      name: error.name,
      message: error.message,
      retryable: ['RateLimited', 'Unavailable', 'Internal', 'Cancelled'].includes(error.name),
    };
  }
  return {
    name: error instanceof Error ? error.name : 'Unavailable',
    message: error instanceof Error ? error.message : 'AI generation failed',
    retryable: false,
  };
}

function findJob(store: AppStateStore, requestId: string): GenerationJobV1 | undefined {
  const candidate = store.getSnapshot().generationJobs.find((value) =>
    typeof value === 'object' && value !== null &&
    'requestId' in value && value.requestId === requestId
  );
  if (
    typeof candidate !== 'object' || candidate === null ||
    !('jobVersion' in candidate) || candidate.jobVersion !== GENERATION_JOB_VERSION ||
    !('task' in candidate) || candidate.task !== 'weapon' ||
    !('status' in candidate) || typeof candidate.status !== 'string' ||
    !('userIntent' in candidate) || typeof candidate.userIntent !== 'string' ||
    !('createdAt' in candidate) || typeof candidate.createdAt !== 'string' ||
    !('updatedAt' in candidate) || typeof candidate.updatedAt !== 'string' ||
    !('promptVersion' in candidate) || typeof candidate.promptVersion !== 'string'
  ) {
    return undefined;
  }
  return candidate as unknown as GenerationJobV1;
}

export class WeaponForgeService {
  private readonly engine = createCoreEngineRegistrySnapshot();
  private readonly catalog = createWeaponCapabilityCatalog(this.engine);
  private active?: { readonly requestId: string; readonly controller: AbortController };
  private hostVisible = true;

  constructor(
    private readonly gateway: AiGateway,
    private readonly store: AppStateStore
  ) {}

  isGenerating(): boolean {
    return this.active !== undefined;
  }

  async generate(
    rawIntent: string,
    options: GenerateWeaponOptions = {}
  ): Promise<WeaponForgePreview> {
    if (this.active) throw new WeaponForgeError('A weapon generation request is already running');
    if (!this.hostVisible) throw new WeaponForgeError('Weapon generation is unavailable while the app is hidden');
    const userIntent = rawIntent.trim();
    if (userIntent.length < 3 || userIntent.length > 500) {
      throw new WeaponForgeError('Weapon intent must contain 3..500 characters');
    }

    const requestId = createId('weapon');
    const callId = createId('forge');
    const now = new Date().toISOString();
    let job: GenerationJobV1 = Object.freeze({
      jobVersion: GENERATION_JOB_VERSION,
      requestId,
      task: 'weapon',
      promptVersion: WEAPON_GENERATION_PROMPT_VERSION,
      modelSlot: 'default',
      status: 'pending',
      userIntent,
      createdAt: now,
      updatedAt: now,
      callId,
    });
    await this.store.upsertGenerationJob(job);

    const controller = new AbortController();
    this.active = { requestId, controller };
    try {
      const runtime = await this.gateway.getRuntimeSnapshot('default');
      if (runtime.permissions['ai.chat'] === false) {
        throw { name: 'PermissionDenied', message: 'Cherry AI permission is not granted' };
      }
      const messages = createWeaponGenerationMessages(userIntent, this.catalog);
      const estimatedPromptTokens = Math.ceil(
        messages.reduce((total, message) => total + message.content.length, 0) / 3
      );
      if (
        runtime.capabilities.contextWindow !== null &&
        estimatedPromptTokens + 2_000 > runtime.capabilities.contextWindow
      ) {
        throw {
          name: 'Unavailable',
          message: 'The selected Cherry model context window is too small for weapon generation',
        };
      }

      job = updateGenerationJob(job, { status: 'streaming' }, new Date().toISOString());
      await this.store.upsertGenerationJob(job);
      const response = await this.gateway.streamText({
        messages,
        modelSlot: 'default',
        reasoning: 'off',
        signal: controller.signal,
        callId,
        onChunk: options.onChunk,
      });
      if (this.active?.requestId !== requestId) {
        throw { name: 'Cancelled', message: 'Superseded weapon generation response' };
      }
      if (response.length > 100_000) {
        throw { name: 'InvalidArgument', message: 'Cherry AI response exceeds the forge limit' };
      }

      job = updateGenerationJob(job, {
        status: 'received',
        rawResponse: response,
      }, new Date().toISOString());
      await this.store.upsertGenerationJob(job);
      const draft = extractSingleJsonObject(response);
      job = updateGenerationJob(job, {
        status: 'validating',
        draft,
      }, new Date().toISOString());
      await this.store.upsertGenerationJob(job);

      const validation = validateWeaponGenerationProposal(draft, this.engine);
      if (!validation.ok) {
        job = updateGenerationJob(job, {
          status: 'failed',
          validation: { ok: false, issues: validation.issues },
          error: { name: 'ValidationFailed', message: 'Generated weapon failed local validation', retryable: false },
        }, new Date().toISOString());
        await this.store.upsertGenerationJob(job);
        throw new WeaponForgeError('Generated weapon failed local validation', validation.issues);
      }

      job = updateGenerationJob(job, {
        status: 'preview',
        draft: validation.value,
        validation: { ok: true, issues: [] },
      }, new Date().toISOString());
      await this.store.upsertGenerationJob(job);
      return Object.freeze({
        requestId,
        proposal: validation.value,
        validationIssues: Object.freeze([]),
      });
    } catch (error) {
      if (error instanceof WeaponForgeError) throw error;
      const details = errorDetails(this.gateway, error);
      const interrupted = controller.signal.aborted || details.name === 'Cancelled';
      job = updateGenerationJob(job, {
        status: interrupted ? 'interrupted' : 'failed',
        error: details,
      }, new Date().toISOString());
      await this.store.upsertGenerationJob(job);
      throw new WeaponForgeError(details.message);
    } finally {
      if (this.active?.requestId === requestId) this.active = undefined;
    }
  }

  cancelCurrent(): void {
    this.active?.controller.abort();
  }

  setHostVisible(visible: boolean): void {
    this.hostVisible = visible;
    if (!visible) this.cancelCurrent();
  }

  async accept(requestId: string): Promise<ContentPackV1> {
    if (this.active) throw new WeaponForgeError('Wait for the active generation request to finish');
    const job = findJob(this.store, requestId);
    if (!job || job.status !== 'preview' || job.draft === undefined) {
      throw new WeaponForgeError('Weapon preview is missing or no longer acceptable');
    }
    const validation = validateWeaponGenerationProposal(job.draft, this.engine);
    if (!validation.ok) {
      throw new WeaponForgeError('Stored weapon preview failed validation', validation.issues);
    }

    const acceptedAt = new Date().toISOString();
    const pack = createAcceptedWeaponPack(validation.value, {
      packId: `ai.${requestId}`,
      requestId,
      promptVersion: job.promptVersion,
      acceptedAt,
      engineVersion: APP_VERSION,
    });
    const packValidation = validateContentPack(pack, this.engine);
    if (!packValidation.ok) {
      throw new WeaponForgeError('Accepted ContentPack failed final validation', packValidation.issues);
    }
    const acceptedJob = updateGenerationJob(job, {
      status: 'accepted',
      draft: undefined,
      rawResponse: undefined,
      acceptedPackId: pack.id,
      error: undefined,
    }, acceptedAt);
    await this.store.acceptGeneratedWeaponPack(packValidation.value, acceptedJob);
    return packValidation.value;
  }

  async reject(requestId: string): Promise<void> {
    const job = findJob(this.store, requestId);
    if (!job || !['preview', 'failed', 'interrupted'].includes(job.status)) {
      throw new WeaponForgeError('Generation job cannot be rejected in its current state');
    }
    await this.store.upsertGenerationJob(updateGenerationJob(
      job,
      { status: 'rejected' },
      new Date().toISOString()
    ));
  }
}
