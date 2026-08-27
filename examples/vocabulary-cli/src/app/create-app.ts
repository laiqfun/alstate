import { LearningEngine } from "@alstate/core";
import { FsrsAlgorithm } from "@alstate/fsrs";
import { SqliteLearningStore } from "@alstate/sqlite";

export async function createVocabularyApp(databasePath: string) {
  return LearningEngine.create({
    store: new SqliteLearningStore(databasePath),
    algorithm: new FsrsAlgorithm(),
  });
}
