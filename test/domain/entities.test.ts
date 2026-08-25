import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainValidationError,
  defineLearningItem,
  defineLearningItemContent,
  defineLearningState,
  learningAlgorithmId,
  learningItemContentId,
  learningItemId,
  learningStateId,
  moduleDefinitionId,
} from "../../src/domain/index.js";

test("LearningItem identity is its id rather than its word", () => {
  const financialBank = defineLearningItem({
    id: learningItemId(1),
    word: "bank",
  });
  const riverBank = defineLearningItem({
    id: learningItemId(2),
    word: "bank",
  });
  const capitalizedBank = defineLearningItem({
    id: learningItemId(3),
    word: "Bank",
  });

  assert.equal(financialBank.word, riverBank.word);
  assert.notEqual(financialBank.id, riverBank.id);
  assert.notEqual(financialBank.word, capitalizedBank.word);
});

test("LearningItem rejects a blank word", () => {
  assert.throws(
    () => defineLearningItem({ id: learningItemId(1), word: "   " }),
    DomainValidationError,
  );
});

test("entity identifiers must be positive safe integers", () => {
  assert.throws(() => learningItemId(0), DomainValidationError);
  assert.throws(() => learningItemId(1.5), DomainValidationError);
});

test("LearningItemContent rejects a negative display order", () => {
  assert.throws(
    () =>
      defineLearningItemContent({
        id: learningItemContentId(1),
        learningItemId: learningItemId(1),
        moduleId: moduleDefinitionId(1),
        data: { meaning: "a financial institution" },
        orderIndex: -1,
      }),
    DomainValidationError,
  );
});

test("LearningState copies its due date", () => {
  const dueAt = new Date("2026-09-01T00:00:00.000Z");
  const state = defineLearningState({
    id: learningStateId(1),
    learningItemId: learningItemId(1),
    algorithmId: learningAlgorithmId(1),
    dueAt,
    stateData: {},
  });

  dueAt.setUTCFullYear(2030);

  assert.equal(state.dueAt.toISOString(), "2026-09-01T00:00:00.000Z");
});

