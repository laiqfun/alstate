import type { JsonObject } from "../values/index.js";

export interface AlgorithmRating {
  readonly value: string;
  readonly label: string;
}

export interface AlgorithmStateSnapshot<StateData extends JsonObject = JsonObject> {
  readonly dueAt: Date;
  readonly stateData: StateData;
}

export interface ReviewPreview {
  readonly rating: AlgorithmRating;
  readonly dueAt: Date;
}

export interface AlgorithmReviewResult<
  StateData extends JsonObject = JsonObject,
  ReviewData extends JsonObject = JsonObject,
> {
  readonly rating: AlgorithmRating;
  readonly state: AlgorithmStateSnapshot<StateData>;
  readonly reviewData: ReviewData;
}

export interface LearningAlgorithm<
  StateData extends JsonObject = JsonObject,
  ReviewData extends JsonObject = JsonObject,
> {
  readonly name: string;
  readonly version: string;
  readonly ratings: readonly AlgorithmRating[];

  initialize(at: Date): AlgorithmStateSnapshot<StateData>;

  preview(
    state: AlgorithmStateSnapshot<StateData>,
    reviewedAt: Date,
  ): readonly ReviewPreview[];

  review(
    state: AlgorithmStateSnapshot<StateData>,
    rating: string,
    reviewedAt: Date,
  ): AlgorithmReviewResult<StateData, ReviewData>;

  retrievability(
    state: AlgorithmStateSnapshot<StateData>,
    at: Date,
  ): number | null;
}

