import assert from "node:assert/strict";
import test from "node:test";

import {
  BootstrapService,
  ConflictError,
  ContentService,
  ImportService,
  LearningItemService,
  ReviewService,
} from "../../src/application/index.js";
import {
  SqliteDatabase,
  SqliteLearningAlgorithmRepository,
  SqliteLearningItemContentRepository,
  SqliteLearningItemRepository,
  SqliteLearningStateRepository,
  SqliteModuleDefinitionRepository,
  SqliteReviewRecordRepository,
  SqliteTagRepository,
} from "../../src/infrastructure/database/index.js";
import { FsrsLearningAlgorithm } from "../../src/learning/index.js";
import {
  AppendImportStrategy,
  ContentModuleError,
  createDefaultContentModuleRegistry,
} from "../../src/modules/index.js";

async function setup() {
  const database = new SqliteDatabase();
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
  const bootstrap = new BootstrapService({
    modules,
    algorithms,
    moduleRegistry: registry,
    fsrs,
    transactions: database,
  });
  const algorithmDefinition = await bootstrap.initialize();
  const contentService = new ContentService({
    items,
    contents,
    definitions: modules,
    registry,
  });
  const itemService = new LearningItemService({
    items,
    contents,
    definitions: modules,
    tags,
    states,
    algorithm: fsrs,
    algorithmId: algorithmDefinition.id,
    transactions: database,
  });
  const reviewService = new ReviewService({
    items,
    contents,
    states,
    records,
    algorithm: fsrs,
    algorithmId: algorithmDefinition.id,
    transactions: database,
  });
  const importService = new ImportService({
    items,
    contents,
    definitions: modules,
    tags,
    states,
    contentService,
    algorithm: fsrs,
    algorithmId: algorithmDefinition.id,
    strategy: new AppendImportStrategy(),
    transactions: database,
  });

  return {
    database,
    items,
    modules,
    contents,
    tags,
    algorithms,
    states,
    records,
    bootstrap,
    contentService,
    itemService,
    reviewService,
    importService,
    algorithmDefinition,
  };
}

test("bootstrap registers modules and FSRS idempotently", async (context) => {
  const application = await setup();
  context.after(() => application.database.close());

  const secondAlgorithm = await application.bootstrap.initialize();

  assert.equal((await application.modules.list()).length, 6);
  assert.equal(secondAlgorithm.id, application.algorithmDefinition.id);
  assert.equal((await application.algorithms.findByName("FSRS"))?.id, secondAlgorithm.id);
});

test("creating an item initializes an independent learning state", async (context) => {
  const application = await setup();
  context.after(() => application.database.close());
  const createdAt = new Date("2026-08-25T00:00:00.000Z");

  const first = await application.itemService.create("bank", createdAt);
  const second = await application.itemService.create("bank", createdAt);

  assert.notEqual(first.id, second.id);
  assert.notEqual(
    await application.states.findForItem(first.id, application.algorithmDefinition.id),
    null,
  );
  assert.notEqual(
    await application.states.findForItem(second.id, application.algorithmDefinition.id),
    null,
  );
});

test("content service enforces cardinality and related-word rules", async (context) => {
  const application = await setup();
  context.after(() => application.database.close());
  const first = await application.itemService.create("bank");
  const second = await application.itemService.create("bank");
  const differentCase = await application.itemService.create("Bank");

  await application.contentService.add({
    learningItemId: first.id,
    moduleName: "EnglishMeaning",
    data: { meaning: "a financial institution" },
    orderIndex: 0,
  });
  await assert.rejects(
    application.contentService.add({
      learningItemId: first.id,
      moduleName: "EnglishMeaning",
      data: { meaning: "another meaning" },
      orderIndex: 1,
    }),
    ConflictError,
  );

  await application.contentService.add({
    learningItemId: first.id,
    moduleName: "RelatedMeanings",
    data: { learningItemIds: [second.id] },
    orderIndex: 1,
  });
  await assert.rejects(
    application.contentService.update({
      id: (await application.contentService.list(first.id))[1]!.id,
      data: { learningItemIds: [differentCase.id] },
    }),
    ContentModuleError,
  );
});

test("deleting an item removes sibling RelatedMeanings references", async (context) => {
  const application = await setup();
  context.after(() => application.database.close());
  const first = await application.itemService.create("bank");
  const second = await application.itemService.create("bank");

  await application.contentService.add({
    learningItemId: first.id,
    moduleName: "RelatedMeanings",
    data: { learningItemIds: [second.id] },
    orderIndex: 0,
  });
  await application.itemService.delete(second.id);

  assert.deepEqual(await application.contentService.list(first.id), []);
  assert.equal(await application.items.findById(second.id), null);
});

test("review service atomically updates FSRS state and appends history", async (context) => {
  const application = await setup();
  context.after(() => application.database.close());
  const reviewedAt = new Date("2026-08-25T00:00:00.000Z");
  const item = await application.itemService.create("bank", reviewedAt);

  const due = await application.reviewService.listDue(reviewedAt);
  assert.equal(due.length, 1);
  assert.deepEqual(
    due[0]?.preview.map((option) => option.rating.value),
    ["again", "hard", "good", "easy"],
  );

  const completed = await application.reviewService.review({
    learningItemId: item.id,
    rating: "good",
    reviewedAt,
    responseTimeMs: 750,
  });
  const storedState = await application.states.findForItem(
    item.id,
    application.algorithmDefinition.id,
  );

  assert.equal(storedState?.dueAt.toISOString(), completed.outcome.state.dueAt.toISOString());
  assert.equal(
    (await application.records.list({ learningItemId: item.id })).length,
    1,
  );
});

test("append import creates every record and rolls back invalid records", async (context) => {
  const application = await setup();
  context.after(() => application.database.close());
  const importedAt = new Date("2026-08-25T00:00:00.000Z");

  const results = await application.importService.import(
    [
      {
        word: "bank",
        contents: [
          {
            moduleName: "EnglishMeaning",
            data: { meaning: "a financial institution" },
            orderIndex: 0,
          },
        ],
        tags: ["CET6"],
      },
      {
        word: "bank",
        contents: [
          {
            moduleName: "EnglishMeaning",
            data: { meaning: "the side of a river" },
            orderIndex: 0,
          },
        ],
      },
    ],
    importedAt,
  );

  assert.deepEqual(results.map((result) => result.action), ["append", "append"]);
  assert.equal((await application.items.list({ word: "bank" })).length, 2);

  await assert.rejects(
    application.importService.import([
      {
        word: "invalid",
        contents: [
          { moduleName: "MissingModule", data: {}, orderIndex: 0 },
        ],
      },
    ]),
    ContentModuleError,
  );
  assert.deepEqual(await application.items.list({ word: "invalid" }), []);
});

