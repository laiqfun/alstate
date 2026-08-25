import type {
  JsonObject,
  LearningItem,
  LearningItemId,
  LearningItemRepository,
} from "../../../domain/index.js";
import { learningItemId } from "../../../domain/index.js";
import type { ContentModule } from "../content-module.js";
import { ContentModuleError } from "../content-module-error.js";
import { rejectUnknownProperties } from "../validation.js";

export interface RelatedMeaningsData extends JsonObject {
  readonly learningItemIds: readonly LearningItemId[];
}

export const relatedMeaningsModule: ContentModule<RelatedMeaningsData> = {
  name: "RelatedMeanings",
  version: "1",
  description: "Links other LearningItems for meanings of the same word.",
  cardinality: "single",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["learningItemIds"],
    properties: {
      learningItemIds: {
        type: "array",
        uniqueItems: true,
        items: { type: "integer", minimum: 1 },
      },
    },
  },
  parse(data) {
    rejectUnknownProperties(data, ["learningItemIds"], this.name);
    const values = data["learningItemIds"];

    if (!Array.isArray(values)) {
      throw new ContentModuleError(
        "RelatedMeanings.learningItemIds must be an array.",
      );
    }

    const ids = values.map((value) => {
      if (typeof value !== "number") {
        throw new ContentModuleError(
          "RelatedMeanings.learningItemIds must contain only item ids.",
        );
      }

      return learningItemId(value);
    });

    if (new Set(ids).size !== ids.length) {
      throw new ContentModuleError(
        "RelatedMeanings.learningItemIds must not contain duplicates.",
      );
    }

    return Object.freeze({ learningItemIds: Object.freeze(ids) });
  },
};

export async function validateRelatedMeaningTargets(
  owner: LearningItem,
  data: RelatedMeaningsData,
  learningItems: LearningItemRepository,
): Promise<void> {
  for (const targetId of data.learningItemIds) {
    if (targetId === owner.id) {
      throw new ContentModuleError(
        "RelatedMeanings cannot reference its own LearningItem.",
      );
    }

    const target = await learningItems.findById(targetId);

    if (target === null) {
      throw new ContentModuleError(
        `RelatedMeanings target LearningItem '${targetId}' does not exist.`,
      );
    }

    if (target.word !== owner.word) {
      throw new ContentModuleError(
        "RelatedMeanings targets must have the same case-sensitive word.",
      );
    }
  }
}

