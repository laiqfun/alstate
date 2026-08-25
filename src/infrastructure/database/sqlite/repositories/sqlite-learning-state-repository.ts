import type { DatabaseSync } from "node:sqlite";

import {
  defineLearningState,
  learningAlgorithmId,
  learningItemId,
  learningStateId,
  type DueLearningStateQuery,
  type LearningAlgorithmId,
  type LearningItemId,
  type LearningState,
  type LearningStateId,
  type LearningStateRepository,
  type NewLearningState,
} from "../../../../domain/index.js";
import {
  parseJsonObject,
  requireNumber,
  requireString,
  toNumber,
  type SqliteRow,
} from "../row-mapping.js";

const columns = "id, learning_item_id, algorithm_id, due_at, state_json";

export class SqliteLearningStateRepository
  implements LearningStateRepository
{
  readonly #database: DatabaseSync;

  public constructor(database: DatabaseSync) {
    this.#database = database;
  }

  public async create(state: NewLearningState): Promise<LearningState> {
    const result = this.#database
      .prepare(`
        INSERT INTO learning_states
          (learning_item_id, algorithm_id, due_at, state_json)
        VALUES (?, ?, ?, ?)
      `)
      .run(
        state.learningItemId,
        state.algorithmId,
        state.dueAt.toISOString(),
        JSON.stringify(state.stateData),
      );
    return defineLearningState({
      ...state,
      id: learningStateId(toNumber(result.lastInsertRowid)),
    });
  }

  public async findById(id: LearningStateId): Promise<LearningState | null> {
    const row = this.#database
      .prepare(`SELECT ${columns} FROM learning_states WHERE id = ?`)
      .get(id) as SqliteRow | undefined;
    return row === undefined ? null : mapState(row);
  }

  public async findForItem(
    itemId: LearningItemId,
    algorithmIdValue: LearningAlgorithmId,
  ): Promise<LearningState | null> {
    const row = this.#database
      .prepare(`
        SELECT ${columns}
        FROM learning_states
        WHERE learning_item_id = ? AND algorithm_id = ?
      `)
      .get(itemId, algorithmIdValue) as SqliteRow | undefined;
    return row === undefined ? null : mapState(row);
  }

  public async listDue(
    query: DueLearningStateQuery,
  ): Promise<readonly LearningState[]> {
    const statement =
      query.limit === undefined
        ? this.#database.prepare(`
            SELECT ${columns}
            FROM learning_states
            WHERE algorithm_id = ? AND due_at <= ?
            ORDER BY due_at, learning_item_id
          `)
        : this.#database.prepare(`
            SELECT ${columns}
            FROM learning_states
            WHERE algorithm_id = ? AND due_at <= ?
            ORDER BY due_at, learning_item_id
            LIMIT ?
          `);
    const parameters = [
      query.algorithmId,
      query.dueAtOrBefore.toISOString(),
      ...(query.limit === undefined ? [] : [query.limit]),
    ];
    const rows = statement.all(...parameters) as SqliteRow[];
    return Object.freeze(rows.map(mapState));
  }

  public async update(state: LearningState): Promise<void> {
    const valid = defineLearningState(state);
    this.#database
      .prepare(`
        UPDATE learning_states
        SET learning_item_id = ?, algorithm_id = ?, due_at = ?, state_json = ?
        WHERE id = ?
      `)
      .run(
        valid.learningItemId,
        valid.algorithmId,
        valid.dueAt.toISOString(),
        JSON.stringify(valid.stateData),
        valid.id,
      );
  }

  public async delete(id: LearningStateId): Promise<boolean> {
    const result = this.#database
      .prepare("DELETE FROM learning_states WHERE id = ?")
      .run(id);
    return toNumber(result.changes) > 0;
  }
}

function mapState(row: SqliteRow): LearningState {
  return defineLearningState({
    id: learningStateId(requireNumber(row, "id")),
    learningItemId: learningItemId(requireNumber(row, "learning_item_id")),
    algorithmId: learningAlgorithmId(requireNumber(row, "algorithm_id")),
    dueAt: new Date(requireString(row, "due_at")),
    stateData: parseJsonObject(row, "state_json"),
  });
}

