import type {
  JsonObject,
  LearningAlgorithmId,
  LearningItemId,
  LearningStateId,
} from "../values/index.js";
import { requireValidDate } from "./validation.js";

export interface LearningState {
  readonly id: LearningStateId;
  readonly learningItemId: LearningItemId;
  readonly algorithmId: LearningAlgorithmId;
  readonly dueAt: Date;
  readonly stateData: JsonObject;
}

export interface NewLearningState {
  readonly learningItemId: LearningItemId;
  readonly algorithmId: LearningAlgorithmId;
  readonly dueAt: Date;
  readonly stateData: JsonObject;
}

export function defineLearningState(state: LearningState): LearningState {
  return Object.freeze({
    ...state,
    dueAt: requireValidDate(state.dueAt, "LearningState.dueAt"),
  });
}

