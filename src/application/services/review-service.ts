import type {
  AlgorithmReviewResult,
  JsonObject,
  LearningAlgorithm,
  LearningAlgorithmId,
  LearningItem,
  LearningItemContent,
  LearningItemContentRepository,
  LearningItemId,
  LearningItemRepository,
  LearningState,
  LearningStateRepository,
  ReviewPreview,
  ReviewRecord,
  ReviewRecordRepository,
} from "../../domain/index.js";
import { NotFoundError } from "../errors/index.js";
import type { TransactionRunner } from "../transactions/index.js";

export interface DueReviewItem {
  readonly item: LearningItem;
  readonly contents: readonly LearningItemContent[];
  readonly state: LearningState;
  readonly preview: readonly ReviewPreview[];
}

export interface CompletedReview<
  StateData extends JsonObject,
  ReviewData extends JsonObject,
> {
  readonly outcome: AlgorithmReviewResult<StateData, ReviewData>;
  readonly record: ReviewRecord;
}

export class ReviewService<
  StateData extends JsonObject = JsonObject,
  ReviewData extends JsonObject = JsonObject,
> {
  readonly #items: LearningItemRepository;
  readonly #contents: LearningItemContentRepository;
  readonly #states: LearningStateRepository;
  readonly #records: ReviewRecordRepository;
  readonly #algorithm: LearningAlgorithm<StateData, ReviewData>;
  readonly #algorithmId: LearningAlgorithmId;
  readonly #transactions: TransactionRunner;

  public constructor(dependencies: {
    items: LearningItemRepository;
    contents: LearningItemContentRepository;
    states: LearningStateRepository;
    records: ReviewRecordRepository;
    algorithm: LearningAlgorithm<StateData, ReviewData>;
    algorithmId: LearningAlgorithmId;
    transactions: TransactionRunner;
  }) {
    this.#items = dependencies.items;
    this.#contents = dependencies.contents;
    this.#states = dependencies.states;
    this.#records = dependencies.records;
    this.#algorithm = dependencies.algorithm;
    this.#algorithmId = dependencies.algorithmId;
    this.#transactions = dependencies.transactions;
  }

  public async listDue(
    at: Date = new Date(),
    limit?: number,
  ): Promise<readonly DueReviewItem[]> {
    const states = await this.#states.listDue({
      algorithmId: this.#algorithmId,
      dueAtOrBefore: at,
      ...(limit === undefined ? {} : { limit }),
    });

    return Promise.all(states.map((state) => this.toDueItem(state, at)));
  }

  public async review(input: {
    learningItemId: LearningItemId;
    rating: string;
    reviewedAt?: Date;
    responseTimeMs?: number;
  }): Promise<CompletedReview<StateData, ReviewData>> {
    const reviewedAt = input.reviewedAt ?? new Date();

    return this.#transactions.transaction(async () => {
      const state = await this.#states.findForItem(
        input.learningItemId,
        this.#algorithmId,
      );

      if (state === null) {
        throw new NotFoundError("LearningState", input.learningItemId);
      }

      const outcome = this.#algorithm.review(
        {
          dueAt: state.dueAt,
          stateData: this.#algorithm.parseState(state.stateData),
        },
        input.rating,
        reviewedAt,
      );
      await this.#states.update({
        ...state,
        dueAt: outcome.state.dueAt,
        stateData: outcome.state.stateData,
      });
      const record = await this.#records.append({
        learningItemId: input.learningItemId,
        algorithmId: this.#algorithmId,
        rating: outcome.rating.value,
        reviewData: outcome.reviewData,
        ...(input.responseTimeMs === undefined
          ? {}
          : { responseTimeMs: input.responseTimeMs }),
        reviewedAt,
      });

      return Object.freeze({ outcome, record });
    });
  }

  private async toDueItem(
    state: LearningState,
    at: Date,
  ): Promise<DueReviewItem> {
    const item = await this.#items.findById(state.learningItemId);

    if (item === null) {
      throw new NotFoundError("LearningItem", state.learningItemId);
    }

    const stateData = this.#algorithm.parseState(state.stateData);
    const contents = await this.#contents.listForItem(item.id);
    return Object.freeze({
      item,
      contents,
      state,
      preview: this.#algorithm.preview(
        { dueAt: state.dueAt, stateData },
        at,
      ),
    });
  }
}

