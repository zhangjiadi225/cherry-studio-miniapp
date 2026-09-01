# AI product principles

## Stable core, generative edge

The model enriches an experience; it does not own invariants. Keep scores, inventory, workflow transitions, permissions, billing assumptions, and completion conditions in deterministic code. Let AI produce narrative, NPC dialogue, coaching, alternatives, explanations, or creative material.

This separation allows the product to survive model changes, malformed prose, cancellation and interrupted streams.

## Model slots

- Use `quick` for frequent, short, latency-sensitive reactions.
- Use `default` for infrequent creative or reflective output.
- Query capabilities before building a large prompt. Disable or replace the AI action when `available` is false, and degrade when context size is unknown or insufficient.
- Persist the user's decision before starting a stream. Persist the completed AI result when the stream resolves. An interrupted pending decision must be visible and retryable.

## Local-first product selection

Strong first products have compact local state, text-first AI value, clear turns or tasks, and no dependency on real-time collaboration. Examples include civilization/narrative games, deduction games, interview or negotiation practice, and structured creative workspaces.

Avoid making real-time multiplayer, voice/video, camera input, external webpage embedding or heavy cloud synchronization central until the host exposes suitable capabilities.
