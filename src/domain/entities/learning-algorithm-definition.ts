import type { JsonObject, LearningAlgorithmId } from "../values/index.js";
import { requireNonBlank } from "./validation.js";

export interface LearningAlgorithmDefinition {
  readonly id: LearningAlgorithmId;
  readonly name: string;
  readonly description?: string;
  readonly version: string;
  readonly configData: JsonObject;
}

export interface NewLearningAlgorithmDefinition {
  readonly name: string;
  readonly description?: string;
  readonly version: string;
  readonly configData: JsonObject;
}

export function defineLearningAlgorithmDefinition(
  definition: LearningAlgorithmDefinition,
): LearningAlgorithmDefinition {
  requireNonBlank(definition.name, "LearningAlgorithmDefinition.name");
  requireNonBlank(definition.version, "LearningAlgorithmDefinition.version");
  return Object.freeze({ ...definition });
}

