# Extending Alstate

English | [简体中文](extending.zh-CN.md)

`@alstate/core` contains no concrete scheduler or persistence technology. An
application can implement either `LearningAlgorithm`, `LearningStore`, or both.

Read [Architecture](architecture.md) first: custom adapters participate in
atomicity, algorithm ownership and optimistic-concurrency guarantees, not just
TypeScript method shapes.

## Implement a scheduling algorithm

The example below schedules fixed intervals. It is deliberately simple and is
not a replacement for FSRS, but it demonstrates the complete contract:

```ts
import type {
  AlgorithmRating,
  AlgorithmState,
  JsonObject,
  LearningAlgorithm,
} from "@alstate/core";

interface IntervalState extends JsonObject {
  readonly reviews: number;
}

interface IntervalReview extends JsonObject {
  readonly previousDueAt: string;
  readonly intervalDays: number;
}

const ratings = [
  { value: "again", label: "Again" },
  { value: "hard", label: "Hard" },
  { value: "good", label: "Good" },
  { value: "easy", label: "Easy" },
] as const satisfies readonly AlgorithmRating[];

type RatingValue = (typeof ratings)[number]["value"];

const intervalDays: Record<RatingValue, number> = {
  again: 0,
  hard: 1,
  good: 3,
  easy: 7,
};

const millisecondsPerDay = 86_400_000;

export class FixedIntervalAlgorithm
  implements LearningAlgorithm<IntervalState, IntervalReview>
{
  public readonly name = "fixed-interval";
  public readonly version = "1";
  public readonly description = "Example fixed-interval scheduler";
  public readonly ratings = ratings;
  public readonly configuration: JsonObject;

  readonly #scale: number;

  public constructor(scale = 1) {
    if (!Number.isFinite(scale) || scale <= 0) {
      throw new TypeError("scale must be positive.");
    }
    this.#scale = scale;
    this.configuration = Object.freeze({ scale });
  }

  public parse(data: JsonObject): IntervalState {
    const reviews = data["reviews"];
    if (
      typeof reviews !== "number" ||
      !Number.isSafeInteger(reviews) ||
      reviews < 0
    ) {
      throw new Error("Interval state has an invalid review count.");
    }
    return Object.freeze({ reviews });
  }

  public initialize(at: Date): AlgorithmState<IntervalState> {
    return Object.freeze({
      dueAt: new Date(at),
      data: Object.freeze({ reviews: 0 }),
    });
  }

  public preview(state: AlgorithmState<IntervalState>, at: Date) {
    this.parse(state.data);
    return Object.freeze(
      ratings.map((rating) =>
        Object.freeze({
          rating,
          dueAt: this.nextDueAt(at, rating.value),
        }),
      ),
    );
  }

  public review(
    state: AlgorithmState<IntervalState>,
    ratingValue: string,
    at: Date,
  ) {
    const current = this.parse(state.data);
    const rating = ratings.find(({ value }) => value === ratingValue);
    if (rating === undefined) throw new Error("Unsupported rating.");

    return Object.freeze({
      rating,
      state: Object.freeze({
        dueAt: this.nextDueAt(at, rating.value),
        data: Object.freeze({ reviews: current.reviews + 1 }),
      }),
      data: Object.freeze({
        previousDueAt: state.dueAt.toISOString(),
        intervalDays: intervalDays[rating.value] * this.#scale,
      }),
    });
  }

  private nextDueAt(at: Date, rating: RatingValue): Date {
    return new Date(
      at.getTime() + intervalDays[rating] * this.#scale * millisecondsPerDay,
    );
  }
}
```

### Algorithm responsibilities

An implementation must satisfy all of these rules:

- `name` and `version` are non-blank persisted identity fields.
- `configuration` is the complete canonical, JSON-compatible configuration
  needed to interpret state. Do not omit behavior-affecting defaults.
- `ratings` is non-empty and every `value` is unique and non-blank.
- `parse` treats storage as an untrusted runtime boundary. Validate every field
  and return typed JSON data; do not rely on a TypeScript assertion alone.
- `initialize`, `preview` and `review` return valid `Date` objects and
  JSON-compatible data.
- `preview` returns only advertised ratings.
- `review` preserves the exact requested rating and does not mutate its input.
- State data contains everything the algorithm needs after a process restart.
  In-memory caches cannot be the only source of scheduling truth.

The engine validates the outer shape, dates, ratings and JSON compatibility of
algorithm output. It cannot validate algorithm-specific state semantics; that
belongs in `parse`.

### Identity and state evolution

Persisted `name`, `version` and canonical `configuration` identify how state is
interpreted. Keep `version` unchanged only when old state retains exactly the
same meaning. A breaking state-format or scheduling-semantics change needs a new
version and an explicit migration strategy in the application.

Alstate `0.1.x` does not provide a general state-migration API. A store must
reject reopening an existing algorithm name with another version or
configuration rather than silently accepting it.

## Implement a store

Implement the `LearningStore` interface exported from `@alstate/core`. The
methods are asynchronous so implementations can use a local database, remote
service or transactional server.

### Required behavior by method

| Method | Required behavior |
| --- | --- |
| `registerAlgorithm` | Create or find a registration by name. Existing version and canonical configuration must match; otherwise throw `AlgorithmMismatchError`. |
| `createItem` | Atomically create one item and its initial state. Never leave an item without that state. |
| `findItem`, `listItems`, `updateItem`, `deleteItem` | Scope every operation to the supplied algorithm ID. Return the documented null/boolean result for absence. |
| `findState` | Return the state only for the item-and-algorithm pair. Include a non-negative monotonic revision. |
| `listDue` | Return only states for the supplied algorithm whose due time is at or before the boundary, respecting `limit`. |
| `commitReview` | Verify state/review identity, compare the supplied stored revision, then atomically update state, increment revision and append exactly one review. |
| `listReviews` | Return only records for the supplied item-and-algorithm pair and document ordering. |
| `close` | Release owned resources and make lifecycle behavior predictable. |

### Optimistic review concurrency

`StateUpdate.state` is the snapshot used to calculate a transition. A store
must compare its `revision` with the current persisted revision. Conceptually:

```sql
UPDATE states
SET due_at = :dueAt,
    state_json = :data,
    revision = revision + 1
WHERE id = :id
  AND revision = :expectedRevision;
```

If the update count is not exactly one, throw `ConcurrentReviewError`. Do not
append the review. The update and review insertion must share one transaction,
including rollback on validation or storage failure.

### Persisted-data validation

A store is a runtime trust boundary. Validate identifiers, revisions, dates and
JSON objects while mapping stored records. Return new `Date` values so callers
cannot mutate internal persistence state through an object reference. Keep
application item data separate from algorithm state and review data.

Canonical configuration comparison must ignore object-key insertion order while
preserving the meaning and order of arrays. It must not use a lossy or
algorithm-specific reinterpretation.

### Deletion and history

Review records are immutable during an item's lifetime. `deleteItem` may remove
the complete item aggregate—item, state and history—as the SQLite adapter does.
Document any retention behavior if another store deliberately differs.

## Test an adapter

At minimum, add tests for:

- a complete add, due, review and history workflow through `LearningEngine`;
- malformed configuration, state, dates and JSON values;
- algorithm name/version/configuration mismatches;
- item isolation between two algorithms;
- atomic rollback when initial-state creation fails;
- atomic rollback when review-record insertion fails;
- two reviews based on one revision, proving exactly one succeeds;
- persistence across close and reopen, if the store is durable;
- pagination, ordering and missing-item behavior.

Application code can compose a custom adapter with either first-party adapter.
Keep dependency direction one-way: an adapter may depend on `@alstate/core`, but
core must never depend on the adapter.
