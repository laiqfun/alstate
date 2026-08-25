import { readFile } from "node:fs/promises";

import type { JsonObject } from "../../domain/index.js";
import { DomainValidationError } from "../../domain/index.js";
import type { ImportCandidate } from "../../modules/index.js";

export async function readJsonImportFile(path: string): Promise<readonly ImportCandidate[]> {
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));

  if (!Array.isArray(parsed)) {
    throw new DomainValidationError("Import file must contain a JSON array.");
  }

  return Object.freeze(parsed.map(parseCandidate));
}

function parseCandidate(value: unknown, index: number): ImportCandidate {
  const record = requireObject(value, `record ${index}`);
  const word = record["word"];
  const contents = record["contents"];

  if (typeof word !== "string" || !Array.isArray(contents)) {
    throw new DomainValidationError(
      `Import record ${index} requires word and contents.`,
    );
  }

  return {
    word,
    contents: contents.map((content, contentIndex) => {
      const entry = requireObject(content, `record ${index} content ${contentIndex}`);
      const moduleName = entry["moduleName"];
      const data = entry["data"];
      const orderIndex = entry["orderIndex"];

      if (
        typeof moduleName !== "string" ||
        typeof orderIndex !== "number" ||
        data === null ||
        Array.isArray(data) ||
        typeof data !== "object"
      ) {
        throw new DomainValidationError(
          `Import record ${index} content ${contentIndex} is invalid.`,
        );
      }

      return { moduleName, data: data as JsonObject, orderIndex };
    }),
    ...(Array.isArray(record["tags"])
      ? { tags: record["tags"].map(String) }
      : {}),
    ...(typeof record["sourceReference"] === "string"
      ? { sourceReference: record["sourceReference"] }
      : {}),
  };
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new DomainValidationError(`Import ${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

