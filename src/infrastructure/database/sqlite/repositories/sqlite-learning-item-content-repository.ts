import type { DatabaseSync } from "node:sqlite";

import {
  defineLearningItemContent,
  learningItemContentId,
  learningItemId,
  moduleDefinitionId,
  type LearningItemContent,
  type LearningItemContentId,
  type LearningItemContentRepository,
  type LearningItemId,
  type ModuleDefinitionId,
  type NewLearningItemContent,
} from "../../../../domain/index.js";
import {
  parseJsonObject,
  requireNumber,
  toNumber,
  type SqliteRow,
} from "../row-mapping.js";

const columns = "id, learning_item_id, module_id, data_json, order_index";

export class SqliteLearningItemContentRepository
  implements LearningItemContentRepository
{
  readonly #database: DatabaseSync;

  public constructor(database: DatabaseSync) {
    this.#database = database;
  }

  public async create(
    content: NewLearningItemContent,
  ): Promise<LearningItemContent> {
    const result = this.#database
      .prepare(`
        INSERT INTO learning_item_contents
          (learning_item_id, module_id, data_json, order_index)
        VALUES (?, ?, ?, ?)
      `)
      .run(
        content.learningItemId,
        content.moduleId,
        JSON.stringify(content.data),
        content.orderIndex,
      );

    return defineLearningItemContent({
      ...content,
      id: learningItemContentId(toNumber(result.lastInsertRowid)),
    });
  }

  public async findById(
    id: LearningItemContentId,
  ): Promise<LearningItemContent | null> {
    const row = this.#database
      .prepare(`SELECT ${columns} FROM learning_item_contents WHERE id = ?`)
      .get(id) as SqliteRow | undefined;
    return row === undefined ? null : mapContent(row);
  }

  public async listForItem(
    itemId: LearningItemId,
    moduleId?: ModuleDefinitionId,
  ): Promise<readonly LearningItemContent[]> {
    const statement =
      moduleId === undefined
        ? this.#database.prepare(`
            SELECT ${columns}
            FROM learning_item_contents
            WHERE learning_item_id = ?
            ORDER BY order_index, id
          `)
        : this.#database.prepare(`
            SELECT ${columns}
            FROM learning_item_contents
            WHERE learning_item_id = ? AND module_id = ?
            ORDER BY order_index, id
          `);
    const rows = (
      moduleId === undefined
        ? statement.all(itemId)
        : statement.all(itemId, moduleId)
    ) as SqliteRow[];
    return Object.freeze(rows.map(mapContent));
  }

  public async update(content: LearningItemContent): Promise<void> {
    const valid = defineLearningItemContent(content);
    this.#database
      .prepare(`
        UPDATE learning_item_contents
        SET learning_item_id = ?, module_id = ?, data_json = ?, order_index = ?
        WHERE id = ?
      `)
      .run(
        valid.learningItemId,
        valid.moduleId,
        JSON.stringify(valid.data),
        valid.orderIndex,
        valid.id,
      );
  }

  public async delete(id: LearningItemContentId): Promise<boolean> {
    const result = this.#database
      .prepare("DELETE FROM learning_item_contents WHERE id = ?")
      .run(id);
    return toNumber(result.changes) > 0;
  }
}

function mapContent(row: SqliteRow): LearningItemContent {
  return defineLearningItemContent({
    id: learningItemContentId(requireNumber(row, "id")),
    learningItemId: learningItemId(requireNumber(row, "learning_item_id")),
    moduleId: moduleDefinitionId(requireNumber(row, "module_id")),
    data: parseJsonObject(row, "data_json"),
    orderIndex: requireNumber(row, "order_index"),
  });
}

