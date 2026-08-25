import { DomainValidationError } from "../../domain/index.js";

export class ContentModuleError extends DomainValidationError {
  public constructor(message: string) {
    super(message);
    this.name = "ContentModuleError";
  }
}

