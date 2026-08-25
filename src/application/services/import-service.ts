import type {
  JsonObject,
  LearningAlgorithm,
  LearningAlgorithmId,
  LearningItem,
  LearningItemContentRepository,
  LearningItemRepository,
  LearningStateRepository,
  ModuleDefinitionRepository,
  TagRepository,
} from "../../domain/index.js";
import type {
  ImportCandidate,
  ImportLookup,
  ImportResolution,
  ImportStrategy,
} from "../../modules/index.js";
import { NotFoundError } from "../errors/index.js";
import type { TransactionRunner } from "../transactions/index.js";
import { ContentService } from "./content-service.js";

export interface ImportResult {
  readonly action: ImportResolution["action"];
  readonly item?: LearningItem;
  readonly warning?: string;
  readonly sourceReference?: string;
}

export class ImportService<StateData extends JsonObject = JsonObject>
  implements ImportLookup
{
  readonly #items: LearningItemRepository;
  readonly #contents: LearningItemContentRepository;
  readonly #definitions: ModuleDefinitionRepository;
  readonly #tags: TagRepository;
  readonly #states: LearningStateRepository;
  readonly #contentService: ContentService;
  readonly #algorithm: LearningAlgorithm<StateData>;
  readonly #algorithmId: LearningAlgorithmId;
  readonly #strategy: ImportStrategy;
  readonly #transactions: TransactionRunner;

  public constructor(dependencies: {
    items: LearningItemRepository;
    contents: LearningItemContentRepository;
    definitions: ModuleDefinitionRepository;
    tags: TagRepository;
    states: LearningStateRepository;
    contentService: ContentService;
    algorithm: LearningAlgorithm<StateData>;
    algorithmId: LearningAlgorithmId;
    strategy: ImportStrategy;
    transactions: TransactionRunner;
  }) {
    this.#items = dependencies.items;
    this.#contents = dependencies.contents;
    this.#definitions = dependencies.definitions;
    this.#tags = dependencies.tags;
    this.#states = dependencies.states;
    this.#contentService = dependencies.contentService;
    this.#algorithm = dependencies.algorithm;
    this.#algorithmId = dependencies.algorithmId;
    this.#strategy = dependencies.strategy;
    this.#transactions = dependencies.transactions;
  }

  public async import(
    candidates: readonly ImportCandidate[],
    importedAt: Date = new Date(),
  ): Promise<readonly ImportResult[]> {
    const results: ImportResult[] = [];

    for (const candidate of candidates) {
      const resolution = await this.#strategy.resolve(candidate, this);
      const result = await this.#transactions.transaction(() =>
        this.applyResolution(candidate, resolution, importedAt),
      );
      results.push(result);
    }

    return Object.freeze(results);
  }

  public async findItemsByWord(word: string): Promise<readonly LearningItem[]> {
    return this.#items.list({ word });
  }

  public async listContent(learningItemId: LearningItem["id"]) {
    return this.#contents.listForItem(learningItemId);
  }

  private async applyResolution(
    candidate: ImportCandidate,
    resolution: ImportResolution,
    importedAt: Date,
  ): Promise<ImportResult> {
    if (resolution.action === "skip") {
      return resultFor(candidate, resolution.action, undefined, resolution.warning);
    }

    let item: LearningItem;

    if (resolution.action === "append") {
      item = await this.#items.create({ word: candidate.word });
      const initial = this.#algorithm.initialize(importedAt);
      await this.#states.create({
        learningItemId: item.id,
        algorithmId: this.#algorithmId,
        dueAt: initial.dueAt,
        stateData: initial.stateData,
      });
    } else {
      const existing = await this.#items.findById(resolution.targetLearningItemId);

      if (existing === null) {
        throw new NotFoundError(
          "LearningItem",
          resolution.targetLearningItemId,
        );
      }

      item = existing;

      if (resolution.action === "overwrite") {
        await this.removeOverwrittenContent(item, candidate);
      }
    }

    for (const content of candidate.contents) {
      await this.#contentService.add({
        learningItemId: item.id,
        moduleName: content.moduleName,
        data: content.data,
        orderIndex: content.orderIndex,
      });
    }

    for (const tagName of candidate.tags ?? []) {
      const tag =
        (await this.#tags.findByName(tagName)) ??
        (await this.#tags.create({ name: tagName }));
      await this.#tags.attach(item.id, tag.id);
    }

    return resultFor(
      candidate,
      resolution.action,
      item,
      "warning" in resolution ? resolution.warning : undefined,
    );
  }

  private async removeOverwrittenContent(
    item: LearningItem,
    candidate: ImportCandidate,
  ): Promise<void> {
    const moduleNames = new Set(candidate.contents.map((content) => content.moduleName));

    for (const moduleName of moduleNames) {
      const definition = await this.#definitions.findByName(moduleName);

      if (definition === null) {
        continue;
      }

      const existing = await this.#contents.listForItem(item.id, definition.id);

      for (const content of existing) {
        await this.#contents.delete(content.id);
      }
    }
  }
}

function resultFor(
  candidate: ImportCandidate,
  action: ImportResolution["action"],
  item?: LearningItem,
  warning?: string,
): ImportResult {
  return Object.freeze({
    action,
    ...(item === undefined ? {} : { item }),
    ...(warning === undefined ? {} : { warning }),
    ...(candidate.sourceReference === undefined
      ? {}
      : { sourceReference: candidate.sourceReference }),
  });
}
