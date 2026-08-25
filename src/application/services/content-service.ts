import type {
  JsonObject,
  LearningItem,
  LearningItemContent,
  LearningItemContentId,
  LearningItemContentRepository,
  LearningItemId,
  LearningItemRepository,
  ModuleDefinitionRepository,
} from "../../domain/index.js";
import {
  type ContentModule,
  type ContentModuleRegistry,
  relatedMeaningsModule,
  validateRelatedMeaningTargets,
} from "../../modules/index.js";
import { ConflictError, NotFoundError } from "../errors/index.js";

export class ContentService {
  readonly #items: LearningItemRepository;
  readonly #contents: LearningItemContentRepository;
  readonly #definitions: ModuleDefinitionRepository;
  readonly #registry: ContentModuleRegistry;

  public constructor(dependencies: {
    items: LearningItemRepository;
    contents: LearningItemContentRepository;
    definitions: ModuleDefinitionRepository;
    registry: ContentModuleRegistry;
  }) {
    this.#items = dependencies.items;
    this.#contents = dependencies.contents;
    this.#definitions = dependencies.definitions;
    this.#registry = dependencies.registry;
  }

  public async add(input: {
    learningItemId: LearningItemId;
    moduleName: string;
    data: JsonObject;
    orderIndex: number;
  }): Promise<LearningItemContent> {
    const item = await this.requireItem(input.learningItemId);
    const module = this.#registry.require(input.moduleName);
    const definition = await this.#definitions.findByName(module.name);

    if (definition === null) {
      throw new NotFoundError("ModuleDefinition", module.name);
    }

    if (
      module.cardinality === "single" &&
      (await this.#contents.listForItem(item.id, definition.id)).length > 0
    ) {
      throw new ConflictError(
        `LearningItem '${item.id}' already has module '${module.name}'.`,
      );
    }

    const data = await this.validateData(item, module, input.data);
    return this.#contents.create({
      learningItemId: item.id,
      moduleId: definition.id,
      data,
      orderIndex: input.orderIndex,
    });
  }

  public async update(input: {
    id: LearningItemContentId;
    data: JsonObject;
    orderIndex?: number;
  }): Promise<LearningItemContent> {
    const existing = await this.#contents.findById(input.id);

    if (existing === null) {
      throw new NotFoundError("LearningItemContent", input.id);
    }

    const item = await this.requireItem(existing.learningItemId);
    const definition = await this.#definitions.findById(existing.moduleId);

    if (definition === null) {
      throw new NotFoundError("ModuleDefinition", existing.moduleId);
    }

    const module = this.#registry.require(definition.name);
    const updated = {
      ...existing,
      data: await this.validateData(item, module, input.data),
      orderIndex: input.orderIndex ?? existing.orderIndex,
    };
    await this.#contents.update(updated);
    return updated;
  }

  public async delete(id: LearningItemContentId): Promise<boolean> {
    return this.#contents.delete(id);
  }

  public async list(itemId: LearningItemId): Promise<readonly LearningItemContent[]> {
    await this.requireItem(itemId);
    return this.#contents.listForItem(itemId);
  }

  private async requireItem(id: LearningItemId): Promise<LearningItem> {
    const item = await this.#items.findById(id);

    if (item === null) {
      throw new NotFoundError("LearningItem", id);
    }

    return item;
  }

  private async validateData(
    item: LearningItem,
    module: ContentModule,
    data: JsonObject,
  ): Promise<JsonObject> {
    const parsed = module.parse(data);

    if (module.name === relatedMeaningsModule.name) {
      const related = relatedMeaningsModule.parse(parsed);
      await validateRelatedMeaningTargets(item, related, this.#items);
      return related;
    }

    return parsed;
  }
}

