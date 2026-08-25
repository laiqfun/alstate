import {
  FSRSVersion,
  Rating,
  createEmptyCard,
  fsrs,
  generatorParameters,
  type FSRS,
  type FSRSParameters,
  type Grade,
  type Card,
  type StepUnit,
} from "ts-fsrs";

import type {
  AlgorithmRating,
  AlgorithmReviewResult,
  AlgorithmStateSnapshot,
  JsonObject,
  LearningAlgorithm,
  ReviewPreview,
} from "../../../domain/index.js";
import { FsrsAlgorithmError } from "./fsrs-algorithm-error.js";
import {
  deserializeFsrsCard,
  parseFsrsStateData,
  serializeFsrsCard,
  serializeFsrsReviewLog,
  type FsrsReviewData,
  type FsrsStateData,
} from "./fsrs-data.js";

export type FsrsStep = `${number}${"d" | "h" | "m"}`;

export interface FsrsAlgorithmOptions {
  readonly requestRetention?: number;
  readonly maximumInterval?: number;
  readonly weights?: readonly number[];
  readonly enableFuzz?: boolean;
  readonly enableShortTerm?: boolean;
  readonly learningSteps?: readonly FsrsStep[];
  readonly relearningSteps?: readonly FsrsStep[];
}

export interface FsrsConfigData extends JsonObject {
  readonly request_retention: number;
  readonly maximum_interval: number;
  readonly w: readonly number[];
  readonly enable_fuzz: boolean;
  readonly enable_short_term: boolean;
  readonly learning_steps: readonly FsrsStep[];
  readonly relearning_steps: readonly FsrsStep[];
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

export class FsrsLearningAlgorithm
  implements LearningAlgorithm<FsrsStateData, FsrsReviewData>
{
  public readonly name = "FSRS";
  public readonly version = FSRSVersion;
  public readonly ratings = ratings;
  public readonly configuration: FsrsConfigData;

  readonly #scheduler: FSRS;

  public constructor(options: FsrsAlgorithmOptions = {}) {
    const parameters = generatorParameters(toFsrsParameters(options));
    this.#scheduler = fsrs(parameters);
    this.configuration = serializeParameters(parameters);
  }

  public parseState(data: JsonObject): FsrsStateData {
    return parseFsrsStateData(data);
  }

  public initialize(at: Date): AlgorithmStateSnapshot<FsrsStateData> {
    requireValidDate(at, "initialization time");
    const card = createEmptyCard(at);
    const stateData = serializeFsrsCard(card);

    return Object.freeze({ dueAt: new Date(card.due), stateData });
  }

  public preview(
    state: AlgorithmStateSnapshot<FsrsStateData>,
    reviewedAt: Date,
  ): readonly ReviewPreview[] {
    requireValidDate(reviewedAt, "review time");
    const card = this.readCard(state);
    const preview = this.#scheduler.repeat(card, reviewedAt);

    return Object.freeze(
      ratings.map((rating) => ({
        rating,
        dueAt: new Date(preview[grades[rating.value]].card.due),
      })),
    );
  }

  public review(
    state: AlgorithmStateSnapshot<FsrsStateData>,
    ratingValue: string,
    reviewedAt: Date,
  ): AlgorithmReviewResult<FsrsStateData, FsrsReviewData> {
    requireValidDate(reviewedAt, "review time");
    const rating = ratings.find((candidate) => candidate.value === ratingValue);

    if (rating === undefined) {
      throw new FsrsAlgorithmError(`Unsupported FSRS rating '${ratingValue}'.`);
    }

    const result = this.#scheduler.next(
      this.readCard(state),
      reviewedAt,
      grades[rating.value] as Grade,
    );
    const stateData = serializeFsrsCard(result.card);

    return Object.freeze({
      rating,
      state: Object.freeze({
        dueAt: new Date(result.card.due),
        stateData,
      }),
      reviewData: serializeFsrsReviewLog(result.log),
    });
  }

  public retrievability(
    state: AlgorithmStateSnapshot<FsrsStateData>,
    at: Date,
  ): number | null {
    requireValidDate(at, "retrievability time");
    const card = this.readCard(state);

    if (card.state === 0) {
      return null;
    }

    return this.#scheduler.get_retrievability(card, at, false);
  }

  private readCard(state: AlgorithmStateSnapshot<FsrsStateData>): Card {
    const parsed = parseFsrsStateData(state.stateData);
    const card = deserializeFsrsCard(parsed);

    if (card.due.getTime() !== state.dueAt.getTime()) {
      throw new FsrsAlgorithmError(
        "FSRS dueAt projection does not match the persisted card state.",
      );
    }

    return card;
  }
}

function toFsrsParameters(
  options: FsrsAlgorithmOptions,
): Partial<FSRSParameters> {
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

function serializeParameters(parameters: FSRSParameters): FsrsConfigData {
  return Object.freeze({
    request_retention: parameters.request_retention,
    maximum_interval: parameters.maximum_interval,
    w: Object.freeze([...parameters.w]),
    enable_fuzz: parameters.enable_fuzz,
    enable_short_term: parameters.enable_short_term,
    learning_steps: Object.freeze([...parameters.learning_steps]) as readonly FsrsStep[],
    relearning_steps: Object.freeze([
      ...parameters.relearning_steps,
    ]) as readonly FsrsStep[],
  });
}

function requireValidDate(value: Date, field: string): void {
  if (Number.isNaN(value.getTime())) {
    throw new FsrsAlgorithmError(`FSRS ${field} must be a valid date.`);
  }
}
