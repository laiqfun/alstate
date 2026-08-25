import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  learningItemContentId,
  learningStateId,
} from "../../src/domain/index.js";
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
  englishMeaningModule,
  toModuleDefinition,
} from "../../src/modules/index.js";

function setup() {
  const database = new SqliteDatabase();
  database.migrate();

  return {
    database,
    items: new SqliteLearningItemRepository(database.connection),
    modules: new SqliteModuleDefinitionRepository(database.connection),
    contents: new SqliteLearningItemContentRepository(database.connection),
    tags: new SqliteTagRepository(database.connection),
    algorithms: new SqliteLearningAlgorithmRepository(database.connection),
    states: new SqliteLearningStateRepository(database.connection),
    reviews: new SqliteReviewRecordRepository(database.connection),
  };
}

test("SQLite migrations are idempotent and enable foreign keys", (context) => {
  const repositories = setup();
  context.after(() => repositories.database.close());

  repositories.database.migrate();
  const migrationCount = repositories.database.connection
    .prepare("SELECT count(*) AS count FROM schema_migrations")
    .get() as { count: number };
  const foreignKeys = repositories.database.connection
    .prepare("PRAGMA foreign_keys")
    .get() as { foreign_keys: number };

  assert.equal(migrationCount.count, 1);
  assert.equal(foreignKeys.foreign_keys, 1);
});

test("LearningItem repository uses ids and preserves exact words", async (context) => {
  const repositories = setup();
  context.after(() => repositories.database.close());

  const first = await repositories.items.create({ word: "bank" });
  const second = await repositories.items.create({ word: "bank" });
  await repositories.items.create({ word: "Bank" });

  assert.notEqual(first.id, second.id);
  assert.equal((await repositories.items.list({ word: "bank" })).length, 2);
  assert.equal((await repositories.items.list({ word: "Bank" })).length, 1);
});

test("content and tag repositories preserve order and associations", async (context) => {
  const repositories = setup();
  context.after(() => repositories.database.close());

  const item = await repositories.items.create({ word: "bank" });
  const definition = await repositories.modules.create(
    toModuleDefinition(englishMeaningModule),
  );
  const later = await repositories.contents.create({
    learningItemId: item.id,
    moduleId: definition.id,
    data: { meaning: "later" },
    orderIndex: 2,
  });
  const earlier = await repositories.contents.create({
    learningItemId: item.id,
    moduleId: definition.id,
    data: { meaning: "earlier" },
    orderIndex: 1,
  });
  const tag = await repositories.tags.create({ name: "CET6" });
  await repositories.tags.attach(item.id, tag.id);

  assert.deepEqual(
    (await repositories.contents.listForItem(item.id)).map((content) => content.id),
    [earlier.id, later.id],
  );
  assert.deepEqual(await repositories.tags.listForItem(item.id), [tag]);

  await repositories.tags.delete(tag.id);
  assert.notEqual(await repositories.items.findById(item.id), null);
  assert.deepEqual(await repositories.tags.listForItem(item.id), []);
});

test("due states and review records round-trip complete FSRS data", async (context) => {
  const repositories = setup();
  context.after(() => repositories.database.close());

  const item = await repositories.items.create({ word: "bank" });
  const fsrs = new FsrsLearningAlgorithm();
  const algorithm = await repositories.algorithms.create({
    name: fsrs.name,
    version: fsrs.version,
    configData: fsrs.configuration,
  });
  const reviewedAt = new Date("2026-08-25T00:00:00.000Z");
  const initial = fsrs.initialize(reviewedAt);
  const state = await repositories.states.create({
    learningItemId: item.id,
    algorithmId: algorithm.id,
    dueAt: initial.dueAt,
    stateData: initial.stateData,
  });

  assert.deepEqual(await repositories.states.findById(state.id), state);
  assert.deepEqual(
    await repositories.states.listDue({
      algorithmId: algorithm.id,
      dueAtOrBefore: reviewedAt,
    }),
    [state],
  );

  const outcome = fsrs.review(initial, "good", reviewedAt);
  const record = await repositories.reviews.append({
    learningItemId: item.id,
    algorithmId: algorithm.id,
    rating: outcome.rating.value,
    reviewData: outcome.reviewData,
    responseTimeMs: 1250,
    reviewedAt,
  });

  assert.deepEqual(await repositories.reviews.list({ learningItemId: item.id }), [
    record,
  ]);
});

test("deleting a LearningItem cascades owned content and learning data", async (context) => {
  const repositories = setup();
  context.after(() => repositories.database.close());

  const item = await repositories.items.create({ word: "bank" });
  const definition = await repositories.modules.create(
    toModuleDefinition(englishMeaningModule),
  );
  const content = await repositories.contents.create({
    learningItemId: item.id,
    moduleId: definition.id,
    data: { meaning: "a financial institution" },
    orderIndex: 0,
  });
  const fsrs = new FsrsLearningAlgorithm();
  const algorithm = await repositories.algorithms.create({
    name: fsrs.name,
    version: fsrs.version,
    configData: fsrs.configuration,
  });
  const initial = fsrs.initialize(new Date("2026-08-25T00:00:00.000Z"));
  const state = await repositories.states.create({
    learningItemId: item.id,
    algorithmId: algorithm.id,
    dueAt: initial.dueAt,
    stateData: initial.stateData,
  });
  await repositories.reviews.append({
    learningItemId: item.id,
    algorithmId: algorithm.id,
    rating: "good",
    reviewData: {},
    reviewedAt: new Date("2026-08-25T00:00:00.000Z"),
  });

  assert.equal(await repositories.items.delete(item.id), true);
  assert.equal(
    await repositories.contents.findById(learningItemContentId(content.id)),
    null,
  );
  assert.equal(await repositories.states.findById(learningStateId(state.id)), null);
  assert.deepEqual(await repositories.reviews.list({ learningItemId: item.id }), []);
});

test("SQLite transaction rolls back repository writes on failure", async (context) => {
  const repositories = setup();
  context.after(() => repositories.database.close());

  await assert.rejects(
    repositories.database.transaction(async () => {
      await repositories.items.create({ word: "temporary" });
      throw new Error("rollback");
    }),
    /rollback/,
  );

  assert.deepEqual(await repositories.items.list(), []);
});

test("file-backed SQLite data survives a database restart", async (context) => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "alstate-sqlite-test-"));
  const databasePath = join(temporaryDirectory, "alstate.db");
  context.after(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  const firstDatabase = new SqliteDatabase(databasePath);
  firstDatabase.migrate();
  const firstItems = new SqliteLearningItemRepository(firstDatabase.connection);
  const created = await firstItems.create({ word: "persistent" });
  firstDatabase.close();

  const secondDatabase = new SqliteDatabase(databasePath);
  secondDatabase.migrate();
  const secondItems = new SqliteLearningItemRepository(secondDatabase.connection);
  assert.deepEqual(await secondItems.findById(created.id), created);
  secondDatabase.close();
});
