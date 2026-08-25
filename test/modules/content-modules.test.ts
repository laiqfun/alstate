import assert from "node:assert/strict";
import test from "node:test";

import type {
  LearningItem,
  LearningItemQuery,
  LearningItemRepository,
  NewLearningItem,
} from "../../src/domain/index.js";
import { learningItemId } from "../../src/domain/index.js";
import {
  ContentModuleError,
  ContentModuleRegistry,
  createDefaultContentModuleRegistry,
  exampleModule,
  relatedMeaningsModule,
  validateRelatedMeaningTargets,
} from "../../src/modules/index.js";

class ItemRepositoryStub implements LearningItemRepository {
  readonly #items: readonly LearningItem[];

  public constructor(items: readonly LearningItem[]) {
    this.#items = items;
  }

  public async create(_item: NewLearningItem): Promise<LearningItem> {
    throw new Error("Not implemented by this test stub.");
  }

  public async findById(id: LearningItem["id"]): Promise<LearningItem | null> {
    return this.#items.find((item) => item.id === id) ?? null;
  }

  public async list(_query?: LearningItemQuery): Promise<readonly LearningItem[]> {
    return this.#items;
  }

  public async update(_item: LearningItem): Promise<void> {
    throw new Error("Not implemented by this test stub.");
  }

  public async delete(_id: LearningItem["id"]): Promise<boolean> {
    throw new Error("Not implemented by this test stub.");
  }
}

test("default content registry contains all initial modules", () => {
  const registry = createDefaultContentModuleRegistry();

  assert.deepEqual(
    registry.list().map((module) => module.name),
    [
      "EnglishMeaning",
      "ChineseMeaning",
      "Example",
      "Audio",
      "MemoryNote",
      "RelatedMeanings",
    ],
  );
});

test("content registry rejects duplicate module names", () => {
  assert.throws(
    () => new ContentModuleRegistry([exampleModule, exampleModule]),
    ContentModuleError,
  );
});

test("content modules parse their own data without parent relationships", () => {
  assert.deepEqual(
    exampleModule.parse({
      sentence: "She deposited money at the bank.",
      translation: "她把钱存进了银行。",
    }),
    {
      sentence: "She deposited money at the bank.",
      translation: "她把钱存进了银行。",
    },
  );

  assert.throws(
    () => exampleModule.parse({ sentence: "Example.", parentMeaningId: 1 }),
    ContentModuleError,
  );
});

test("RelatedMeanings validates ids, self references, and exact words", async () => {
  const owner: LearningItem = { id: learningItemId(1), word: "bank" };
  const sibling: LearningItem = { id: learningItemId(2), word: "bank" };
  const differentCase: LearningItem = { id: learningItemId(3), word: "Bank" };
  const repository = new ItemRepositoryStub([owner, sibling, differentCase]);

  const valid = relatedMeaningsModule.parse({ learningItemIds: [2] });
  await validateRelatedMeaningTargets(owner, valid, repository);

  await assert.rejects(
    validateRelatedMeaningTargets(
      owner,
      relatedMeaningsModule.parse({ learningItemIds: [1] }),
      repository,
    ),
    ContentModuleError,
  );

  await assert.rejects(
    validateRelatedMeaningTargets(
      owner,
      relatedMeaningsModule.parse({ learningItemIds: [3] }),
      repository,
    ),
    ContentModuleError,
  );

  assert.throws(
    () => relatedMeaningsModule.parse({ learningItemIds: [2, 2] }),
    ContentModuleError,
  );
});
