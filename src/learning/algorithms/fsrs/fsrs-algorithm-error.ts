import { DomainValidationError } from "../../../domain/index.js";

export class FsrsAlgorithmError extends DomainValidationError {
  public constructor(message: string) {
    super(message);
    this.name = "FsrsAlgorithmError";
  }
}

