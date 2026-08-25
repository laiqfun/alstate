import type { DatabaseSync } from "node:sqlite";

import {
  defineReviewRecord,
  learningAlgorithmId,
  learningItemId,
  reviewRecordId,
  type NewReviewRecord,
  type ReviewRecord,
  type ReviewRecordQuery,
  type ReviewRecordRepository,
} from "../../../../domain/index.js";
import {
  parseJsonObject,
  requireNumber,
  requireString,
  toNumber,
  type SqliteRow,
} from "../row-mapping.js";

const columns = `
  id, learning_item_id, algorithm_id, rating, review_json,
  response_time_ms, reviewed_at
`;

export class SqliteReviewRecordRepository
  implements ReviewRecordRepository
{
  readonly #database: DatabaseSync;

  public constructor(database: DatabaseSync) {
    this.#database = database;
  }

  public async append(record: NewReviewRecord): Promise<ReviewRecord> {
    const result = this.#database
      .prepare(`
        INSERT INTO review_records
          (
            learning_item_id, algorithm_id, rating, review_json,
            response_time_ms, reviewed_at
          )
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        record.learningItemId,
        record.algorithmId,
        record.rating,
        JSON.stringify(record.reviewData),
        record.responseTimeMs ?? null,
        record.reviewedAt.toISOString(),
      );
    return defineReviewRecord({
      ...record,
      id: reviewRecordId(toNumber(result.lastInsertRowid)),
    });
  }

  public async list(
    query: ReviewRecordQuery,
  ): Promise<readonly ReviewRecord[]> {
    const clauses = ["learning_item_id = ?"];
    const parameters: number[] = [query.learningItemId];
    let suffix = " ORDER BY reviewed_at DESC, id DESC";

    if (query.limit !== undefined) {
      suffix += " LIMIT ?";
      parameters.push(query.limit);
    } else if (query.offset !== undefined) {
      suffix += " LIMIT -1";
    }

    if (query.offset !== undefined) {
      suffix += " OFFSET ?";
      parameters.push(query.offset);
    }

    const rows = this.#database
      .prepare(`SELECT ${columns} FROM review_records WHERE ${clauses.join(" AND ")}${suffix}`)
      .all(...parameters) as SqliteRow[];
    return Object.freeze(rows.map(mapRecord));
  }
}

function mapRecord(row: SqliteRow): ReviewRecord {
  const responseTime = row["response_time_ms"];
  return defineReviewRecord({
    id: reviewRecordId(requireNumber(row, "id")),
    learningItemId: learningItemId(requireNumber(row, "learning_item_id")),
    algorithmId: learningAlgorithmId(requireNumber(row, "algorithm_id")),
    rating: requireString(row, "rating"),
    reviewData: parseJsonObject(row, "review_json"),
    ...(responseTime === null
      ? {}
      : { responseTimeMs: requireNumber(row, "response_time_ms") }),
    reviewedAt: new Date(requireString(row, "reviewed_at")),
  });
}

