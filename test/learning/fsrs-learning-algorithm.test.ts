import assert from "node:assert/strict";
import test from "node:test";

import { Rating, createEmptyCard, fsrs } from "ts-fsrs";

import {
  FsrsAlgorithmError,
  FsrsLearningAlgorithm,
  parseFsrsStateData,
} from "../../src/learning/index.js";

test("FSRS adapter exposes all four ratings and complete defaults", () => {
  const algorithm = new FsrsLearningAlgorithm();

  assert.deepEqual(
    algorithm.ratings.map((rating) => rating.value),
    ["again", "hard", "good", "easy"],
  );
  assert.match(algorithm.version, /FSRS-/);
  assert.equal(algorithm.configuration.request_retention, 0.9);
  assert.equal(algorithm.configuration.w.length, 21);
});

test("FSRS adapter matches the official scheduler for a review", () => {
  const reviewedAt = new Date("2026-08-25T00:00:00.000Z");
  const algorithm = new FsrsLearningAlgorithm();
  const initial = algorithm.initialize(reviewedAt);
  const actual = algorithm.review(initial, "good", reviewedAt);
  const expected = fsrs().next(createEmptyCard(reviewedAt), reviewedAt, Rating.Good);

  assert.equal(actual.state.dueAt.toISOString(), expected.card.due.toISOString());
  assert.equal(actual.state.stateData.stability, expected.card.stability);
  assert.equal(actual.state.stateData.difficulty, expected.card.difficulty);
  assert.equal(actual.state.stateData.scheduled_days, expected.card.scheduled_days);
  assert.equal(actual.state.stateData.learning_steps, expected.card.learning_steps);
  assert.equal(actual.state.stateData.reps, expected.card.reps);
  assert.equal(actual.state.stateData.lapses, expected.card.lapses);
  assert.equal(actual.state.stateData.state, expected.card.state);
  assert.equal(actual.reviewData.rating, expected.log.rating);
  assert.equal(actual.reviewData.review, expected.log.review.toISOString());
});

test("FSRS preview and subsequent reviews preserve serializable state", () => {
  const algorithm = new FsrsLearningAlgorithm();
  const startedAt = new Date("2026-08-25T00:00:00.000Z");
  const initial = algorithm.initialize(startedAt);
  const preview = algorithm.preview(initial, startedAt);

  assert.equal(preview.length, 4);
  assert.ok(preview.every((option) => !Number.isNaN(option.dueAt.getTime())));

  const first = algorithm.review(initial, "good", startedAt);
  const second = algorithm.review(first.state, "good", first.state.dueAt);

  assert.equal(second.state.stateData.reps, 2);
  assert.doesNotThrow(() => parseFsrsStateData(second.state.stateData));
  assert.equal(typeof algorithm.retrievability(second.state, second.state.dueAt), "number");
});

test("FSRS adapter rejects invalid ratings and inconsistent due projections", () => {
  const algorithm = new FsrsLearningAlgorithm();
  const startedAt = new Date("2026-08-25T00:00:00.000Z");
  const initial = algorithm.initialize(startedAt);

  assert.throws(
    () => algorithm.review(initial, "remembered", startedAt),
    FsrsAlgorithmError,
  );

  assert.throws(
    () =>
      algorithm.preview(
        { ...initial, dueAt: new Date("2027-01-01T00:00:00.000Z") },
        startedAt,
      ),
    FsrsAlgorithmError,
  );
});

test("FSRS adapter preserves explicit configuration", () => {
  const algorithm = new FsrsLearningAlgorithm({
    requestRetention: 0.85,
    maximumInterval: 365,
    enableFuzz: true,
    learningSteps: ["2m", "15m"],
    relearningSteps: ["5m"],
  });

  assert.deepEqual(algorithm.configuration, {
    request_retention: 0.85,
    maximum_interval: 365,
    w: algorithm.configuration.w,
    enable_fuzz: true,
    enable_short_term: true,
    learning_steps: ["2m", "15m"],
    relearning_steps: ["5m"],
  });
});

