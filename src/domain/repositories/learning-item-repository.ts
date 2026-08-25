import type { LearningItem, NewLearningItem } from "../entities/index.js";
import type { LearningItemId, TagId } from "../values/index.js";

export interface LearningItemQuery {
  readonly word?: string;
  readonly tagId?: TagId;
  readonly limit?: number;
  readonly offset?: number;
}

export interface LearningItemRepository {
  create(item: NewLearningItem): Promise<LearningItem>;
  findById(id: LearningItemId): Promise<LearningItem | null>;
  list(query?: LearningItemQuery): Promise<readonly LearningItem[]>;
  update(item: LearningItem): Promise<void>;
  delete(id: LearningItemId): Promise<boolean>;
}

