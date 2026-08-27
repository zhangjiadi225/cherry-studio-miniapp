import { APP_VERSION } from '../../application/AppVersion';
import {
  createAcceptedWeaponPack,
  type ContentPackV1,
  type WeaponGenerationProposalV1,
} from '../../content/schema/ContentPack';
import {
  validateContentPack,
  validateWeaponGenerationProposal,
  type ContentValidationIssue,
} from '../../content/schema/ContentPackValidator';
import type { WeaponRecipeCompilerRegistries } from '../../game/recipes/weapon/WeaponRecipeCompiler';
import { createWeaponCapabilityCatalog } from '../../game/recipes/weapon/WeaponRecipeCompiler';
import { createCoreEngineRegistrySnapshot } from '../../game/systems/weapon/Weapon';
import type { AppStateStore } from '../../platform/AppStateStore';
import type { AiGateway, AiMessage, AiModelSlot, AiRuntimeSnapshot } from '../AiGateway';
import { AiOutputExtractionError, extractSingleJsonObject } from './JsonObjectExtractor';
import {
  GENERATION_JOB_VERSION,
  type GenerationJobErrorV1,
  type GenerationJobV1,
  type WeaponGenerationStageV1,
  updateGenerationJob,
} from './GenerationJob';
import {
  createCompactWeaponRepairDraft,
  createFallbackWeaponGenerationPlan,
  normalizeWeaponGenerationDraft,
  resolveWeaponGenerationPlan,
  selectWeaponGenerationCatalog,
  type WeaponGenerationPlanV1,
} from './WeaponGenerationContract';
import {
  createWeaponGenerationMessages,
  createWeaponPlanningMessages,
  createWeaponRepairMessages,
  WEAPON_GENERATION_PROMPT_VERSION,
  WEAPON_PLANNING_PROMPT_VERSION,
  WEAPON_REPAIR_PROMPT_VERSION,
} from './WeaponGenerationPrompt';

const MAX_AI_RESPONSE_CHARS = 100_000;
const PLANNING_OUTPUT_TOKEN_RESERVE = 1_500;
const WEAPON_OUTPUT_TOKEN_RESERVE = 6_000;

export interface WeaponForgePreview {
  readonly requestId: string;
  readonly proposal: WeaponGenerationProposalV1;
  readonly validationIssues: readonly ContentValidationIssue[];
}

export interface GenerateWeaponOptions {
  readonly onChunk?: (chunk: string, accumulated: string) => void;
  readonly onStage?: (stage: WeaponGenerationStageV1) => void;
}

export class WeaponForgeError extends Error {
  constructor(
    message: string,
    readonly issues: readonly ContentValidationIssue[] = [],
    readonly stage: WeaponGenerationStageV1 = 'generation',
    readonly retryable = false,
    readonly requestId?: string
  ) {
    super(message);
    this.name = 'WeaponForgeError';
  }
}

type ValidationAttempt =
  | {
      readonly ok: true;
      readonly draft: unknown;
      readonly proposal: WeaponGenerationProposalV1;
    }
  | {
      readonly ok: false;
      readonly draft: unknown;
      readonly issues: readonly ContentValidationIssue[];
      readonly stage: WeaponGenerationStageV1;
    };

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().toLowerCase()}`;
}

function estimatedMessageTokens(messages: readonly AiMessage[]): number {
  return Math.ceil(messages.reduce((total, message) => total + message.content.length, 0) / 3);
}

function messagesFit(
  messages: readonly AiMessage[],
  runtime: AiRuntimeSnapshot,
  outputTokenReserve: number
): boolean {
  return runtime.capabilities.contextWindow === null ||
    estimatedMessageTokens(messages) + outputTokenReserve <= runtime.capabilities.contextWindow;
}

function assertMessagesFit(
  messages: readonly AiMessage[],
  runtime: AiRuntimeSnapshot,
  outputTokenReserve: number,
  stage: WeaponGenerationStageV1,
  requestId: string
): void {
  if (messagesFit(messages, runtime, outputTokenReserve)) return;
  throw new WeaponForgeError(
    `The selected Cherry model context window is too small during ${stage}`,
    [],
    stage,
    true,
    requestId
  );
}

function errorDetails(
  gateway: AiGateway,
  error: unknown,
  stage: WeaponGenerationStageV1
): GenerationJobErrorV1 {
  if (error instanceof WeaponForgeError) {
    return {
      name: error.name,
      message: error.message,
      retryable: error.retryable,
      stage: error.stage,
    };
  }
  if (gateway.isGatewayError(error)) {
    return {
      name: error.name,
      message: error.message,
      retryable: ['RateLimited', 'Unavailable', 'Internal', 'Cancelled'].includes(error.name),
      stage,
    };
  }
  return {
    name: error instanceof Error ? error.name : 'Unavailable',
    message: error instanceof Error ? error.message : 'AI generation failed',
    retryable: false,
    stage,
  };
}

function validationStage(issues: readonly ContentValidationIssue[]): WeaponGenerationStageV1 {
  if (issues.some((issue) => issue.code === 'INVALID_JSON')) return 'extraction';
  if (issues.some((issue) => issue.code === 'PERFORMANCE_BUDGET_EXCEEDED')) return 'performance';
  if (issues.some((issue) => issue.code === 'WEAPON_BUDGET_EXCEEDED')) return 'balance';
  if (issues.some((issue) =>
    issue.code === 'INVALID_REFERENCE' || issue.code === 'INCOMPATIBLE_PRIMITIVES'
  )) return 'compatibility';
  return 'schema';
}

function evaluateResponse(
  response: string,
  plan: WeaponGenerationPlanV1,
  registries: WeaponRecipeCompilerRegistries
): ValidationAttempt {
  let extracted: unknown;
  try {
    extracted = extractSingleJsonObject(response);
  } catch (error) {
    const message = error instanceof AiOutputExtractionError
      ? error.message
      : 'AI response could not be extracted as JSON';
    const issues: readonly ContentValidationIssue[] = Object.freeze([{
      code: 'INVALID_JSON',
      path: '$',
      message,
    }]);
    return { ok: false, draft: response, issues, stage: 'extraction' };
  }

  const draft = normalizeWeaponGenerationDraft(extracted, plan);
  const validation = validateWeaponGenerationProposal(draft, registries);
  if (!validation.ok) {
    return {
      ok: false,
      draft,
      issues: validation.issues,
      stage: validationStage(validation.issues),
    };
  }
  return { ok: true, draft, proposal: validation.value };
}

function isRepairable(attempt: Extract<ValidationAttempt, { readonly ok: false }>): boolean {
  return !attempt.issues.some((issue) =>
    issue.code === 'UNSUPPORTED_CONTENT' ||
    (issue.code === 'INVALID_JSON' && issue.message.includes('multiple top-level')) ||
    issue.message.includes('executable or embedded markup')
  );
}

function persistedDraft(attempt: ValidationAttempt): unknown | undefined {
  return typeof attempt.draft === 'string' ? undefined : attempt.draft;
}

function isTransientGatewayError(gateway: AiGateway, error: unknown): boolean {
  return gateway.isGatewayError(error) && ['RateLimited', 'Unavailable', 'Internal'].includes(error.name);
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
    if (!this.hostVisible) {
      throw new WeaponForgeError(
        'Weapon generation is unavailable while the app is hidden', [], 'preflight'
      );
    }
    const userIntent = rawIntent.trim();
    if (userIntent.length < 3 || userIntent.length > 500) {
      throw new WeaponForgeError('Weapon intent must contain 3..500 characters', [], 'preflight');
    }

    const requestId = createId('weapon');
    const now = new Date().toISOString();
    let currentStage: WeaponGenerationStageV1 = 'preflight';
    let job: GenerationJobV1 = Object.freeze({
      jobVersion: GENERATION_JOB_VERSION,
      requestId,
      task: 'weapon',
      promptVersion: WEAPON_GENERATION_PROMPT_VERSION,
      planningPromptVersion: WEAPON_PLANNING_PROMPT_VERSION,
      modelSlot: 'default',
      status: 'pending',
      stage: currentStage,
      userIntent,
      createdAt: now,
      updatedAt: now,
    });
    await this.store.upsertGenerationJob(job);

    const controller = new AbortController();
    this.active = { requestId, controller };
    const setStage = (stage: WeaponGenerationStageV1) => {
      currentStage = stage;
      options.onStage?.(stage);
    };
    const assertActive = () => {
      if (controller.signal.aborted || this.active?.requestId !== requestId) {
        throw { name: 'Cancelled', message: 'Cancelled weapon generation request' };
      }
    };

    try {
      const runtime = await this.gateway.getRuntimeSnapshot('default');
      if (runtime.permissions['ai.chat'] === false) {
        throw { name: 'PermissionDenied', message: 'Cherry AI permission is not granted' };
      }

      setStage('planning');
      const fallbackPlan = createFallbackWeaponGenerationPlan(userIntent, this.catalog);
      const planningMessages = createWeaponPlanningMessages(userIntent, this.catalog);
      const planningCallId = createId('forge-plan');
      job = updateGenerationJob(job, {
        status: 'planning',
        stage: 'planning',
        callId: planningCallId,
      }, new Date().toISOString());
      await this.store.upsertGenerationJob(job);

      let plan = fallbackPlan;
      let planningFallbackUsed = !messagesFit(
        planningMessages,
        runtime,
        PLANNING_OUTPUT_TOKEN_RESERVE
      );
      if (!planningFallbackUsed) {
        try {
          const planningResponse = await this.gateway.streamText({
            messages: planningMessages,
            modelSlot: 'quick',
            reasoning: 'off',
            signal: controller.signal,
            callId: planningCallId,
          });
          assertActive();
          if (planningResponse.length > 20_000) {
            planningFallbackUsed = true;
          } else {
            plan = resolveWeaponGenerationPlan(
              extractSingleJsonObject(planningResponse),
              userIntent,
              this.catalog
            );
          }
        } catch (error) {
          if (
            controller.signal.aborted ||
            (this.gateway.isGatewayError(error) && error.name === 'Cancelled')
          ) {
            throw error;
          }
          planningFallbackUsed = true;
          plan = fallbackPlan;
        }
      }
      const scopedCatalog = selectWeaponGenerationCatalog(this.catalog, plan);
      const scopedPrimitiveIds = new Set(scopedCatalog.primitives.map((primitive) => primitive.id));
      plan = Object.freeze({
        ...plan,
        primitiveIds: Object.freeze(plan.primitiveIds.filter((id) => scopedPrimitiveIds.has(id))),
      });
      job = updateGenerationJob(job, {
        plan,
        planningFallbackUsed,
      }, new Date().toISOString());
      await this.store.upsertGenerationJob(job);

      setStage('generation');
      const messages = createWeaponGenerationMessages(userIntent, scopedCatalog, plan);
      assertMessagesFit(messages, runtime, WEAPON_OUTPUT_TOKEN_RESERVE, 'generation', requestId);
      const generationCallId = createId('forge-generate');
      job = updateGenerationJob(job, {
        status: 'streaming',
        stage: 'generation',
        callId: generationCallId,
      }, new Date().toISOString());
      await this.store.upsertGenerationJob(job);
      const response = await this.gateway.streamText({
        messages,
        modelSlot: 'default',
        reasoning: 'off',
        signal: controller.signal,
        callId: generationCallId,
        onChunk: options.onChunk,
      });
      assertActive();
      if (response.length > MAX_AI_RESPONSE_CHARS) {
        throw { name: 'InvalidArgument', message: 'Cherry AI response exceeds the forge limit' };
      }

      setStage('extraction');
      job = updateGenerationJob(job, {
        status: 'received',
        stage: 'extraction',
        rawResponse: response,
      }, new Date().toISOString());
      await this.store.upsertGenerationJob(job);
      setStage('schema');
      job = updateGenerationJob(job, {
        status: 'validating',
        stage: 'schema',
      }, new Date().toISOString());
      await this.store.upsertGenerationJob(job);
      let attempt = evaluateResponse(response, plan, this.engine);

      if (!attempt.ok && isRepairable(attempt)) {
        setStage('repair');
        const repairMessages = createWeaponRepairMessages(
          userIntent,
          typeof attempt.draft === 'string'
            ? attempt.draft.slice(0, 30_000)
            : createCompactWeaponRepairDraft(attempt.draft),
          attempt.issues,
          scopedCatalog,
          plan
        );
        let repairModelSlot: AiModelSlot = 'default';
        try {
          const quickRuntime = await this.gateway.getRuntimeSnapshot('quick');
          if (
            quickRuntime.permissions['ai.chat'] !== false &&
            messagesFit(repairMessages, quickRuntime, WEAPON_OUTPUT_TOKEN_RESERVE)
          ) {
            repairModelSlot = 'quick';
          }
        } catch {
          repairModelSlot = 'default';
        }
        if (repairModelSlot === 'default') {
          assertMessagesFit(
            repairMessages,
            runtime,
            WEAPON_OUTPUT_TOKEN_RESERVE,
            'repair',
            requestId
          );
        }
        const repairCallId = createId('forge-repair');
        job = updateGenerationJob(job, {
          status: 'repairing',
          stage: 'repair',
          callId: repairCallId,
          draft: persistedDraft(attempt),
          validation: { ok: false, issues: attempt.issues },
          repairAttempted: true,
          repairPromptVersion: WEAPON_REPAIR_PROMPT_VERSION,
          repairModelSlot,
        }, new Date().toISOString());
        await this.store.upsertGenerationJob(job);
        let repairResponse: string;
        let repairReceivedText = false;
        const onRepairChunk = (chunk: string, accumulated: string) => {
          if (chunk.length > 0) repairReceivedText = true;
          options.onChunk?.(chunk, accumulated);
        };
        try {
          repairResponse = await this.gateway.streamText({
            messages: repairMessages,
            modelSlot: repairModelSlot,
            reasoning: 'off',
            signal: controller.signal,
            callId: repairCallId,
            onChunk: onRepairChunk,
          });
        } catch (error) {
          if (
            repairModelSlot !== 'quick' || repairReceivedText ||
            !isTransientGatewayError(this.gateway, error)
          ) {
            throw error;
          }
          assertActive();
          assertMessagesFit(
            repairMessages,
            runtime,
            WEAPON_OUTPUT_TOKEN_RESERVE,
            'repair',
            requestId
          );
          repairModelSlot = 'default';
          const fallbackRepairCallId = createId('forge-repair-fallback');
          job = updateGenerationJob(job, {
            callId: fallbackRepairCallId,
            repairModelSlot,
          }, new Date().toISOString());
          await this.store.upsertGenerationJob(job);
          repairResponse = await this.gateway.streamText({
            messages: repairMessages,
            modelSlot: repairModelSlot,
            reasoning: 'off',
            signal: controller.signal,
            callId: fallbackRepairCallId,
            onChunk: onRepairChunk,
          });
        }
        assertActive();
        if (repairResponse.length > MAX_AI_RESPONSE_CHARS) {
          throw { name: 'InvalidArgument', message: 'Cherry AI repair response exceeds the forge limit' };
        }
        attempt = evaluateResponse(repairResponse, plan, this.engine);
        job = updateGenerationJob(job, {
          status: 'validating',
          stage: attempt.ok ? 'schema' : attempt.stage,
          rawResponse: repairResponse,
          draft: persistedDraft(attempt),
          validation: attempt.ok
            ? { ok: true, issues: [] }
            : { ok: false, issues: attempt.issues },
        }, new Date().toISOString());
        await this.store.upsertGenerationJob(job);
      }

      if (!attempt.ok) {
        setStage(attempt.stage);
        job = updateGenerationJob(job, {
          status: 'failed',
          stage: attempt.stage,
          draft: persistedDraft(attempt),
          validation: { ok: false, issues: attempt.issues },
          error: {
            name: 'ValidationFailed',
            message: 'Generated weapon failed local validation',
            retryable: false,
            stage: attempt.stage,
          },
        }, new Date().toISOString());
        await this.store.upsertGenerationJob(job);
        throw new WeaponForgeError(
          job.repairAttempted
            ? 'Generated weapon failed local validation after one repair attempt'
            : 'Generated weapon failed local validation and is not safe to repair automatically',
          attempt.issues,
          attempt.stage,
          false,
          requestId
        );
      }

      setStage('preview');
      job = updateGenerationJob(job, {
        status: 'preview',
        stage: 'preview',
        draft: attempt.proposal,
        validation: { ok: true, issues: [] },
        error: undefined,
      }, new Date().toISOString());
      await this.store.upsertGenerationJob(job);
      return Object.freeze({
        requestId,
        proposal: attempt.proposal,
        validationIssues: Object.freeze([]),
      });
    } catch (error) {
      if (error instanceof WeaponForgeError && job.status === 'failed') throw error;
      const details = errorDetails(this.gateway, error, currentStage);
      const interrupted = controller.signal.aborted || details.name === 'Cancelled';
      job = updateGenerationJob(job, {
        status: interrupted ? 'interrupted' : 'failed',
        stage: details.stage ?? currentStage,
        error: details,
      }, new Date().toISOString());
      await this.store.upsertGenerationJob(job);
      if (error instanceof WeaponForgeError) throw error;
      throw new WeaponForgeError(
        details.message,
        [],
        details.stage ?? currentStage,
        details.retryable,
        requestId
      );
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
    if (this.active) {
      throw new WeaponForgeError('Wait for the active generation request to finish', [], 'install');
    }
    const job = findJob(this.store, requestId);
    if (!job || job.status !== 'preview' || job.draft === undefined) {
      throw new WeaponForgeError(
        'Weapon preview is missing or no longer acceptable', [], 'install', false, requestId
      );
    }
    const validation = validateWeaponGenerationProposal(job.draft, this.engine);
    if (!validation.ok) {
      throw new WeaponForgeError(
        'Stored weapon preview failed validation', validation.issues,
        validationStage(validation.issues), false, requestId
      );
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
      throw new WeaponForgeError(
        'Accepted ContentPack failed final validation', packValidation.issues,
        validationStage(packValidation.issues), false, requestId
      );
    }
    const acceptedJob = updateGenerationJob(job, {
      status: 'accepted',
      stage: 'install',
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
      throw new WeaponForgeError(
        'Generation job cannot be rejected in its current state', [], 'install', false, requestId
      );
    }
    await this.store.upsertGenerationJob(updateGenerationJob(
      job,
      { status: 'rejected' },
      new Date().toISOString()
    ));
  }
}
