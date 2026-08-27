import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  DatabaseSync,
  type SQLInputValue,
  type SQLOutputValue,
} from "node:sqlite";

import { AlgorithmMismatchError } from "../errors.js";
import type {
  AlgorithmRegistration,
  DueStoredItem,
  LearningStore,
  NewItemWithState,
  RegisteredAlgorithm,
  StateUpdate,
  NewReviewRecord,
} from "../learning-store.js";
import {
  algorithmId,
  learningItemId,
  learningStateId,
  reviewRecordId,
  type AlgorithmId,
  type JsonObject,
  type LearningItem,
  type LearningItemId,
  type LearningState,
  type PageQuery,
  type ReviewRecord,
} from "../types.js";
import { migrateDatabase } from "./migrations.js";

type Row = Record<string, SQLOutputValue>;

export class SqliteLearningStore implements LearningStore {
  readonly #database: DatabaseSync;

  public constructor(path: string = ":memory:") {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }
    this.#database = new DatabaseSync(path, {
      enableForeignKeyConstraints: true,
      enableDoubleQuotedStringLiterals: false,
    });
    this.#database.exec("PRAGMA busy_timeout = 5000");
    migrateDatabase(this.#database);
  }

  public async registerAlgorithm(
    registration: AlgorithmRegistration,
  ): Promise<RegisteredAlgorithm> {
    requireNonBlank(registration.name, "algorithm name");
    requireNonBlank(registration.version, "algorithm version");
    const existing = this.#database
      .prepare(`
        SELECT id, name, version, description, config_json
        FROM engine_algorithms
        WHERE name = ?
      `)
      .get(registration.name) as Row | undefined;

    if (existing !== undefined) {
      const stored = mapAlgorithm(existing);
      if (
        stored.version !== registration.version ||
        canonicalJson(stored.configuration) !==
          canonicalJson(registration.configuration)
      ) {
        throw new AlgorithmMismatchError(registration.name);
      }
      return stored;
    }

    const result = this.#database
      .prepare(`
        INSERT INTO engine_algorithms
          (name, version, description, config_json)
        VALUES (?, ?, ?, ?)
      `)
      .run(
        registration.name,
        registration.version,
        registration.description ?? null,
        JSON.stringify(registration.configuration),
      );
    return Object.freeze({
      id: algorithmId(toSafeInteger(result.lastInsertRowid)),
      ...registration,
    });
  }

  public async createItem(input: NewItemWithState): Promise<LearningItem> {
    return this.transaction(() => {
      const itemResult = this.#database
        .prepare("INSERT INTO engine_items (data_json) VALUES (?)")
        .run(JSON.stringify(input.data));
      const id = learningItemId(toSafeInteger(itemResult.lastInsertRowid));
      this.#database
        .prepare(`
          INSERT INTO engine_states
            (learning_item_id, algorithm_id, due_at, state_json)
          VALUES (?, ?, ?, ?)
        `)
        .run(
          id,
          input.algorithmId,
          isoDate(input.dueAt, "initial due time"),
          JSON.stringify(input.stateData),
        );
      return freezeItem({ id, data: input.data });
    });
  }

  public async findItem(id: LearningItemId): Promise<LearningItem | null> {
    const row = this.#database
      .prepare("SELECT id, data_json FROM engine_items WHERE id = ?")
      .get(id) as Row | undefined;
    return row === undefined ? null : mapItem(row);
  }

  public async listItems(query: PageQuery = {}): Promise<readonly LearningItem[]> {
    validatePage(query);
    const parameters: SQLInputValue[] = [];
    let sql = "SELECT id, data_json FROM engine_items ORDER BY id";
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
    const rows = this.#database.prepare(sql).all(...parameters) as Row[];
    return Object.freeze(rows.map(mapItem));
  }

  public async updateItem(
    id: LearningItemId,
    data: JsonObject,
  ): Promise<LearningItem | null> {
    const result = this.#database
      .prepare("UPDATE engine_items SET data_json = ? WHERE id = ?")
      .run(JSON.stringify(data), id);
    return toSafeInteger(result.changes) === 0
      ? null
      : freezeItem({ id, data });
  }

  public async deleteItem(id: LearningItemId): Promise<boolean> {
    const result = this.#database
      .prepare("DELETE FROM engine_items WHERE id = ?")
      .run(id);
    return toSafeInteger(result.changes) > 0;
  }

  public async findState(
    itemId: LearningItemId,
    registeredAlgorithmId: AlgorithmId,
  ): Promise<LearningState | null> {
    const row = this.#database
      .prepare(`
        SELECT id, learning_item_id, algorithm_id, due_at, state_json
        FROM engine_states
        WHERE learning_item_id = ? AND algorithm_id = ?
      `)
      .get(itemId, registeredAlgorithmId) as Row | undefined;
    return row === undefined ? null : mapState(row);
  }

  public async listDue(input: {
    readonly algorithmId: AlgorithmId;
    readonly dueAtOrBefore: Date;
    readonly limit?: number;
  }): Promise<readonly DueStoredItem[]> {
    validateLimit(input.limit);
    const parameters: SQLInputValue[] = [
      input.algorithmId,
      isoDate(input.dueAtOrBefore, "due query time"),
    ];
    let sql = `
      SELECT
        item.id AS item_id,
        item.data_json,
        state.id AS state_id,
        state.algorithm_id,
        state.due_at,
        state.state_json
      FROM engine_states state
      JOIN engine_items item ON item.id = state.learning_item_id
      WHERE state.algorithm_id = ? AND state.due_at <= ?
      ORDER BY state.due_at, item.id
    `;
    if (input.limit !== undefined) {
      sql += " LIMIT ?";
      parameters.push(input.limit);
    }
    const rows = this.#database.prepare(sql).all(...parameters) as Row[];
    return Object.freeze(
      rows.map((row) => {
        const id = learningItemId(requireNumber(row, "item_id"));
        return Object.freeze({
          item: freezeItem({ id, data: parseObject(row, "data_json") }),
          state: freezeState({
            id: learningStateId(requireNumber(row, "state_id")),
            learningItemId: id,
            algorithmId: algorithmId(requireNumber(row, "algorithm_id")),
            dueAt: new Date(requireString(row, "due_at")),
            data: parseObject(row, "state_json"),
          }),
        });
      }),
    );
  }

  public async commitReview(input: {
    readonly state: StateUpdate;
    readonly review: NewReviewRecord;
  }): Promise<ReviewRecord> {
    return this.transaction(() => {
      const update = this.#database
        .prepare(`
          UPDATE engine_states
          SET due_at = ?, state_json = ?
          WHERE id = ?
        `)
        .run(
          isoDate(input.state.dueAt, "next due time"),
          JSON.stringify(input.state.data),
          input.state.state.id,
        );
      if (toSafeInteger(update.changes) !== 1) {
        throw new Error("Learning state disappeared while committing review.");
      }
      const review = input.review;
      validateResponseTime(review.responseTimeMs);
      const result = this.#database
        .prepare(`
          INSERT INTO engine_reviews
            (
              learning_item_id, algorithm_id, rating, review_json,
              response_time_ms, reviewed_at
            )
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(
          review.learningItemId,
          review.algorithmId,
          requireNonBlank(review.rating, "rating"),
          JSON.stringify(review.data),
          review.responseTimeMs ?? null,
          isoDate(review.reviewedAt, "review time"),
        );
      return freezeReview({
        id: reviewRecordId(toSafeInteger(result.lastInsertRowid)),
        ...review,
      });
    });
  }

  public async listReviews(
    itemId: LearningItemId,
    query: PageQuery = {},
  ): Promise<readonly ReviewRecord[]> {
    validatePage(query);
    const parameters: SQLInputValue[] = [itemId];
    let sql = `
      SELECT
        id, learning_item_id, algorithm_id, rating, review_json,
        response_time_ms, reviewed_at
      FROM engine_reviews
      WHERE learning_item_id = ?
      ORDER BY reviewed_at DESC, id DESC
    `;
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
    const rows = this.#database.prepare(sql).all(...parameters) as Row[];
    return Object.freeze(rows.map(mapReview));
  }

  public close(): void {
    this.#database.close();
  }

  private transaction<Result>(work: () => Result): Result {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      this.#database.exec("COMMIT");
      return result;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }
}

function mapAlgorithm(row: Row): RegisteredAlgorithm {
  const description = row["description"];
  return Object.freeze({
    id: algorithmId(requireNumber(row, "id")),
    name: requireString(row, "name"),
    version: requireString(row, "version"),
    ...(description === null
      ? {}
      : { description: requireString(row, "description") }),
    configuration: parseObject(row, "config_json"),
  });
}

function mapItem(row: Row): LearningItem {
  return freezeItem({
    id: learningItemId(requireNumber(row, "id")),
    data: parseObject(row, "data_json"),
  });
}

function mapState(row: Row): LearningState {
  return freezeState({
    id: learningStateId(requireNumber(row, "id")),
    learningItemId: learningItemId(requireNumber(row, "learning_item_id")),
    algorithmId: algorithmId(requireNumber(row, "algorithm_id")),
    dueAt: new Date(requireString(row, "due_at")),
    data: parseObject(row, "state_json"),
  });
}

function mapReview(row: Row): ReviewRecord {
  const responseTime = row["response_time_ms"];
  return freezeReview({
    id: reviewRecordId(requireNumber(row, "id")),
    learningItemId: learningItemId(requireNumber(row, "learning_item_id")),
    algorithmId: algorithmId(requireNumber(row, "algorithm_id")),
    rating: requireString(row, "rating"),
    data: parseObject(row, "review_json"),
    reviewedAt: new Date(requireString(row, "reviewed_at")),
    ...(responseTime === null
      ? {}
      : { responseTimeMs: requireNumber(row, "response_time_ms") }),
  });
}

function freezeItem(item: LearningItem): LearningItem {
  return Object.freeze({ ...item, data: Object.freeze({ ...item.data }) });
}

function freezeState(state: LearningState): LearningState {
  const dueAt = validDate(state.dueAt, "stored due time");
  return Object.freeze({
    ...state,
    dueAt,
    data: Object.freeze({ ...state.data }),
  });
}

function freezeReview(record: ReviewRecord): ReviewRecord {
  const reviewedAt = validDate(record.reviewedAt, "stored review time");
  return Object.freeze({
    ...record,
    reviewedAt,
    data: Object.freeze({ ...record.data }),
  });
}

function parseObject(row: Row, column: string): JsonObject {
  const value: unknown = JSON.parse(requireString(row, column));
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new TypeError(`Database column '${column}' must contain an object.`);
  }
  return value as JsonObject;
}

function requireNumber(row: Row, column: string): number {
  const value = row[column];
  if (typeof value !== "number") {
    throw new TypeError(`Database column '${column}' must be a number.`);
  }
  return value;
}

function requireString(row: Row, column: string): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new TypeError(`Database column '${column}' must be a string.`);
  }
  return value;
}

function toSafeInteger(value: number | bigint): number {
  const number = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isSafeInteger(number)) {
    throw new TypeError("SQLite returned an unsafe integer.");
  }
  return number;
}

function requireNonBlank(value: string, field: string): string {
  if (value.trim().length === 0) {
    throw new TypeError(`${field} must not be blank.`);
  }
  return value;
}

function validDate(value: Date, field: string): Date {
  if (Number.isNaN(value.getTime())) {
    throw new TypeError(`${field} must be a valid date.`);
  }
  return new Date(value);
}

function isoDate(value: Date, field: string): string {
  return validDate(value, field).toISOString();
}

function validatePage(query: PageQuery): void {
  validateLimit(query.limit);
  if (
    query.offset !== undefined &&
    (!Number.isSafeInteger(query.offset) || query.offset < 0)
  ) {
    throw new TypeError("offset must be a non-negative safe integer.");
  }
}

function validateLimit(limit: number | undefined): void {
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 0)) {
    throw new TypeError("limit must be a non-negative safe integer.");
  }
}

function validateResponseTime(value: number | undefined): void {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
    throw new TypeError("responseTimeMs must be a non-negative number.");
  }
}

function canonicalJson(value: JsonObject): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortJson(entry)]),
    );
  }
  return value;
}
