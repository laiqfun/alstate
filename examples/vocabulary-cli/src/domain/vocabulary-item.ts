import type { JsonObject, JsonValue } from "@alstate/core";

export interface VocabularyExample extends JsonObject {
  readonly sentence: string;
  readonly translation?: string;
}

export interface VocabularyAudio extends JsonObject {
  readonly uri: string;
  readonly accent?: string;
}

export interface VocabularyItemData extends JsonObject {
  readonly word: string;
  readonly englishMeanings: readonly string[];
  readonly chineseMeanings: readonly string[];
  readonly examples: readonly VocabularyExample[];
  readonly audio: readonly VocabularyAudio[];
  readonly notes: readonly string[];
  readonly tags: readonly string[];
}

export function createVocabularyItem(word: string): VocabularyItemData {
  return freezeVocabulary({
    word: nonBlank(word, "word"),
    englishMeanings: [],
    chineseMeanings: [],
    examples: [],
    audio: [],
    notes: [],
    tags: [],
  });
}

export function parseVocabularyItem(data: JsonObject): VocabularyItemData {
  return freezeVocabulary({
    word: nonBlank(data["word"], "word"),
    englishMeanings: stringArray(data["englishMeanings"], "englishMeanings"),
    chineseMeanings: stringArray(data["chineseMeanings"], "chineseMeanings"),
    examples: objectArray(data["examples"], "examples").map(parseExample),
    audio: objectArray(data["audio"], "audio").map(parseAudio),
    notes: stringArray(data["notes"], "notes"),
    tags: stringArray(data["tags"], "tags"),
  });
}

function parseExample(value: JsonObject): VocabularyExample {
  const translation = value["translation"];
  return Object.freeze({
    sentence: nonBlank(value["sentence"], "example sentence"),
    ...(translation === undefined
      ? {}
      : { translation: nonBlank(translation, "example translation") }),
  });
}

function parseAudio(value: JsonObject): VocabularyAudio {
  const accent = value["accent"];
  return Object.freeze({
    uri: nonBlank(value["uri"], "audio uri"),
    ...(accent === undefined ? {} : { accent: nonBlank(accent, "audio accent") }),
  });
}

function freezeVocabulary(data: VocabularyItemData): VocabularyItemData {
  return Object.freeze({
    ...data,
    englishMeanings: Object.freeze([...data.englishMeanings]),
    chineseMeanings: Object.freeze([...data.chineseMeanings]),
    examples: Object.freeze(data.examples.map((entry) => Object.freeze({ ...entry }))),
    audio: Object.freeze(data.audio.map((entry) => Object.freeze({ ...entry }))),
    notes: Object.freeze([...data.notes]),
    tags: Object.freeze([...data.tags]),
  });
}

function stringArray(value: JsonValue | undefined, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${field} must be an array of strings.`);
  }
  return value.map((entry) => nonBlank(entry, field));
}

function objectArray(value: JsonValue | undefined, field: string): JsonObject[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${field} must be an array.`);
  return value.map((entry) => {
    if (entry === null || Array.isArray(entry) || typeof entry !== "object") {
      throw new Error(`${field} must contain objects.`);
    }
    return entry;
  });
}

function nonBlank(value: JsonValue | undefined, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-blank string.`);
  }
  return value;
}
