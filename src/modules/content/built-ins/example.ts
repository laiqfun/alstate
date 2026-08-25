import type { JsonObject } from "../../../domain/index.js";
import type { ContentModule } from "../content-module.js";
import {
  optionalString,
  rejectUnknownProperties,
  requireString,
} from "../validation.js";

export interface ExampleData extends JsonObject {
  readonly sentence: string;
  readonly translation?: string;
  readonly source?: string;
}

export const exampleModule: ContentModule<ExampleData> = {
  name: "Example",
  version: "1",
  description: "An example sentence for the LearningItem meaning.",
  cardinality: "multiple",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["sentence"],
    properties: {
      sentence: { type: "string", minLength: 1 },
      translation: { type: "string", minLength: 1 },
      source: { type: "string", minLength: 1 },
    },
  },
  parse(data) {
    rejectUnknownProperties(
      data,
      ["sentence", "translation", "source"],
      this.name,
    );
    const translation = optionalString(data, "translation", this.name);
    const source = optionalString(data, "source", this.name);

    return Object.freeze({
      sentence: requireString(data, "sentence", this.name),
      ...(translation === undefined ? {} : { translation }),
      ...(source === undefined ? {} : { source }),
    });
  },
};

