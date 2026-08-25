import type { DatabaseSync } from "node:sqlite";

import {
  defineTag,
  tagId,
  type LearningItemId,
  type NewTag,
  type Tag,
  type TagId,
  type TagRepository,
} from "../../../../domain/index.js";
import {
  optionalString,
  requireNumber,
  requireString,
  toNumber,
  type SqliteRow,
} from "../row-mapping.js";

const columns = "id, name, description";

export class SqliteTagRepository implements TagRepository {
  readonly #database: DatabaseSync;

  public constructor(database: DatabaseSync) {
    this.#database = database;
  }

  public async create(tag: NewTag): Promise<Tag> {
    const result = this.#database
      .prepare("INSERT INTO tags (name, description) VALUES (?, ?)")
      .run(tag.name, tag.description ?? null);
    return defineTag({
      ...tag,
      id: tagId(toNumber(result.lastInsertRowid)),
    });
  }

  public async findById(id: TagId): Promise<Tag | null> {
    const row = this.#database
      .prepare(`SELECT ${columns} FROM tags WHERE id = ?`)
      .get(id) as SqliteRow | undefined;
    return row === undefined ? null : mapTag(row);
  }

  public async findByName(name: string): Promise<Tag | null> {
    const row = this.#database
      .prepare(`SELECT ${columns} FROM tags WHERE name = ?`)
      .get(name) as SqliteRow | undefined;
    return row === undefined ? null : mapTag(row);
  }

  public async list(): Promise<readonly Tag[]> {
    const rows = this.#database
      .prepare(`SELECT ${columns} FROM tags ORDER BY name, id`)
      .all() as SqliteRow[];
    return Object.freeze(rows.map(mapTag));
  }

  public async update(tag: Tag): Promise<void> {
    const valid = defineTag(tag);
    this.#database
      .prepare("UPDATE tags SET name = ?, description = ? WHERE id = ?")
      .run(valid.name, valid.description ?? null, valid.id);
  }

  public async delete(id: TagId): Promise<boolean> {
    const result = this.#database.prepare("DELETE FROM tags WHERE id = ?").run(id);
    return toNumber(result.changes) > 0;
  }

  public async attach(itemId: LearningItemId, id: TagId): Promise<void> {
    this.#database
      .prepare(`
        INSERT INTO learning_item_tags (learning_item_id, tag_id)
        VALUES (?, ?)
        ON CONFLICT (learning_item_id, tag_id) DO NOTHING
      `)
      .run(itemId, id);
  }

  public async detach(itemId: LearningItemId, id: TagId): Promise<boolean> {
    const result = this.#database
      .prepare(`
        DELETE FROM learning_item_tags
        WHERE learning_item_id = ? AND tag_id = ?
      `)
      .run(itemId, id);
    return toNumber(result.changes) > 0;
  }

  public async listForItem(itemId: LearningItemId): Promise<readonly Tag[]> {
    const rows = this.#database
      .prepare(`
        SELECT tag.id, tag.name, tag.description
        FROM tags tag
        JOIN learning_item_tags item_tag ON item_tag.tag_id = tag.id
        WHERE item_tag.learning_item_id = ?
        ORDER BY tag.name, tag.id
      `)
      .all(itemId) as SqliteRow[];
    return Object.freeze(rows.map(mapTag));
  }
}

function mapTag(row: SqliteRow): Tag {
  const description = optionalString(row, "description");
  return defineTag({
    id: tagId(requireNumber(row, "id")),
    name: requireString(row, "name"),
    ...(description === undefined ? {} : { description }),
  });
}

