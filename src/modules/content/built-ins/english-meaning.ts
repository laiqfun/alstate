import type { JsonObject } from "../../../domain/index.js";
import type { ContentModule } from "../content-module.js";
import { rejectUnknownProperties, requireString } from "../validation.js";

export interface EnglishMeaningData extends JsonObject {
  readonly meaning: string;
}

export const englishMeaningModule: ContentModule<EnglishMeaningData> = {
  name: "EnglishMeaning",
  version: "1",
  description: "The English meaning represented by the LearningItem.",
  cardinality: "single",
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

