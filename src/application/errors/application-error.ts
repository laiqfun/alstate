export class ApplicationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ApplicationError";
  }
}

export class NotFoundError extends ApplicationError {
  public constructor(entity: string, identity: string | number) {
    super(`${entity} '${identity}' was not found.`);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApplicationError {
  public constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

