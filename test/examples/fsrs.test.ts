import assert from "node:assert/strict";
import test from "node:test";

import { Rating, createEmptyCard, fsrs } from "ts-fsrs";

import { FsrsAlgorithm } from "../../examples/vocabulary-cli/algorithm/fsrs.js";

test("the example injects its own FSRS implementation", () => {
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
