import type {
  JsonObject,
  LearningItemContentId,
  LearningItemId,
  ModuleDefinitionId,
} from "../values/index.js";
import { requireNonNegativeInteger } from "./validation.js";

export interface LearningItemContent {
  readonly id: LearningItemContentId;
  readonly learningItemId: LearningItemId;
  readonly moduleId: ModuleDefinitionId;
  readonly data: JsonObject;
  readonly orderIndex: number;
}

export interface NewLearningItemContent {
  readonly learningItemId: LearningItemId;
  readonly moduleId: ModuleDefinitionId;
  readonly data: JsonObject;
  readonly orderIndex: number;
}

export function defineLearningItemContent(
  content: LearningItemContent,
): LearningItemContent {
  requireNonNegativeInteger(content.orderIndex, "LearningItemContent.orderIndex");
  return Object.freeze({ ...content });
}

