export class AiOutputExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiOutputExtractionError';
  }
}

function collectTopLevelObjectCandidates(text: string): string[] {
  const candidates: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (start < 0) {
      if (character === '{') {
        start = index;
        depth = 1;
        inString = false;
        escaped = false;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '{') {
      depth++;
    } else if (character === '}') {
      depth--;
      if (depth === 0) {
        candidates.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return candidates;
}

export function extractSingleJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.length === 0) throw new AiOutputExtractionError('AI returned an empty response');

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new AiOutputExtractionError('AI response must contain one top-level JSON object');
    }
    return parsed;
  } catch (error) {
    if (error instanceof AiOutputExtractionError) throw error;
  }

  const parsedObjects: unknown[] = [];
  for (const candidate of collectTopLevelObjectCandidates(trimmed)) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        parsedObjects.push(parsed);
      }
    } catch {
      // Explanatory text can contain braces. Only valid JSON objects count as candidates.
    }
  }

  if (parsedObjects.length === 0) {
    throw new AiOutputExtractionError('AI response does not contain one complete JSON object');
  }
  if (parsedObjects.length > 1) {
    throw new AiOutputExtractionError('AI response contains multiple top-level JSON objects');
  }
  return parsedObjects[0];
}
