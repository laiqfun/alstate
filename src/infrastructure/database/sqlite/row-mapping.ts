import type { SQLOutputValue } from "node:sqlite";

import { DomainValidationError, type JsonObject } from "../../../domain/index.js";

export type SqliteRow = Record<string, SQLOutputValue>;

export function requireNumber(row: SqliteRow, column: string): number {
  const value = row[column];

  if (typeof value !== "number") {
    throw new DomainValidationError(`Database column '${column}' must be a number.`);
  }

  return value;
}

export function requireString(row: SqliteRow, column: string): string {
  const value = row[column];

  if (typeof value !== "string") {
    throw new DomainValidationError(`Database column '${column}' must be a string.`);
  }

  return value;
}

export function optionalString(
  row: SqliteRow,
  column: string,
): string | undefined {
  const value = row[column];

  if (value === null) {
    return undefined;
  }

  return requireString(row, column);
}

export function parseJsonObject(row: SqliteRow, column: string): JsonObject {
  const parsed: unknown = JSON.parse(requireString(row, column));

  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new DomainValidationError(
      `Database column '${column}' must contain a JSON object.`,
    );
  }

  return parsed as JsonObject;
}

export function toNumber(value: number | bigint): number {
  const number = typeof value === "bigint" ? Number(value) : value;

  if (!Number.isSafeInteger(number)) {
    throw new DomainValidationError("SQLite returned an unsafe integer id.");
  }

  return number;
}

