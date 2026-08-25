import type { JsonObject } from "../../../domain/index.js";
import type { ContentModule } from "../content-module.js";
import { rejectUnknownProperties, requireString } from "../validation.js";

export interface ChineseMeaningData extends JsonObject {
  readonly meaning: string;
}

export const chineseMeaningModule: ContentModule<ChineseMeaningData> = {
  name: "ChineseMeaning",
  version: "1",
  description: "A Chinese translation for the LearningItem meaning.",
  cardinality: "multiple",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["meaning"],
    properties: { meaning: { type: "string", minLength: 1 } },
  },
  parse(data) {
    rejectUnknownProperties(data, ["meaning"], this.name);
    return Object.freeze({ meaning: requireString(data, "meaning", this.name) });
  },
};

