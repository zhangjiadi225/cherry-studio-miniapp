export class AiOutputExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiOutputExtractionError';
  }
}

export function extractSingleJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  if (candidate.length === 0) throw new AiOutputExtractionError('AI returned an empty response');

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    throw new AiOutputExtractionError('AI response is not one valid JSON value');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new AiOutputExtractionError('AI response must contain one top-level JSON object');
  }
  return parsed;
}
