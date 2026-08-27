import { installCherryDevMock } from '@cherry-miniapp/kit/dev-mock';
import { APP_VERSION } from '../application/AppVersion';

interface ForgePromptPayload {
  readonly task?: unknown;
  readonly validRuntimeExample?: unknown;
}

function respondWithPromptExample(messages: readonly { readonly content: string }[]): string {
  const content = messages.at(-1)?.content;
  if (!content) return '{}';

  try {
    const payload = JSON.parse(content) as ForgePromptPayload;
    if (payload.task !== 'weapon' || payload.validRuntimeExample === undefined) return '{}';
    return JSON.stringify(payload.validRuntimeExample);
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
