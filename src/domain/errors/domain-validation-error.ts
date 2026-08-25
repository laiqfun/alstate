export class DomainValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "DomainValidationError";
  }
}

