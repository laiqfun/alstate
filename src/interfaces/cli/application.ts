import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import {
  BootstrapService,
  ContentService,
  ImportService,
  LearningItemService,
  ReviewService,
  TagService,
} from "../../application/index.js";
import {
  SqliteDatabase,
  SqliteLearningAlgorithmRepository,
  SqliteLearningItemContentRepository,
  SqliteLearningItemRepository,
  SqliteLearningStateRepository,
  SqliteModuleDefinitionRepository,
  SqliteReviewRecordRepository,
  SqliteTagRepository,
} from "../../infrastructure/database/index.js";
import { FsrsLearningAlgorithm } from "../../learning/index.js";
import {
  AppendImportStrategy,
  createDefaultContentModuleRegistry,
} from "../../modules/index.js";

export async function createCliApplication(databasePath: string) {
  if (databasePath !== ":memory:") {
    await mkdir(dirname(databasePath), { recursive: true });
  }

  const database = new SqliteDatabase(databasePath);
  database.migrate();
  const items = new SqliteLearningItemRepository(database.connection);
  const modules = new SqliteModuleDefinitionRepository(database.connection);
  const contents = new SqliteLearningItemContentRepository(database.connection);
  const tags = new SqliteTagRepository(database.connection);
  const algorithms = new SqliteLearningAlgorithmRepository(database.connection);
  const states = new SqliteLearningStateRepository(database.connection);
  const records = new SqliteReviewRecordRepository(database.connection);
  const registry = createDefaultContentModuleRegistry();
  const fsrs = new FsrsLearningAlgorithm();
  const algorithm = await new BootstrapService({
    modules,
    algorithms,
    moduleRegistry: registry,
    fsrs,
    transactions: database,
  }).initialize();
  const contentService = new ContentService({
    items,
    contents,
    definitions: modules,
    registry,
  });

  return {
    database,
    items: new LearningItemService({
      items,
      contents,
      definitions: modules,
      tags,
      states,
      algorithm: fsrs,
      algorithmId: algorithm.id,
      transactions: database,
    }),
    content: contentService,
    tags: new TagService({ items, tags }),
    review: new ReviewService({
      items,
      contents,
      states,
      records,
      algorithm: fsrs,
      algorithmId: algorithm.id,
      transactions: database,
    }),
    importer: new ImportService({
      items,
      contents,
      definitions: modules,
      tags,
      states,
      contentService,
      algorithm: fsrs,
      algorithmId: algorithm.id,
      strategy: new AppendImportStrategy(),
      transactions: database,
    }),
    records,
  };
}

