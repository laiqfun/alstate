import type { LearningItemId } from "../values/index.js";
import { requireNonBlank } from "./validation.js";

export interface LearningItem {
  readonly id: LearningItemId;
  readonly word: string;
}

export interface NewLearningItem {
  readonly word: string;
}

export function defineLearningItem(item: LearningItem): LearningItem {
  return Object.freeze({
    id: item.id,
    word: requireNonBlank(item.word, "LearningItem.word"),
  });
}

export function defineNewLearningItem(item: NewLearningItem): NewLearningItem {
  return Object.freeze({
    word: requireNonBlank(item.word, "NewLearningItem.word"),
  });
}

