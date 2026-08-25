import type { NewTag, Tag } from "../entities/index.js";
import type { LearningItemId, TagId } from "../values/index.js";

export interface TagRepository {
  create(tag: NewTag): Promise<Tag>;
  findById(id: TagId): Promise<Tag | null>;
  findByName(name: string): Promise<Tag | null>;
  list(): Promise<readonly Tag[]>;
  update(tag: Tag): Promise<void>;
  delete(id: TagId): Promise<boolean>;
  attach(learningItemId: LearningItemId, tagId: TagId): Promise<void>;
  detach(learningItemId: LearningItemId, tagId: TagId): Promise<boolean>;
  listForItem(learningItemId: LearningItemId): Promise<readonly Tag[]>;
}

