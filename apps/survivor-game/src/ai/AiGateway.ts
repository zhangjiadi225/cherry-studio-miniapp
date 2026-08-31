export interface AiMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export type AiModelSlot = 'default' | 'quick';

export interface AiRuntimeSnapshot {
  readonly permissions: Readonly<Record<string, boolean>>;
  readonly capabilities: {
    readonly available: boolean;
    readonly reasoning: boolean;
    readonly contextWindow: number | null;
  };
}

export interface AiStreamRequest {
  readonly messages: readonly AiMessage[];
  readonly modelSlot: AiModelSlot;
  readonly reasoning: 'off';
  readonly signal: AbortSignal;
  readonly callId: string;
  readonly onChunk?: (chunk: string, accumulated: string) => void;
}

/**
 * Cherry adapter port. The concrete implementation must delegate to
 * @cherry-miniapp/kit rather than accessing window.cherry or a model API directly.
 */
export interface AiGateway {
  getRuntimeSnapshot(modelSlot: AiModelSlot): Promise<AiRuntimeSnapshot>;
  streamText(request: AiStreamRequest): Promise<string>;
  isGatewayError(error: unknown): error is { readonly name: string; readonly message: string };
}
