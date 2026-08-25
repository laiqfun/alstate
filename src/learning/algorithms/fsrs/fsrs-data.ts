import { State, TypeConvert, type Card, type CardInput, type ReviewLog } from "ts-fsrs";

import type { JsonObject, JsonValue } from "../../../domain/index.js";
import { FsrsAlgorithmError } from "./fsrs-algorithm-error.js";

export interface FsrsStateData extends JsonObject {
  readonly due: string;
  readonly stability: number;
  readonly difficulty: number;
  readonly elapsed_days: number;
  readonly scheduled_days: number;
  readonly learning_steps: number;
  readonly reps: number;
  readonly lapses: number;
  readonly state: number;
  readonly last_review: string | null;
}

export interface FsrsReviewData extends JsonObject {
  readonly rating: number;
  readonly state: number;
  readonly due: string;
  readonly stability: number;
  readonly difficulty: number;
  readonly elapsed_days: number;
  readonly last_elapsed_days: number;
  readonly scheduled_days: number;
  readonly learning_steps: number;
  readonly review: string;
}

export function serializeFsrsCard(card: Card): FsrsStateData {
  return Object.freeze({
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.toISOString() ?? null,
  });
}

export function parseFsrsStateData(data: JsonObject): FsrsStateData {
  const state = requireInteger(data["state"], "state");

  if (state < State.New || state > State.Relearning) {
    throw new FsrsAlgorithmError("FSRS state is outside the supported range.");
  }

  const lastReview = data["last_review"];

  if (lastReview !== null && typeof lastReview !== "string") {
    throw new FsrsAlgorithmError("FSRS last_review must be an ISO date or null.");
  }

  return Object.freeze({
    due: requireIsoDate(data["due"], "due"),
    stability: requireNumber(data["stability"], "stability"),
    difficulty: requireNumber(data["difficulty"], "difficulty"),
    elapsed_days: requireInteger(data["elapsed_days"], "elapsed_days"),
    scheduled_days: requireInteger(data["scheduled_days"], "scheduled_days"),
    learning_steps: requireInteger(data["learning_steps"], "learning_steps"),
    reps: requireInteger(data["reps"], "reps"),
    lapses: requireInteger(data["lapses"], "lapses"),
    state,
    last_review:
      lastReview === null ? null : requireIsoDate(lastReview, "last_review"),
  });
}

export function deserializeFsrsCard(data: FsrsStateData): Card {
  const input: CardInput = {
    due: data.due,
    stability: data.stability,
    difficulty: data.difficulty,
    elapsed_days: data.elapsed_days,
    scheduled_days: data.scheduled_days,
    learning_steps: data.learning_steps,
    reps: data.reps,
    lapses: data.lapses,
    state: data.state as State,
    last_review: data.last_review,
  };

  return TypeConvert.card(input);
}

export function serializeFsrsReviewLog(log: ReviewLog): FsrsReviewData {
  return Object.freeze({
    rating: log.rating,
    state: log.state,
    due: log.due.toISOString(),
    stability: log.stability,
    difficulty: log.difficulty,
    elapsed_days: log.elapsed_days,
    last_elapsed_days: log.last_elapsed_days,
    scheduled_days: log.scheduled_days,
    learning_steps: log.learning_steps,
    review: log.review.toISOString(),
  });
}

function requireNumber(value: JsonValue | undefined, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new FsrsAlgorithmError(`FSRS ${field} must be a finite number.`);
  }

  return value;
}

function requireInteger(value: JsonValue | undefined, field: string): number {
  const number = requireNumber(value, field);

  if (!Number.isSafeInteger(number) || number < 0) {
    throw new FsrsAlgorithmError(
      `FSRS ${field} must be a non-negative safe integer.`,
    );
  }

  return number;
}

function requireIsoDate(value: JsonValue | undefined, field: string): string {
  if (typeof value !== "string") {
    throw new FsrsAlgorithmError(`FSRS ${field} must be an ISO date string.`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new FsrsAlgorithmError(`FSRS ${field} must be a valid ISO date.`);
  }

  return date.toISOString();
}

