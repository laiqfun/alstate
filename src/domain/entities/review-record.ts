import type {
  JsonObject,
  LearningAlgorithmId,
  LearningItemId,
  ReviewRecordId,
} from "../values/index.js";
import {
  requireNonBlank,
  requireNonNegativeNumber,
  requireValidDate,
} from "./validation.js";

export interface ReviewRecord {
  readonly id: ReviewRecordId;
  readonly learningItemId: LearningItemId;
  readonly algorithmId: LearningAlgorithmId;
  readonly rating: string;
  readonly reviewData: JsonObject;
  readonly responseTimeMs?: number;
  readonly reviewedAt: Date;
}

export interface NewReviewRecord {
  readonly learningItemId: LearningItemId;
  readonly algorithmId: LearningAlgorithmId;
  readonly rating: string;
  readonly reviewData: JsonObject;
  readonly responseTimeMs?: number;
  readonly reviewedAt: Date;
}

export function defineReviewRecord(record: ReviewRecord): ReviewRecord {
  requireNonBlank(record.rating, "ReviewRecord.rating");

  if (record.responseTimeMs !== undefined) {
    requireNonNegativeNumber(record.responseTimeMs, "ReviewRecord.responseTimeMs");
  }

  return Object.freeze({
    ...record,
    reviewedAt: requireValidDate(record.reviewedAt, "ReviewRecord.reviewedAt"),
  });
}

