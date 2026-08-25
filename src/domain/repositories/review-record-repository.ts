import type { NewReviewRecord, ReviewRecord } from "../entities/index.js";
import type { LearningItemId } from "../values/index.js";

export interface ReviewRecordQuery {
  readonly learningItemId: LearningItemId;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ReviewRecordRepository {
  append(record: NewReviewRecord): Promise<ReviewRecord>;
  list(query: ReviewRecordQuery): Promise<readonly ReviewRecord[]>;
}

