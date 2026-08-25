import type { JsonObject } from "../../../domain/index.js";
import type { ContentModule } from "../content-module.js";
import {
  optionalString,
  rejectUnknownProperties,
  requireString,
} from "../validation.js";

export interface AudioData extends JsonObject {
  readonly uri: string;
  readonly accent?: string;
}

export const audioModule: ContentModule<AudioData> = {
  name: "Audio",
  version: "1",
  description: "An audio resource for the LearningItem.",
  cardinality: "multiple",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["uri"],
    properties: {
      uri: { type: "string", minLength: 1 },
      accent: { type: "string", minLength: 1 },
    },
  },
  parse(data) {
    rejectUnknownProperties(data, ["uri", "accent"], this.name);
    const accent = optionalString(data, "accent", this.name);

    return Object.freeze({
      uri: requireString(data, "uri", this.name),
      ...(accent === undefined ? {} : { accent }),
    });
  },
};

