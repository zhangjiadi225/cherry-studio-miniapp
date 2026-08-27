const STABLE_ID_PATTERN = /^[a-z0-9][a-z0-9./-]*$/;
const MAX_STABLE_ID_LENGTH = 120;

export interface ReadonlyRegistry<T> {
  readonly name: string;
  readonly size: number;
  has(id: string): boolean;
  get(id: string): T | undefined;
  require(id: string): T;
  ids(): readonly string[];
  values(): readonly T[];
  entries(): readonly (readonly [string, T])[];
  isFrozen(): boolean;
}

export function assertStableId(id: string): void {
  if (
    id.length === 0 ||
    id.length > MAX_STABLE_ID_LENGTH ||
    !STABLE_ID_PATTERN.test(id) ||
    id.includes('..') ||
    id.startsWith('/') ||
    id.endsWith('/')
  ) {
    throw new Error(`Invalid stable ID: ${id}`);
  }
}

export class Registry<T> implements ReadonlyRegistry<T> {
  private readonly items = new Map<string, T>();
  private frozen = false;

  constructor(readonly name: string) {}

  get size(): number {
    return this.items.size;
  }

  register(id: string, value: T): this {
    if (this.frozen) {
      throw new Error(`Registry "${this.name}" is frozen`);
    }
    assertStableId(id);
    if (this.items.has(id)) {
      throw new Error(`Duplicate ID "${id}" in registry "${this.name}"`);
    }
    this.items.set(id, value);
    return this;
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  require(id: string): T {
    const value = this.items.get(id);
    if (value === undefined) {
      throw new Error(`Unknown ID "${id}" in registry "${this.name}"`);
    }
    return value;
  }

  ids(): readonly string[] {
    return Object.freeze([...this.items.keys()]);
  }

  values(): readonly T[] {
    return Object.freeze([...this.items.values()]);
  }

  entries(): readonly (readonly [string, T])[] {
    return Object.freeze(
      [...this.items.entries()].map(([id, value]) => Object.freeze([id, value] as const))
    );
  }

  freeze(): ReadonlyRegistry<T> {
    this.frozen = true;
    return this;
  }

  isFrozen(): boolean {
    return this.frozen;
  }
}
