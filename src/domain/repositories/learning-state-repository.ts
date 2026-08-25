import type { LearningState, NewLearningState } from "../entities/index.js";
import type {
  LearningAlgorithmId,
  LearningItemId,
  LearningStateId,
} from "../values/index.js";

export interface DueLearningStateQuery {
  readonly algorithmId: LearningAlgorithmId;
  readonly dueAtOrBefore: Date;
  readonly limit?: number;
}

export interface LearningStateRepository {
  create(state: NewLearningState): Promise<LearningState>;
  findById(id: LearningStateId): Promise<LearningState | null>;
  findForItem(
    learningItemId: LearningItemId,
    algorithmId: LearningAlgorithmId,
  ): Promise<LearningState | null>;
  listDue(query: DueLearningStateQuery): Promise<readonly LearningState[]>;
  update(state: LearningState): Promise<void>;
  delete(id: LearningStateId): Promise<boolean>;
}

