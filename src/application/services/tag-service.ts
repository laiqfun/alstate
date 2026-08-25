import type {
  LearningItemId,
  LearningItemRepository,
  Tag,
  TagId,
  TagRepository,
} from "../../domain/index.js";
import { ConflictError, NotFoundError } from "../errors/index.js";

export class TagService {
  readonly #items: LearningItemRepository;
  readonly #tags: TagRepository;

  public constructor(dependencies: {
    items: LearningItemRepository;
    tags: TagRepository;
  }) {
    this.#items = dependencies.items;
    this.#tags = dependencies.tags;
  }

  public async create(name: string, description?: string): Promise<Tag> {
    if ((await this.#tags.findByName(name)) !== null) {
      throw new ConflictError(`Tag '${name}' already exists.`);
    }

    return this.#tags.create({
      name,
      ...(description === undefined ? {} : { description }),
    });
  }

  public async list(): Promise<readonly Tag[]> {
    return this.#tags.list();
  }

  public async attach(itemId: LearningItemId, tagIdValue: TagId): Promise<void> {
    const [item, tag] = await Promise.all([
      this.#items.findById(itemId),
      this.#tags.findById(tagIdValue),
    ]);

    if (item === null) {
      throw new NotFoundError("LearningItem", itemId);
    }

    if (tag === null) {
      throw new NotFoundError("Tag", tagIdValue);
    }

    await this.#tags.attach(itemId, tagIdValue);
  }

  public async detach(itemId: LearningItemId, tagIdValue: TagId): Promise<boolean> {
    return this.#tags.detach(itemId, tagIdValue);
  }

  public async delete(id: TagId): Promise<boolean> {
    return this.#tags.delete(id);
  }
}

