import type { JsonObject } from "./types.js";

export interface AlgorithmRating {
  readonly value: string;
  readonly label: string;
}

export interface AlgorithmState<StateData extends JsonObject = JsonObject> {
  readonly dueAt: Date;
  readonly data: StateData;
}

export interface ReviewPreview {
  readonly rating: AlgorithmRating;
  readonly dueAt: Date;
}

export interface AlgorithmReview<
  StateData extends JsonObject = JsonObject,
  ReviewData extends JsonObject = JsonObject,
> {
  readonly rating: AlgorithmRating;
  readonly state: AlgorithmState<StateData>;
  readonly data: ReviewData;
}

export interface LearningAlgorithm<
  StateData extends JsonObject = JsonObject,
  ReviewData extends JsonObject = JsonObject,
> {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly configuration: JsonObject;
  readonly ratings: readonly AlgorithmRating[];

  parse(data: JsonObject): StateData;
  initialize(at: Date): AlgorithmState<StateData>;
  preview(
    state: AlgorithmState<StateData>,
    at: Date,
  ): readonly ReviewPreview[];
  review(
    state: AlgorithmState<StateData>,
    rating: string,
    at: Date,
  ): AlgorithmReview<StateData, ReviewData>;
}
