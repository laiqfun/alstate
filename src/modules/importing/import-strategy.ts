import type {
  JsonObject,
  LearningItem,
  LearningItemContent,
  LearningItemId,
} from "../../domain/index.js";

export interface ImportContentCandidate {
  readonly moduleName: string;
  readonly data: JsonObject;
  readonly orderIndex: number;
}

export interface ImportCandidate {
  readonly word: string;
  readonly contents: readonly ImportContentCandidate[];
  readonly tags?: readonly string[];
  readonly sourceReference?: string;
}

export interface ImportLookup {
  findItemsByWord(word: string): Promise<readonly LearningItem[]>;
  listContent(
    learningItemId: LearningItemId,
  ): Promise<readonly LearningItemContent[]>;
}

export type ImportResolution =
  | { readonly action: "append" }
  | { readonly action: "skip"; readonly warning?: string }
  | {
      readonly action: "merge" | "overwrite";
      readonly targetLearningItemId: LearningItemId;
      readonly warning?: string;
    };

export interface ImportStrategy {
  readonly name: string;

  resolve(
    candidate: ImportCandidate,
    lookup: ImportLookup,
  ): Promise<ImportResolution>;
}

