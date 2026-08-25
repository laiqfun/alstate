import type { JsonObject } from "../../domain/index.js";
import { ContentModuleError } from "./content-module-error.js";

export function requireString(
  data: JsonObject,
  property: string,
  moduleName: string,
): string {
  const value = data[property];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ContentModuleError(
      `${moduleName}.${property} must be a non-blank string.`,
    );
  }

  return value;
}

export function optionalString(
  data: JsonObject,
  property: string,
  moduleName: string,
): string | undefined {
  const value = data[property];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ContentModuleError(
      `${moduleName}.${property} must be a non-blank string when provided.`,
    );
  }

  return value;
}

export function rejectUnknownProperties(
  data: JsonObject,
  allowed: readonly string[],
  moduleName: string,
): void {
  const allowedProperties = new Set(allowed);
  const unknown = Object.keys(data).find((key) => !allowedProperties.has(key));

  if (unknown !== undefined) {
    throw new ContentModuleError(`${moduleName}.${unknown} is not supported.`);
  }
}

