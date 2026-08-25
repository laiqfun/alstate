import type {
  JsonObject,
  LearningAlgorithm,
  LearningAlgorithmId,
  LearningItem,
  LearningItemContent,
  LearningItemContentRepository,
  LearningItemId,
  LearningItemRepository,
  LearningStateRepository,
  ModuleDefinitionRepository,
  Tag,
  TagRepository,
} from "../../domain/index.js";
import { relatedMeaningsModule } from "../../modules/index.js";
import { NotFoundError } from "../errors/index.js";
import type { TransactionRunner } from "../transactions/index.js";

export interface LearningItemDetails {
  readonly item: LearningItem;
  readonly contents: readonly LearningItemContent[];
  readonly tags: readonly Tag[];
}

export class LearningItemService<StateData extends JsonObject = JsonObject> {
  readonly #items: LearningItemRepository;
  readonly #contents: LearningItemContentRepository;
  readonly #definitions: ModuleDefinitionRepository;
  readonly #tags: TagRepository;
  readonly #states: LearningStateRepository;
  readonly #algorithm: LearningAlgorithm<StateData>;
  readonly #algorithmId: LearningAlgorithmId;
  readonly #transactions: TransactionRunner;

  public constructor(dependencies: {
    items: LearningItemRepository;
    contents: LearningItemContentRepository;
    definitions: ModuleDefinitionRepository;
    tags: TagRepository;
    states: LearningStateRepository;
    algorithm: LearningAlgorithm<StateData>;
    algorithmId: LearningAlgorithmId;
    transactions: TransactionRunner;
  }) {
    this.#items = dependencies.items;
    this.#contents = dependencies.contents;
    this.#definitions = dependencies.definitions;
    this.#tags = dependencies.tags;
    this.#states = dependencies.states;
    this.#algorithm = dependencies.algorithm;
    this.#algorithmId = dependencies.algorithmId;
    this.#transactions = dependencies.transactions;
  }

  public async create(word: string, at: Date = new Date()): Promise<LearningItem> {
    return this.#transactions.transaction(async () => {
      const item = await this.#items.create({ word });
      const initial = this.#algorithm.initialize(at);
      await this.#states.create({
        learningItemId: item.id,
        algorithmId: this.#algorithmId,
        dueAt: initial.dueAt,
        stateData: initial.stateData,
      });
      return item;
    });
  }

  public async get(id: LearningItemId): Promise<LearningItemDetails> {
    const item = await this.#items.findById(id);

    if (item === null) {
      throw new NotFoundError("LearningItem", id);
    }

    const [contents, tags] = await Promise.all([
      this.#contents.listForItem(id),
      this.#tags.listForItem(id),
    ]);
    return Object.freeze({ item, contents, tags });
  }

  public async list(word?: string): Promise<readonly LearningItem[]> {
    return this.#items.list(word === undefined ? {} : { word });
  }

  public async delete(id: LearningItemId): Promise<boolean> {
    return this.#transactions.transaction(async () => {
      const item = await this.#items.findById(id);

      if (item === null) {
        return false;
      }

      await this.removeRelatedMeaningReferences(item);
      return this.#items.delete(id);
    });
  }

  private async removeRelatedMeaningReferences(item: LearningItem): Promise<void> {
    const definition = await this.#definitions.findByName(
      relatedMeaningsModule.name,
    );

    if (definition === null) {
      return;
    }

    const siblings = await this.#items.list({ word: item.word });

    for (const sibling of siblings) {
      if (sibling.id === item.id) {
        continue;
      }

      const relatedContents = await this.#contents.listForItem(
        sibling.id,
        definition.id,
      );

      for (const content of relatedContents) {
        const data = relatedMeaningsModule.parse(content.data);
        const remaining = data.learningItemIds.filter(
          (targetId) => targetId !== item.id,
        );

        if (remaining.length === data.learningItemIds.length) {
          continue;
        }

        if (remaining.length === 0) {
          await this.#contents.delete(content.id);
        } else {
          await this.#contents.update({
            ...content,
            data: { learningItemIds: remaining },
          });
        }
      }
    }
  }
}

