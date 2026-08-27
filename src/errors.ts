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
