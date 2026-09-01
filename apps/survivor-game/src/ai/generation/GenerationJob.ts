import type { ContentValidationIssue } from '../../content/schema/ContentPackValidator';
import type { WeaponGenerationPlanV1 } from './WeaponGenerationContract';

export const GENERATION_JOB_VERSION = 1;
export const MAX_SAVED_GENERATION_JOBS = 12;

export type GenerationJobStatusV1 =
  | 'pending'
  | 'planning'
  | 'streaming'
  | 'received'
  | 'validating'
  | 'preview'
  | 'repairing'
  | 'accepted'
  | 'rejected'
  | 'interrupted'
  | 'failed';

export type WeaponGenerationStageV1 =
  | 'preflight'
  | 'planning'
  | 'generation'
  | 'extraction'
  | 'schema'
  | 'compatibility'
  | 'balance'
  | 'performance'
  | 'repair'
  | 'preview'
  | 'install';

export interface GenerationJobErrorV1 {
  readonly name: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly stage?: WeaponGenerationStageV1;
}

export interface GenerationJobV1 {
  readonly jobVersion: typeof GENERATION_JOB_VERSION;
  readonly requestId: string;
  readonly task: 'weapon';
  readonly promptVersion: string;
  readonly planningPromptVersion?: string;
  readonly repairPromptVersion?: string;
  readonly repairModelSlot?: 'default' | 'quick';
  readonly modelSlot: 'default';
  readonly status: GenerationJobStatusV1;
  readonly userIntent: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly callId?: string;
  readonly stage?: WeaponGenerationStageV1;
  readonly plan?: WeaponGenerationPlanV1;
  readonly planningFallbackUsed?: boolean;
  readonly repairAttempted?: boolean;
  readonly rawResponse?: string;
  readonly draft?: unknown;
  readonly validation?: {
    readonly ok: boolean;
    readonly issues: readonly ContentValidationIssue[];
  };
  readonly error?: GenerationJobErrorV1;
  readonly acceptedPackId?: string;
}

export function updateGenerationJob(
  job: GenerationJobV1,
  update: Omit<Partial<GenerationJobV1>, 'jobVersion' | 'requestId' | 'createdAt'>,
  updatedAt: string
): GenerationJobV1 {
  return Object.freeze({
    ...job,
    ...update,
    jobVersion: GENERATION_JOB_VERSION,
    requestId: job.requestId,
    createdAt: job.createdAt,
    updatedAt,
  });
}
