export interface FixedStepFrameResult {
  readonly steps: number;
  readonly droppedSeconds: number;
  readonly interpolationAlpha: number;
}

export class FixedStepClock {
  private accumulator = 0;
  private totalDropped = 0;

  constructor(
    readonly stepSeconds: number,
    readonly maximumStepsPerFrame: number,
    readonly maximumFrameDelta: number
  ) {
    if (!(stepSeconds > 0)) throw new Error('FixedStepClock stepSeconds must be positive');
    if (!Number.isInteger(maximumStepsPerFrame) || maximumStepsPerFrame <= 0) {
      throw new Error('FixedStepClock maximumStepsPerFrame must be a positive integer');
    }
    if (!Number.isFinite(maximumFrameDelta) || maximumFrameDelta < stepSeconds) {
      throw new Error('FixedStepClock maximumFrameDelta must cover at least one step');
    }
  }

  advance(frameDelta: number, update: (dt: number) => boolean | void): FixedStepFrameResult {
    const safeDelta = Number.isFinite(frameDelta) ? Math.max(0, frameDelta) : 0;
    const acceptedDelta = Math.min(safeDelta, this.maximumFrameDelta);
    let droppedSeconds = safeDelta - acceptedDelta;
    this.accumulator += acceptedDelta;

    let steps = 0;
    while (this.accumulator + Number.EPSILON >= this.stepSeconds && steps < this.maximumStepsPerFrame) {
      const shouldContinue = update(this.stepSeconds);
      this.accumulator = Math.max(0, this.accumulator - this.stepSeconds);
      steps++;
      if (shouldContinue === false) {
        this.accumulator = 0;
        break;
      }
    }

    if (this.accumulator + Number.EPSILON >= this.stepSeconds) {
      const droppedSteps = Math.floor((this.accumulator + Number.EPSILON) / this.stepSeconds);
      const overflow = droppedSteps * this.stepSeconds;
      this.accumulator = Math.max(0, this.accumulator - overflow);
      droppedSeconds += overflow;
    }

    this.totalDropped += droppedSeconds;
    return {
      steps,
      droppedSeconds,
      interpolationAlpha: this.accumulator / this.stepSeconds,
    };
  }

  discardPendingTime(): void {
    this.accumulator = 0;
  }

  reset(): void {
    this.accumulator = 0;
    this.totalDropped = 0;
  }

  get totalDroppedSeconds(): number {
    return this.totalDropped;
  }
}
