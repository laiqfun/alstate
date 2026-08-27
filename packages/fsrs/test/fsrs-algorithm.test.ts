import assert from "node:assert/strict";
import test from "node:test";

import { Rating, createEmptyCard, fsrs } from "ts-fsrs";

import { FsrsAlgorithm } from "../src/index.js";

test("the first-party adapter delegates scheduling to ts-fsrs", () => {
  const at = new Date("2026-08-25T00:00:00.000Z");
  const algorithm = new FsrsAlgorithm();
  const initial = algorithm.initialize(at);
  const actual = algorithm.review(initial, "good", at);
  const expected = fsrs().next(createEmptyCard(at), at, Rating.Good);

  assert.equal(actual.state.dueAt.toISOString(), expected.card.due.toISOString());
  assert.equal(actual.state.data.stability, expected.card.stability);
  assert.deepEqual(
    algorithm.ratings.map((rating) => rating.value),
    ["again", "hard", "good", "easy"],
  );
});

test("FSRS state survives the JSON persistence boundary", () => {
  const algorithm = new FsrsAlgorithm({ requestRetention: 0.87 });
  const initial = algorithm.initialize(new Date("2026-08-25T00:00:00.000Z"));
  const persisted = JSON.parse(JSON.stringify(initial.data)) as typeof initial.data;

  assert.deepEqual(algorithm.parse(persisted), initial.data);
  assert.equal(algorithm.configuration.request_retention, 0.87);
  assert.equal(algorithm.preview(initial, new Date()).length, 4);
});

test("FSRS adapter rejects malformed persisted state", () => {
  const algorithm = new FsrsAlgorithm();
  assert.throws(() => algorithm.parse({ state: 99 }), /FSRS state/);
});
