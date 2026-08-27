import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  AlgorithmMismatchError,
  LearningEngine,
  SqliteLearningStore,
  type AlgorithmState,
  type JsonObject,
  type LearningAlgorithm,
} from "../src/index.js";

interface TestState extends JsonObject {
  readonly reviews: number;
}

interface TestReview extends JsonObject {
  readonly previousReviews: number;
}

const good = Object.freeze({ value: "good", label: "Good" });

class TestAlgorithm implements LearningAlgorithm<TestState, TestReview> {
  public readonly name = "test-scheduler";
  public readonly version: string;
  public readonly configuration: JsonObject;
  public readonly ratings = [good];

  public constructor(version = "1", configuration: JsonObject = {}) {
    this.version = version;
    this.configuration = configuration;
  }

  public parse(data: JsonObject): TestState {
    const reviews = data["reviews"];
    if (typeof reviews !== "number") throw new Error("invalid test state");
    return { reviews };
  }

  public initialize(at: Date): AlgorithmState<TestState> {
    return { dueAt: new Date(at), data: { reviews: 0 } };
  }

  public preview(_state: AlgorithmState<TestState>, at: Date) {
    return [{ rating: good, dueAt: new Date(at.getTime() + 60_000) }];
  }

  public review(state: AlgorithmState<TestState>, _rating: string, at: Date) {
    return {
      rating: good,
      state: {
        dueAt: new Date(at.getTime() + 60_000),
        data: { reviews: state.data.reviews + 1 },
      },
      data: { previousReviews: state.data.reviews },
    };
  }
}

test("LearningEngine exposes one compact learning workflow", async () => {
  const engine = await LearningEngine.create({
    store: new SqliteLearningStore(),
    algorithm: new TestAlgorithm(),
  });
  const now = new Date("2026-08-25T00:00:00.000Z");

  try {
    const item = await engine.add({ prompt: "2 + 2" }, now);
    assert.deepEqual(await engine.get(item.id), item);
    assert.deepEqual(await engine.list(), [item]);

    const due = await engine.due(now);
    assert.equal(due.length, 1);
    assert.equal(due[0]?.preview[0]?.rating.value, "good");

    const updated = await engine.update(item.id, {
      prompt: "2 + 2",
      answer: "4",
    });
    assert.equal(updated.data["answer"], "4");

    const completed = await engine.review(item.id, "good", { at: now });
    assert.equal(completed.outcome.state.data.reviews, 1);
    assert.equal((await engine.history(item.id)).length, 1);
    assert.equal(await engine.remove(item.id), true);
    assert.deepEqual(await engine.list(), []);
  } finally {
    engine.close();
  }
});

test("algorithm registration refuses implicit state reinterpretation", async () => {
  const store = new SqliteLearningStore();
  const engine = await LearningEngine.create({
    store,
    algorithm: new TestAlgorithm("1", { interval: 1 }),
  });

  await assert.rejects(
    LearningEngine.create({
      store,
      algorithm: new TestAlgorithm("2", { interval: 2 }),
    }),
    AlgorithmMismatchError,
  );
  engine.close();
});

test("the SQLite adapter preserves engine data across restarts", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "alstate-engine-test-"));
  const path = join(directory, "engine.db");
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const first = await LearningEngine.create({
    store: new SqliteLearningStore(path),
    algorithm: new TestAlgorithm(),
  });
  const item = await first.add({ externalReference: "question-42" });
  first.close();

  const second = await LearningEngine.create({
    store: new SqliteLearningStore(path),
    algorithm: new TestAlgorithm(),
  });
  assert.deepEqual(await second.get(item.id), item);
  second.close();
});
