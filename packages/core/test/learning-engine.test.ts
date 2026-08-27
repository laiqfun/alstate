import assert from "node:assert/strict";
import test from "node:test";

import {
  AlgorithmContractError,
  LearningEngine,
  UnsupportedRatingError,
  algorithmId,
  learningItemId,
  learningStateId,
  reviewRecordId,
  type AlgorithmId,
  type AlgorithmRegistration,
  type AlgorithmState,
  type DueStoredItem,
  type JsonObject,
  type LearningAlgorithm,
  type LearningItem,
  type LearningItemId,
  type LearningState,
  type LearningStore,
  type NewItemWithState,
  type NewReviewRecord,
  type PageQuery,
  type RegisteredAlgorithm,
  type ReviewRecord,
  type StateUpdate,
} from "../src/index.js";

interface TestState extends JsonObject {
  readonly reviews: number;
}

interface TestReview extends JsonObject {
  readonly previousReviews: number;
}

const good = Object.freeze({ value: "good", label: "Good" });

class TestAlgorithm implements LearningAlgorithm<TestState, TestReview> {
  public readonly name = "memory-test";
  public readonly version = "1";
  public readonly configuration = {};
  public readonly ratings = [good];

  public parse(data: JsonObject): TestState {
    const reviews = data["reviews"];
    if (typeof reviews !== "number") throw new Error("invalid state");
    return { reviews };
  }

  public initialize(at: Date): AlgorithmState<TestState> {
    return { dueAt: at, data: { reviews: 0 } };
  }

  public preview(_state: AlgorithmState<TestState>, at: Date) {
    return [{ rating: good, dueAt: new Date(at.getTime() + 1_000) }];
  }

  public review(state: AlgorithmState<TestState>, _rating: string, at: Date) {
    return {
      rating: good,
      state: {
        dueAt: new Date(at.getTime() + 1_000),
        data: { reviews: state.data.reviews + 1 },
      },
      data: { previousReviews: state.data.reviews },
    };
  }
}

class InvalidInitializationAlgorithm extends TestAlgorithm {
  public override initialize(_at: Date): AlgorithmState<TestState> {
    return { dueAt: new Date(Number.NaN), data: { reviews: 0 } };
  }
}

class MemoryStore implements LearningStore {
  readonly #algorithmId = algorithmId(1);
  #item: LearningItem | null = null;
  #state: LearningState | null = null;
  #reviews: ReviewRecord[] = [];

  public async registerAlgorithm(
    registration: AlgorithmRegistration,
  ): Promise<RegisteredAlgorithm> {
    return { id: this.#algorithmId, ...registration };
  }

  public async createItem(input: NewItemWithState): Promise<LearningItem> {
    const id = learningItemId(1);
    this.#item = { id, data: input.data };
    this.#state = {
      id: learningStateId(1),
      learningItemId: id,
      algorithmId: input.algorithmId,
      revision: 0,
      dueAt: input.dueAt,
      data: input.stateData,
    };
    return this.#item;
  }

  public async findItem(
    id: LearningItemId,
    registeredAlgorithmId: AlgorithmId,
  ): Promise<LearningItem | null> {
    return this.owns(id, registeredAlgorithmId) ? this.#item : null;
  }

  public async listItems(
    registeredAlgorithmId: AlgorithmId,
    _query: PageQuery = {},
  ): Promise<readonly LearningItem[]> {
    return this.#item !== null && this.#state?.algorithmId === registeredAlgorithmId
      ? [this.#item]
      : [];
  }

  public async updateItem(
    id: LearningItemId,
    registeredAlgorithmId: AlgorithmId,
    data: JsonObject,
  ): Promise<LearningItem | null> {
    if (!this.owns(id, registeredAlgorithmId)) return null;
    this.#item = { id, data };
    return this.#item;
  }

  public async deleteItem(
    id: LearningItemId,
    registeredAlgorithmId: AlgorithmId,
  ): Promise<boolean> {
    if (!this.owns(id, registeredAlgorithmId)) return false;
    this.#item = null;
    this.#state = null;
    this.#reviews = [];
    return true;
  }

  public async findState(
    itemId: LearningItemId,
    registeredAlgorithmId: AlgorithmId,
  ): Promise<LearningState | null> {
    return this.owns(itemId, registeredAlgorithmId) ? this.#state : null;
  }

  public async listDue(input: {
    readonly algorithmId: AlgorithmId;
    readonly dueAtOrBefore: Date;
    readonly limit?: number;
  }): Promise<readonly DueStoredItem[]> {
    if (
      this.#item === null ||
      this.#state === null ||
      this.#state.algorithmId !== input.algorithmId ||
      this.#state.dueAt > input.dueAtOrBefore ||
      input.limit === 0
    ) {
      return [];
    }
    return [{ item: this.#item, state: this.#state }];
  }

  public async commitReview(input: {
    readonly state: StateUpdate;
    readonly review: NewReviewRecord;
  }): Promise<ReviewRecord> {
    if (this.#state === null) throw new Error("state missing");
    this.#state = {
      ...this.#state,
      revision: this.#state.revision + 1,
      dueAt: input.state.dueAt,
      data: input.state.data,
    };
    const record = {
      id: reviewRecordId(this.#reviews.length + 1),
      ...input.review,
    };
    this.#reviews.push(record);
    return record;
  }

  public async listReviews(
    itemId: LearningItemId,
    registeredAlgorithmId: AlgorithmId,
    _query: PageQuery = {},
  ): Promise<readonly ReviewRecord[]> {
    return this.owns(itemId, registeredAlgorithmId) ? this.#reviews : [];
  }

  public close(): void {}

  private owns(id: LearningItemId, registeredAlgorithmId: AlgorithmId): boolean {
    return (
      this.#item?.id === id && this.#state?.algorithmId === registeredAlgorithmId
    );
  }
}

test("core coordinates a complete workflow without a concrete adapter", async () => {
  const engine = await LearningEngine.create({
    store: new MemoryStore(),
    algorithm: new TestAlgorithm(),
  });
  const at = new Date("2026-08-25T00:00:00.000Z");

  const item = await engine.add({ prompt: "2 + 2" }, at);
  assert.equal((await engine.due(at)).length, 1);
  const completed = await engine.review(item.id, "good", { at });
  assert.equal(completed.outcome.state.data.reviews, 1);
  assert.equal((await engine.history(item.id)).length, 1);
});

test("core rejects ratings not advertised by the algorithm", async () => {
  const engine = await LearningEngine.create({
    store: new MemoryStore(),
    algorithm: new TestAlgorithm(),
  });
  const item = await engine.add();

  await assert.rejects(engine.review(item.id, "easy"), UnsupportedRatingError);
});

test("core rejects invalid algorithm output before persistence", async () => {
  const engine = await LearningEngine.create({
    store: new MemoryStore(),
    algorithm: new InvalidInitializationAlgorithm(),
  });

  await assert.rejects(engine.add(), AlgorithmContractError);
  assert.deepEqual(await engine.list(), []);
});

test("core rejects application data that cannot round-trip through JSON", async () => {
  const engine = await LearningEngine.create({
    store: new MemoryStore(),
    algorithm: new TestAlgorithm(),
  });

  await assert.rejects(
    engine.add({ createdAt: new Date() } as unknown as JsonObject),
    TypeError,
  );
  await assert.rejects(
    engine.add({ score: Number.NaN } as unknown as JsonObject),
    TypeError,
  );
});
