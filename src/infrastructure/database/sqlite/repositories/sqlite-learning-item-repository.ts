import type { DatabaseSync, SQLInputValue } from "node:sqlite";

import {
  DomainValidationError,
  defineLearningItem,
  defineNewLearningItem,
  learningItemId,
  type LearningItem,
  type LearningItemId,
  type LearningItemQuery,
  type LearningItemRepository,
  type NewLearningItem,
} from "../../../../domain/index.js";
import {
  requireNumber,
  requireString,
  toNumber,
  type SqliteRow,
} from "../row-mapping.js";

export class SqliteLearningItemRepository implements LearningItemRepository {
  readonly #database: DatabaseSync;

  public constructor(database: DatabaseSync) {
    this.#database = database;
  }

  public async create(item: NewLearningItem): Promise<LearningItem> {
    const valid = defineNewLearningItem(item);
    const result = this.#database
      .prepare("INSERT INTO learning_items (word) VALUES (?)")
      .run(valid.word);

    return defineLearningItem({
      id: learningItemId(toNumber(result.lastInsertRowid)),
      word: valid.word,
    });
  }

  public async findById(id: LearningItemId): Promise<LearningItem | null> {
    const row = this.#database
      .prepare("SELECT id, word FROM learning_items WHERE id = ?")
      .get(id) as SqliteRow | undefined;

    return row === undefined ? null : mapLearningItem(row);
  }

  public async list(
    query: LearningItemQuery = {},
  ): Promise<readonly LearningItem[]> {
    validatePageValue(query.limit, "limit");
    validatePageValue(query.offset, "offset");

    const parameters: SQLInputValue[] = [];
    const conditions: string[] = [];
    let sql = "SELECT DISTINCT item.id, item.word FROM learning_items item";

    if (query.tagId !== undefined) {
      sql += " JOIN learning_item_tags item_tag ON item_tag.learning_item_id = item.id";
      conditions.push("item_tag.tag_id = ?");
      parameters.push(query.tagId);
    }

    if (query.word !== undefined) {
      conditions.push("item.word = ?");
      parameters.push(query.word);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    sql += " ORDER BY item.id";

    if (query.limit !== undefined) {
      sql += " LIMIT ?";
      parameters.push(query.limit);
    } else if (query.offset !== undefined) {
      sql += " LIMIT -1";
    }

    if (query.offset !== undefined) {
      sql += " OFFSET ?";
      parameters.push(query.offset);
    }

    const rows = this.#database.prepare(sql).all(...parameters) as SqliteRow[];
    return Object.freeze(rows.map(mapLearningItem));
  }

  public async update(item: LearningItem): Promise<void> {
    const valid = defineLearningItem(item);
    this.#database
      .prepare("UPDATE learning_items SET word = ? WHERE id = ?")
      .run(valid.word, valid.id);
  }

  public async delete(id: LearningItemId): Promise<boolean> {
    const result = this.#database
      .prepare("DELETE FROM learning_items WHERE id = ?")
      .run(id);
    return toNumber(result.changes) > 0;
  }
}

function mapLearningItem(row: SqliteRow): LearningItem {
  return defineLearningItem({
    id: learningItemId(requireNumber(row, "id")),
    word: requireString(row, "word"),
  });
}

function validatePageValue(value: number | undefined, field: string): void {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
    throw new DomainValidationError(`${field} must be a non-negative integer.`);
  }
}

