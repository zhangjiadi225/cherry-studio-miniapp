import {
  getRuntimeSnapshot,
  isCherryError,
  streamText,
} from '@cherry-miniapp/kit';
import type { AiGateway } from './AiGateway';

/** Cherry AI adapter. All host calls stay behind the shared MiniApp kit. */
export const cherryKitAiGateway: AiGateway = {
  async getRuntimeSnapshot(modelSlot) {
    const snapshot = await getRuntimeSnapshot(modelSlot);
    return {
      permissions: snapshot.permissions,
      capabilities: snapshot.capabilities.available
        ? {
            reasoning: snapshot.capabilities.reasoning,
            contextWindow: snapshot.capabilities.contextWindow,
          }
        : {
            reasoning: false,
            contextWindow: null,
          },
    };
  },

  async streamText(request) {
    return streamText({
      messages: request.messages.map((message) => ({ ...message })),
      model: request.modelSlot,
      reasoning: request.reasoning,
      signal: request.signal,
      callId: request.callId,
      onChunk: request.onChunk,
    });
  },

  isGatewayError(error): error is { readonly name: string; readonly message: string } {
    return isCherryError(error);
  },
};
