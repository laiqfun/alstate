import {
  LearningEngine,
  SqliteLearningStore,
} from "../../../src/index.js";
import { FsrsAlgorithm } from "../algorithm/fsrs.js";

export async function createVocabularyApp(databasePath: string) {
  return LearningEngine.create({
    store: new SqliteLearningStore(databasePath),
    algorithm: new FsrsAlgorithm(),
  });
}
