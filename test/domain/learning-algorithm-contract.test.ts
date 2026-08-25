import assert from "node:assert/strict";
import test from "node:test";

import type {
  AlgorithmStateSnapshot,
  LearningAlgorithm,
} from "../../src/domain/index.js";

const again = Object.freeze({ value: "again", label: "Again" });
const good = Object.freeze({ value: "good", label: "Good" });

const algorithm: LearningAlgorithm = {
  name: "contract-test",
  version: "1",
  ratings: [again, good],
  initialize(at) {
    return { dueAt: new Date(at), stateData: { reviews: 0 } };
  },
  preview(_state, reviewedAt) {
    return [
      { rating: again, dueAt: new Date(reviewedAt) },
      {
        rating: good,
        dueAt: new Date(reviewedAt.getTime() + 86_400_000),
      },
    ];
  },
  review(_state, rating, reviewedAt) {
    const selectedRating = rating === good.value ? good : again;
    return {
      rating: selectedRating,
      state: {
        dueAt: new Date(reviewedAt),
        stateData: { reviews: 1 },
      },
      reviewData: { rating: selectedRating.value },
    };
  },
  retrievability(_state, _at) {
    return null;
  },
};

test("LearningAlgorithm contract supports initialization and review", () => {
  const reviewedAt = new Date("2026-08-25T00:00:00.000Z");
  const initial: AlgorithmStateSnapshot = algorithm.initialize(reviewedAt);
  const result = algorithm.review(initial, "good", reviewedAt);

  assert.equal(result.rating.value, "good");
  assert.deepEqual(result.state.stateData, { reviews: 1 });
  assert.deepEqual(result.reviewData, { rating: "good" });
});

