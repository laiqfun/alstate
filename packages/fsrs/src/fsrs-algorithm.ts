import {
  FSRSVersion,
  Rating,
  State,
  TypeConvert,
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card,
  type CardInput,
  type FSRS,
  type FSRSParameters,
  type Grade,
  type ReviewLog,
  type StepUnit,
} from "ts-fsrs";

import type {
  AlgorithmRating,
  AlgorithmReview,
  AlgorithmState,
  JsonObject,
  JsonValue,
  LearningAlgorithm,
  ReviewPreview,
} from "@alstate/core";

export type FsrsStep = `${number}${"d" | "h" | "m"}`;

export interface FsrsOptions {
  readonly requestRetention?: number;
  readonly maximumInterval?: number;
  readonly weights?: readonly number[];
  readonly enableFuzz?: boolean;
  readonly enableShortTerm?: boolean;
  readonly learningSteps?: readonly FsrsStep[];
  readonly relearningSteps?: readonly FsrsStep[];
}

export interface FsrsConfiguration extends JsonObject {
  readonly request_retention: number;
  readonly maximum_interval: number;
  readonly w: readonly number[];
  readonly enable_fuzz: boolean;
  readonly enable_short_term: boolean;
  readonly learning_steps: readonly FsrsStep[];
  readonly relearning_steps: readonly FsrsStep[];
}

export interface FsrsState extends JsonObject {
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

const ratings = Object.freeze([
  Object.freeze({ value: "again", label: "Again" }),
  Object.freeze({ value: "hard", label: "Hard" }),
  Object.freeze({ value: "good", label: "Good" }),
  Object.freeze({ value: "easy", label: "Easy" }),
] as const satisfies readonly AlgorithmRating[]);

const grades = Object.freeze({
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
} as const);

export class FsrsAlgorithm
  implements LearningAlgorithm<FsrsState, FsrsReviewData>
{
  public readonly name = "FSRS";
  public readonly version = FSRSVersion;
  public readonly description = "Free Spaced Repetition Scheduler";
  public readonly ratings = ratings;
  public readonly configuration: FsrsConfiguration;

  readonly #scheduler: FSRS;

  public constructor(options: FsrsOptions = {}) {
    const parameters = generatorParameters(toParameters(options));
    this.#scheduler = fsrs(parameters);
    this.configuration = serializeParameters(parameters);
  }

  public parse(data: JsonObject): FsrsState {
    return parseState(data);
  }

  public initialize(at: Date): AlgorithmState<FsrsState> {
    requireDate(at, "initialization time");
    const card = createEmptyCard(at);
    return Object.freeze({ dueAt: new Date(card.due), data: serializeCard(card) });
  }

  public preview(
    state: AlgorithmState<FsrsState>,
    at: Date,
  ): readonly ReviewPreview[] {
    requireDate(at, "review time");
    const preview = this.#scheduler.repeat(this.readCard(state), at);
    return Object.freeze(
      ratings.map((rating) => ({
        rating,
        dueAt: new Date(preview[grades[rating.value]].card.due),
      })),
    );
  }

  public review(
    state: AlgorithmState<FsrsState>,
    ratingValue: string,
    at: Date,
  ): AlgorithmReview<FsrsState, FsrsReviewData> {
    requireDate(at, "review time");
    const rating = ratings.find((candidate) => candidate.value === ratingValue);
    if (rating === undefined) {
      throw new Error(`Unsupported FSRS rating '${ratingValue}'.`);
    }
    const result = this.#scheduler.next(
      this.readCard(state),
      at,
      grades[rating.value] as Grade,
    );
    return Object.freeze({
      rating,
      state: Object.freeze({
        dueAt: new Date(result.card.due),
        data: serializeCard(result.card),
      }),
      data: serializeReview(result.log),
    });
  }

  private readCard(state: AlgorithmState<FsrsState>): Card {
    const parsed = parseState(state.data);
    const card = TypeConvert.card(toCardInput(parsed));
    if (card.due.getTime() !== state.dueAt.getTime()) {
      throw new Error("FSRS due projection does not match its stored card.");
    }
    return card;
  }
}

function serializeCard(card: Card): FsrsState {
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

function parseState(data: JsonObject): FsrsState {
  const state = integer(data["state"], "state");
  if (state < State.New || state > State.Relearning) {
    throw new Error("FSRS state is outside the supported range.");
  }
  const lastReview = data["last_review"];
  if (lastReview !== null && typeof lastReview !== "string") {
    throw new Error("FSRS last_review must be an ISO date or null.");
  }
  return Object.freeze({
    due: isoString(data["due"], "due"),
    stability: finiteNumber(data["stability"], "stability"),
    difficulty: finiteNumber(data["difficulty"], "difficulty"),
    elapsed_days: integer(data["elapsed_days"], "elapsed_days"),
    scheduled_days: integer(data["scheduled_days"], "scheduled_days"),
    learning_steps: integer(data["learning_steps"], "learning_steps"),
    reps: integer(data["reps"], "reps"),
    lapses: integer(data["lapses"], "lapses"),
    state,
    last_review:
      lastReview === null ? null : isoString(lastReview, "last_review"),
  });
}

function toCardInput(data: FsrsState): CardInput {
  return {
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
}

function serializeReview(log: ReviewLog): FsrsReviewData {
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

function toParameters(options: FsrsOptions): Partial<FSRSParameters> {
  return {
    ...(options.requestRetention === undefined
      ? {}
      : { request_retention: options.requestRetention }),
    ...(options.maximumInterval === undefined
      ? {}
      : { maximum_interval: options.maximumInterval }),
    ...(options.weights === undefined ? {} : { w: [...options.weights] }),
    ...(options.enableFuzz === undefined
      ? {}
      : { enable_fuzz: options.enableFuzz }),
    ...(options.enableShortTerm === undefined
      ? {}
      : { enable_short_term: options.enableShortTerm }),
    ...(options.learningSteps === undefined
      ? {}
      : { learning_steps: [...options.learningSteps] as StepUnit[] }),
    ...(options.relearningSteps === undefined
      ? {}
      : { relearning_steps: [...options.relearningSteps] as StepUnit[] }),
  };
}

function serializeParameters(parameters: FSRSParameters): FsrsConfiguration {
  return Object.freeze({
    request_retention: parameters.request_retention,
    maximum_interval: parameters.maximum_interval,
    w: Object.freeze([...parameters.w]),
    enable_fuzz: parameters.enable_fuzz,
    enable_short_term: parameters.enable_short_term,
    learning_steps: Object.freeze([...parameters.learning_steps]) as readonly FsrsStep[],
    relearning_steps: Object.freeze([...parameters.relearning_steps]) as readonly FsrsStep[],
  });
}

function finiteNumber(value: JsonValue | undefined, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`FSRS ${field} must be a finite number.`);
  }
  return value;
}

function integer(value: JsonValue | undefined, field: string): number {
  const number = finiteNumber(value, field);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`FSRS ${field} must be a non-negative safe integer.`);
  }
  return number;
}

function isoString(value: JsonValue | undefined, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`FSRS ${field} must be an ISO date string.`);
  }
  const date = new Date(value);
  requireDate(date, field);
  return date.toISOString();
}

function requireDate(value: Date, field: string): void {
  if (Number.isNaN(value.getTime())) {
    throw new Error(`FSRS ${field} must be a valid date.`);
  }
}
