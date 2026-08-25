import type {
  LearningItemContent,
  NewLearningItemContent,
} from "../entities/index.js";
import type {
  LearningItemContentId,
  LearningItemId,
  ModuleDefinitionId,
} from "../values/index.js";

export interface LearningItemContentRepository {
  create(content: NewLearningItemContent): Promise<LearningItemContent>;
  findById(id: LearningItemContentId): Promise<LearningItemContent | null>;
  listForItem(
    learningItemId: LearningItemId,
    moduleId?: ModuleDefinitionId,
  ): Promise<readonly LearningItemContent[]>;
  update(content: LearningItemContent): Promise<void>;
  delete(id: LearningItemContentId): Promise<boolean>;
}

