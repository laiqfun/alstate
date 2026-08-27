import { readFile } from "node:fs/promises";

import {
  createVocabularyItem,
  type VocabularyItemData,
} from "../domain/vocabulary-item.js";

export async function readVocabularyImport(
  path: string,
): Promise<readonly VocabularyItemData[]> {
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("Import file must contain an array.");
  }
  return Object.freeze(parsed.map(parseEntry));
}

function parseEntry(value: unknown, index: number): VocabularyItemData {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`Import record ${index} must be an object.`);
  }
  const record = value as Record<string, unknown>;
  if (typeof record["word"] !== "string") {
    throw new Error(`Import record ${index} requires a word.`);
  }
  const base = createVocabularyItem(record["word"]);
  return Object.freeze({
    ...base,
    englishMeanings: strings(record["englishMeanings"], "englishMeanings"),
    chineseMeanings: strings(record["chineseMeanings"], "chineseMeanings"),
    notes: strings(record["notes"], "notes"),
    tags: strings(record["tags"], "tags"),
  });
}

function strings(value: unknown, field: string): readonly string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${field} must be an array of strings.`);
  }
  return Object.freeze([...value]);
}
