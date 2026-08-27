export class LearningEngineError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "LearningEngineError";
  }
}

export class ItemNotFoundError extends LearningEngineError {
  public constructor(id: number) {
    super(`Learning item '${id}' was not found.`);
    this.name = "ItemNotFoundError";
  }
}

export class AlgorithmMismatchError extends LearningEngineError {
  public constructor(name: string) {
    super(
      `Algorithm '${name}' is already registered with another version or configuration.`,
    );
    this.name = "AlgorithmMismatchError";
  }
}

export class AlgorithmContractError extends LearningEngineError {
  public constructor(message: string) {
    super(`Learning algorithm contract violation: ${message}`);
    this.name = "AlgorithmContractError";
  }
}

export class UnsupportedRatingError extends LearningEngineError {
  public constructor(rating: string) {
    super(`Rating '${rating}' is not supported by the active algorithm.`);
    this.name = "UnsupportedRatingError";
  }
}

export class ConcurrentReviewError extends LearningEngineError {
  public constructor(id: number) {
    super(`Learning item '${id}' was reviewed concurrently; retry with fresh state.`);
    this.name = "ConcurrentReviewError";
  }
}
