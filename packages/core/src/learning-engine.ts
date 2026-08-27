import {
  AlgorithmContractError,
  ItemNotFoundError,
  UnsupportedRatingError,
} from "./errors.js";
import type {
  AlgorithmReview,
  LearningAlgorithm,
  ReviewPreview,
} from "./learning-algorithm.js";
import type { LearningStore } from "./learning-store.js";
import type {
  JsonObject,
  LearningItem,
  LearningItemId,
  PageQuery,
  ReviewRecord,
} from "./types.js";

export interface DueItem {
  readonly item: LearningItem;
  readonly dueAt: Date;
  readonly preview: readonly ReviewPreview[];
}

export interface CompletedReview<
  StateData extends JsonObject,
  ReviewData extends JsonObject,
> {
  readonly outcome: AlgorithmReview<StateData, ReviewData>;
  readonly record: ReviewRecord;
}

export class LearningEngine<
  StateData extends JsonObject = JsonObject,
  ReviewData extends JsonObject = JsonObject,
> {
  readonly #store: LearningStore;
  readonly #algorithm: LearningAlgorithm<StateData, ReviewData>;
  readonly #algorithmId;

  private constructor(
    store: LearningStore,
    algorithm: LearningAlgorithm<StateData, ReviewData>,
    algorithmId: Awaited<ReturnType<LearningStore["registerAlgorithm"]>>["id"],
  ) {
    this.#store = store;
    this.#algorithm = algorithm;
    this.#algorithmId = algorithmId;
  }

  public static async create<
    StateData extends JsonObject,
    ReviewData extends JsonObject,
  >(options: {
    readonly store: LearningStore;
    readonly algorithm: LearningAlgorithm<StateData, ReviewData>;
  }): Promise<LearningEngine<StateData, ReviewData>> {
    validateAlgorithm(options.algorithm);
    const registered = await options.store.registerAlgorithm({
      name: options.algorithm.name,
      version: options.algorithm.version,
      ...(options.algorithm.description === undefined
        ? {}
        : { description: options.algorithm.description }),
      configuration: options.algorithm.configuration,
    });
    return new LearningEngine(options.store, options.algorithm, registered.id);
  }

  public get algorithm(): LearningAlgorithm<StateData, ReviewData> {
    return this.#algorithm;
  }

  public async add(
    data: JsonObject = {},
    at: Date = new Date(),
  ): Promise<LearningItem> {
    assertJsonObject(data, "item data", "input");
    const initialAt = validDate(at, "initialization time", "input");
    const initial = this.#algorithm.initialize(initialAt);
    validateAlgorithmState(initial, "initial state");
    return this.#store.createItem({
      data,
      algorithmId: this.#algorithmId,
      dueAt: initial.dueAt,
      stateData: initial.data,
    });
  }

  public async get(id: LearningItemId): Promise<LearningItem> {
    const item = await this.#store.findItem(id, this.#algorithmId);
    if (item === null) {
      throw new ItemNotFoundError(id);
    }
    return item;
  }

  public list(query?: PageQuery): Promise<readonly LearningItem[]> {
    return this.#store.listItems(this.#algorithmId, query);
  }

  public async update(
    id: LearningItemId,
    data: JsonObject,
  ): Promise<LearningItem> {
    assertJsonObject(data, "item data", "input");
    const item = await this.#store.updateItem(id, this.#algorithmId, data);
    if (item === null) {
      throw new ItemNotFoundError(id);
    }
    return item;
  }

  public remove(id: LearningItemId): Promise<boolean> {
    return this.#store.deleteItem(id, this.#algorithmId);
  }

  public async due(
    at: Date = new Date(),
    limit?: number,
  ): Promise<readonly DueItem[]> {
    const dueAt = validDate(at, "due query time", "input");
    const dueItems = await this.#store.listDue({
      algorithmId: this.#algorithmId,
      dueAtOrBefore: dueAt,
      ...(limit === undefined ? {} : { limit }),
    });

    return Object.freeze(
      dueItems.map(({ item, state }) => {
        const parsed = this.#algorithm.parse(state.data);
        assertJsonObject(parsed, "parsed algorithm state");
        const algorithmState = {
          dueAt: state.dueAt,
          data: parsed,
        };
        const preview = this.#algorithm.preview(algorithmState, dueAt);
        validatePreview(preview, this.#algorithm);
        return Object.freeze({
          item,
          dueAt: new Date(state.dueAt),
          preview,
        });
      }),
    );
  }

  public async review(
    itemId: LearningItemId,
    rating: string,
    options: {
      readonly at?: Date;
      readonly responseTimeMs?: number;
    } = {},
  ): Promise<CompletedReview<StateData, ReviewData>> {
    requireSupportedRating(rating, this.#algorithm);
    const at = validDate(options.at ?? new Date(), "review time", "input");
    validateResponseTime(options.responseTimeMs);
    const state = await this.#store.findState(itemId, this.#algorithmId);
    if (state === null) {
      throw new ItemNotFoundError(itemId);
    }
    const parsed = this.#algorithm.parse(state.data);
    assertJsonObject(parsed, "parsed algorithm state");
    const outcome = this.#algorithm.review(
      { dueAt: state.dueAt, data: parsed },
      rating,
      at,
    );
    validateAlgorithmReview(outcome, rating, this.#algorithm);
    const record = await this.#store.commitReview({
      state: {
        state,
        dueAt: outcome.state.dueAt,
        data: outcome.state.data,
      },
      review: {
        learningItemId: itemId,
        algorithmId: this.#algorithmId,
        rating: outcome.rating.value,
        data: outcome.data,
        reviewedAt: at,
        ...(options.responseTimeMs === undefined
          ? {}
          : { responseTimeMs: options.responseTimeMs }),
      },
    });
    return Object.freeze({ outcome, record });
  }

  public async history(
    itemId: LearningItemId,
    query?: PageQuery,
  ): Promise<readonly ReviewRecord[]> {
    await this.get(itemId);
    return this.#store.listReviews(itemId, this.#algorithmId, query);
  }

  public close(): void {
    this.#store.close();
  }
}

function validateAlgorithm(algorithm: LearningAlgorithm): void {
  requireNonBlank(algorithm.name, "algorithm name");
  requireNonBlank(algorithm.version, "algorithm version");
  assertJsonObject(algorithm.configuration, "algorithm configuration");
  if (!Array.isArray(algorithm.ratings) || algorithm.ratings.length === 0) {
    throw new AlgorithmContractError("ratings must be a non-empty array.");
  }
  const values = new Set<string>();
  for (const rating of algorithm.ratings) {
    requireNonBlank(rating.value, "rating value");
    requireNonBlank(rating.label, "rating label");
    if (values.has(rating.value)) {
      throw new AlgorithmContractError(`rating '${rating.value}' is duplicated.`);
    }
    values.add(rating.value);
  }
}

function validateAlgorithmState(value: unknown, field: string): void {
  if (value === null || typeof value !== "object") {
    throw new AlgorithmContractError(`${field} must be an object.`);
  }
  const state = value as { readonly dueAt?: unknown; readonly data?: unknown };
  validDate(state.dueAt, `${field} due time`);
  assertJsonObject(state.data, `${field} data`);
}

function validatePreview(
  value: unknown,
  algorithm: LearningAlgorithm,
): asserts value is readonly ReviewPreview[] {
  if (!Array.isArray(value)) {
    throw new AlgorithmContractError("preview must return an array.");
  }
  for (const entry of value) {
    if (entry === null || typeof entry !== "object") {
      throw new AlgorithmContractError("preview entries must be objects.");
    }
    const preview = entry as { readonly rating?: unknown; readonly dueAt?: unknown };
    if (preview.rating === null || typeof preview.rating !== "object") {
      throw new AlgorithmContractError("preview rating must be an object.");
    }
    const rating = preview.rating as { readonly value?: unknown };
    if (
      typeof rating.value !== "string" ||
      !algorithm.ratings.some((candidate) => candidate.value === rating.value)
    ) {
      throw new AlgorithmContractError("preview returned an unknown rating.");
    }
    validDate(preview.dueAt, "preview due time");
  }
}

function validateAlgorithmReview(
  value: unknown,
  requestedRating: string,
  algorithm: LearningAlgorithm,
): void {
  if (value === null || typeof value !== "object") {
    throw new AlgorithmContractError("review result must be an object.");
  }
  const review = value as {
    readonly rating?: { readonly value?: unknown };
    readonly state?: unknown;
    readonly data?: unknown;
  };
  if (
    review.rating === undefined ||
    review.rating.value !== requestedRating ||
    !algorithm.ratings.some((rating) => rating.value === review.rating?.value)
  ) {
    throw new AlgorithmContractError("review result must preserve the requested rating.");
  }
  validateAlgorithmState(review.state, "review state");
  assertJsonObject(review.data, "review data");
}

function requireSupportedRating(
  rating: string,
  algorithm: LearningAlgorithm,
): void {
  if (!algorithm.ratings.some((candidate) => candidate.value === rating)) {
    throw new UnsupportedRatingError(rating);
  }
}

function requireNonBlank(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AlgorithmContractError(`${field} must not be blank.`);
  }
}

type ValidationSource = "algorithm" | "input";

function validDate(
  value: unknown,
  field: string,
  source: ValidationSource = "algorithm",
): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw validationError(source, `${field} must be a valid Date.`);
  }
  return new Date(value);
}

function validateResponseTime(value: number | undefined): void {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
    throw new TypeError("responseTimeMs must be a non-negative number.");
  }
}

function assertJsonObject(
  value: unknown,
  field: string,
  source: ValidationSource = "algorithm",
): asserts value is JsonObject {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw validationError(source, `${field} must be a JSON object.`);
  }
  validateJsonValue(value, field, new Set<object>(), source);
}

function validateJsonValue(
  value: unknown,
  field: string,
  ancestors: Set<object>,
  source: ValidationSource,
): void {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw validationError(source, `${field} contains a non-finite number.`);
    }
    return;
  }
  if (typeof value !== "object") {
    throw validationError(source, `${field} contains a non-JSON value.`);
  }
  if (ancestors.has(value)) {
    throw validationError(source, `${field} contains a circular reference.`);
  }
  if (!Array.isArray(value)) {
    const prototype = Object.getPrototypeOf(value) as unknown;
    if (prototype !== Object.prototype && prototype !== null) {
      throw validationError(source, `${field} contains a non-plain object.`);
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw validationError(source, `${field} contains symbol properties.`);
    }
  }
  ancestors.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!(index in value)) {
        throw validationError(source, `${field} contains a sparse array.`);
      }
      validateJsonValue(value[index], field, ancestors, source);
    }
  } else {
    for (const entry of Object.values(value)) {
      validateJsonValue(entry, field, ancestors, source);
    }
  }
  ancestors.delete(value);
}

function validationError(source: ValidationSource, message: string): Error {
  return source === "algorithm"
    ? new AlgorithmContractError(message)
    : new TypeError(message);
}
