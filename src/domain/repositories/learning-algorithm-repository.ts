import type {
  LearningAlgorithmDefinition,
  NewLearningAlgorithmDefinition,
} from "../entities/index.js";
import type { LearningAlgorithmId } from "../values/index.js";

export interface LearningAlgorithmRepository {
  create(
    definition: NewLearningAlgorithmDefinition,
  ): Promise<LearningAlgorithmDefinition>;
  findById(id: LearningAlgorithmId): Promise<LearningAlgorithmDefinition | null>;
  findByName(name: string): Promise<LearningAlgorithmDefinition | null>;
  update(definition: LearningAlgorithmDefinition): Promise<void>;
}

