import assert from "node:assert/strict";
import test from "node:test";

import {
  ConcurrentReviewError,
  type AlgorithmId,
  type LearningItemId,
  type LearningState,
} from "@alstate/core";

import { SqliteLearningStore } from "../src/index.js";

async function register(store: SqliteLearningStore, name: string) {
  return store.registerAlgorithm({
    name,
    version: "1",
    configuration: {},
  });
}

async function create(
  store: SqliteLearningStore,
  registeredAlgorithmId: AlgorithmId,
) {
  return store.createItem({
    data: { prompt: "question" },
    algorithmId: registeredAlgorithmId,
    dueAt: new Date("2026-08-25T00:00:00.000Z"),
    stateData: { reviews: 0 },
  });
}

function reviewInput(
  state: LearningState,
  itemId: LearningItemId,
  responseTimeMs = 100,
) {
  return {
    state: {
      state,
      dueAt: new Date("2026-08-26T00:00:00.000Z"),
      data: { reviews: 1 },
    },
    review: {
      learningItemId: itemId,
      algorithmId: state.algorithmId,
      rating: "good",
      data: { previousReviews: 0 },
      reviewedAt: new Date("2026-08-25T00:00:00.000Z"),
      responseTimeMs,
    },
  };
}

test("SQLite item operations are scoped to the registered algorithm", async () => {
  const store = new SqliteLearningStore();
  try {
    const first = await register(store, "first");
    const second = await register(store, "second");
    const firstItem = await create(store, first.id);
    const secondItem = await create(store, second.id);

    assert.deepEqual(await store.listItems(first.id), [firstItem]);
    assert.deepEqual(await store.listItems(second.id), [secondItem]);
    assert.equal(await store.findItem(firstItem.id, second.id), null);
    assert.equal(await store.deleteItem(firstItem.id, second.id), false);
  } finally {
    store.close();
  }
});

test("SQLite rolls back the state update when review insertion fails", async () => {
  const store = new SqliteLearningStore();
  try {
    const algorithm = await register(store, "rollback");
    const item = await create(store, algorithm.id);
    const before = await store.findState(item.id, algorithm.id);
    assert.ok(before !== null);

    await assert.rejects(
      store.commitReview(reviewInput(before, item.id, -1)),
      /responseTimeMs/,
    );

    assert.deepEqual(await store.findState(item.id, algorithm.id), before);
    assert.deepEqual(await store.listReviews(item.id, algorithm.id), []);
  } finally {
    store.close();
  }
});

test("SQLite rejects a stale state revision without appending history", async () => {
  const store = new SqliteLearningStore();
  try {
    const algorithm = await register(store, "concurrency");
    const item = await create(store, algorithm.id);
    const stale = await store.findState(item.id, algorithm.id);
    assert.ok(stale !== null);

    await store.commitReview(reviewInput(stale, item.id));
    await assert.rejects(
      store.commitReview(reviewInput(stale, item.id)),
      ConcurrentReviewError,
    );
    assert.equal((await store.listReviews(item.id, algorithm.id)).length, 1);
    assert.equal(
      (await store.findState(item.id, algorithm.id))?.revision,
      stale.revision + 1,
    );
  } finally {
    store.close();
  }
});
