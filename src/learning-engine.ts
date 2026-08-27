import { ItemNotFoundError } from "./errors.js";
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
    const initial = this.#algorithm.initialize(at);
    return this.#store.createItem({
      data,
      algorithmId: this.#algorithmId,
      dueAt: initial.dueAt,
      stateData: initial.data,
    });
  }

  public async get(id: LearningItemId): Promise<LearningItem> {
    const item = await this.#store.findItem(id);
    if (item === null) {
      throw new ItemNotFoundError(id);
    }
    return item;
  }

  public list(query?: PageQuery): Promise<readonly LearningItem[]> {
    return this.#store.listItems(query);
  }

  public async update(
    id: LearningItemId,
    data: JsonObject,
  ): Promise<LearningItem> {
    const item = await this.#store.updateItem(id, data);
    if (item === null) {
      throw new ItemNotFoundError(id);
    }
    return item;
  }

  public remove(id: LearningItemId): Promise<boolean> {
    return this.#store.deleteItem(id);
  }

  public async due(
    at: Date = new Date(),
    limit?: number,
  ): Promise<readonly DueItem[]> {
    const dueItems = await this.#store.listDue({
      algorithmId: this.#algorithmId,
      dueAtOrBefore: at,
      ...(limit === undefined ? {} : { limit }),
    });

    return Object.freeze(
      dueItems.map(({ item, state }) => {
        const algorithmState = {
          dueAt: state.dueAt,
          data: this.#algorithm.parse(state.data),
        };
        return Object.freeze({
          item,
          dueAt: new Date(state.dueAt),
          preview: this.#algorithm.preview(algorithmState, at),
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
    const at = options.at ?? new Date();
    const state = await this.#store.findState(itemId, this.#algorithmId);
    if (state === null) {
      throw new ItemNotFoundError(itemId);
    }
    const outcome = this.#algorithm.review(
      { dueAt: state.dueAt, data: this.#algorithm.parse(state.data) },
      rating,
      at,
    );
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
    return this.#store.listReviews(itemId, query);
  }

  public close(): void {
    this.#store.close();
  }
}
