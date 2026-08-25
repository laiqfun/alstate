import type { JsonObject } from "../../../domain/index.js";
import type { ContentModule } from "../content-module.js";
import { rejectUnknownProperties, requireString } from "../validation.js";

export interface MemoryNoteData extends JsonObject {
  readonly note: string;
}

export const memoryNoteModule: ContentModule<MemoryNoteData> = {
  name: "MemoryNote",
  version: "1",
  description: "A memory aid for the LearningItem.",
  cardinality: "multiple",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["note"],
    properties: { note: { type: "string", minLength: 1 } },
  },
  parse(data) {
    rejectUnknownProperties(data, ["note"], this.name);
    return Object.freeze({ note: requireString(data, "note", this.name) });
  },
};

