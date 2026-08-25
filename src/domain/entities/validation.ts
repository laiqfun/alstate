import { DomainValidationError } from "../errors/index.js";

export function requireNonBlank(value: string, field: string): string {
  if (value.trim().length === 0) {
    throw new DomainValidationError(`${field} must not be blank.`);
  }

  return value;
}

export function requireNonNegativeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainValidationError(`${field} must be a non-negative safe integer.`);
  }

  return value;
}

export function requireNonNegativeNumber(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new DomainValidationError(`${field} must be a non-negative finite number.`);
  }

  return value;
}

export function requireValidDate(value: Date, field: string): Date {
  if (Number.isNaN(value.getTime())) {
    throw new DomainValidationError(`${field} must be a valid date.`);
  }

  return new Date(value);
}

