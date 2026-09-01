import { installCherryDevMock } from '@cherry-miniapp/kit/dev-mock';
import { APP_VERSION } from '../application/AppVersion';

interface ForgePromptPayload {
  readonly task?: unknown;
  readonly userIntent?: unknown;
  readonly runtimeShapeExample?: unknown;
  readonly fallbackPlan?: unknown;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function cloneJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function mockMode(userIntent: unknown): string | undefined {
  if (typeof userIntent !== 'string') return undefined;
  return /\[mock:([a-z-]+)\]/i.exec(userIntent)?.[1]?.toLowerCase();
}

function respondWithPromptExample(messages: readonly { readonly content: string }[]): string {
  const content = messages.at(-1)?.content;
  if (!content) return '{}';

  try {
    const payload = JSON.parse(content) as ForgePromptPayload;
    if (payload.task === 'weapon-plan' && payload.fallbackPlan !== undefined) {
      const plan = record(cloneJson(payload.fallbackPlan));
      if (plan) {
        plan.family = 'projectile';
        plan.primitiveIds = [];
      }
      return JSON.stringify(plan ?? payload.fallbackPlan);
    }
    const runtimeShape = record(payload.runtimeShapeExample);
    const runtimeDraft = runtimeShape?.draft;
    if (
      !['weapon', 'weapon-repair'].includes(String(payload.task)) ||
      runtimeDraft === undefined
    ) return '{}';
    const example = cloneJson(runtimeDraft);
    if (payload.task === 'weapon-repair') return JSON.stringify(example);

    const mode = mockMode(payload.userIntent);
    if (mode === 'json-prefix') {
      return `这是生成结果：\n${JSON.stringify(example)}\n已完成。`;
    }
    if (mode === 'multiple-json') {
      return `${JSON.stringify(example)}\n${JSON.stringify(example)}`;
    }
    if (mode === 'truncated') {
      const serialized = JSON.stringify(example);
      return serialized.slice(0, Math.max(1, serialized.length - 24));
    }
    const recipe = record(record(example)?.recipe);
    const projectile = record(recipe?.projectile);
    if (mode === 'invalid-reference') {
      const motion = record(projectile?.motion);
      if (motion) motion.primitiveId = 'builtin.motion.missing';
    } else if (mode === 'over-budget' && projectile) {
      projectile.damage = 100_000;
      const trigger = record(recipe?.trigger);
      const params = record(trigger?.params);
      if (params) params.cooldown = 0.2;
    }
    return JSON.stringify(example);
  } catch {
    return '{}';
  }
}

/** Explicit browser-only mock. Cherry Studio already provides the real host. */
export function installDevelopmentCherryMock(): void {
  if (!import.meta.env.DEV) return;
  installCherryDevMock({
    appId: 'io.github.zhangjiadi225.survivor-game',
    version: APP_VERSION,
    permissions: {
      'ai.chat': true,
      'storage.get': true,
      'storage.set': true,
    },
    aiResponder: respondWithPromptExample,
  });
}
