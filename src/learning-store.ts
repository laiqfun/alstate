import type {
  AlgorithmId,
  JsonObject,
  LearningItem,
  LearningItemId,
  LearningState,
  PageQuery,
  ReviewRecord,
} from "./types.js";

export interface AlgorithmRegistration {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly configuration: JsonObject;
}

export interface RegisteredAlgorithm extends AlgorithmRegistration {
  readonly id: AlgorithmId;
}

export interface NewItemWithState {
  readonly data: JsonObject;
  readonly algorithmId: AlgorithmId;
  readonly dueAt: Date;
  readonly stateData: JsonObject;
}

export interface DueStoredItem {
  readonly item: LearningItem;
  readonly state: LearningState;
}

export interface StateUpdate {
  readonly state: LearningState;
  readonly dueAt: Date;
  readonly data: JsonObject;
}

export interface NewReviewRecord {
  readonly learningItemId: LearningItemId;
  readonly algorithmId: AlgorithmId;
  readonly rating: string;
  readonly data: JsonObject;
  readonly reviewedAt: Date;
  readonly responseTimeMs?: number;
}

export interface LearningStore {
  registerAlgorithm(
    registration: AlgorithmRegistration,
  ): Promise<RegisteredAlgorithm>;
  createItem(input: NewItemWithState): Promise<LearningItem>;
  findItem(id: LearningItemId): Promise<LearningItem | null>;
  listItems(query?: PageQuery): Promise<readonly LearningItem[]>;
  updateItem(id: LearningItemId, data: JsonObject): Promise<LearningItem | null>;
  deleteItem(id: LearningItemId): Promise<boolean>;
  findState(
    itemId: LearningItemId,
    algorithmId: AlgorithmId,
  ): Promise<LearningState | null>;
  listDue(input: {
    readonly algorithmId: AlgorithmId;
    readonly dueAtOrBefore: Date;
    readonly limit?: number;
  }): Promise<readonly DueStoredItem[]>;
  commitReview(input: {
    readonly state: StateUpdate;
    readonly review: NewReviewRecord;
  }): Promise<ReviewRecord>;
  listReviews(
    itemId: LearningItemId,
    query?: PageQuery,
  ): Promise<readonly ReviewRecord[]>;
  close(): void;
}
