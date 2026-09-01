# API reference

English | [简体中文](api-reference.zh-CN.md)

Alstate publishes ESM entry points only. Import public API from package roots;
package-internal file paths are not public API.

## `@alstate/core`

### `LearningEngine`

```ts
class LearningEngine<
  StateData extends JsonObject = JsonObject,
  ReviewData extends JsonObject = JsonObject,
>
```

The engine coordinates one `LearningStore` with one registered
`LearningAlgorithm`. Its generic parameters are inferred from the algorithm.

#### `LearningEngine.create(options)`

```ts
static create<StateData extends JsonObject, ReviewData extends JsonObject>(
  options: {
    readonly store: LearningStore;
    readonly algorithm: LearningAlgorithm<StateData, ReviewData>;
  },
): Promise<LearningEngine<StateData, ReviewData>>
```

Validates the algorithm contract, registers its name, version and configuration
with the store, and returns a bound engine. A store may reject an incompatible
existing registration with `AlgorithmMismatchError`.

#### `engine.algorithm`

```ts
get algorithm(): LearningAlgorithm<StateData, ReviewData>
```

Returns the active algorithm. Applications can read `ratings`, `description`
and the resolved `configuration` from it.

#### `engine.add(data?, at?)`

```ts
add(data: JsonObject = {}, at: Date = new Date()): Promise<LearningItem>
```

Validates application data, asks the algorithm for initial state, validates that
state, and atomically stores the item and state. `at` is the initialization time.

#### `engine.get(id)`

```ts
get(id: LearningItemId): Promise<LearningItem>
```

Returns an item in the active algorithm's scope. Throws `ItemNotFoundError` if
it is missing or belongs to another algorithm.

#### `engine.list(query?)`

```ts
list(query?: PageQuery): Promise<readonly LearningItem[]>
```

Lists items in the active algorithm's scope. Ordering and pagination execution
are defined by the store; the SQLite adapter orders by item ID ascending.

#### `engine.update(id, data)`

```ts
update(id: LearningItemId, data: JsonObject): Promise<LearningItem>
```

Validates and replaces the item's complete application-data object. It does not
merge fields. Throws `ItemNotFoundError` when the item is outside the active
scope.

#### `engine.remove(id)`

```ts
remove(id: LearningItemId): Promise<boolean>
```

Removes an item in the active scope. Returns `true` when it was removed and
`false` when it was not found. Stores are responsible for cleaning up associated
state and reviews.

#### `engine.due(at?, limit?)`

```ts
due(at: Date = new Date(), limit?: number): Promise<readonly DueItem[]>
```

Lists items whose stored due time is at or before `at`. For every stored state,
the engine calls the algorithm's `parse` and `preview` methods. The optional
limit is passed to the store.

```ts
interface DueItem {
  readonly item: LearningItem;
  readonly dueAt: Date;
  readonly preview: readonly ReviewPreview[];
}
```

`dueAt` is the current stored due time. Each preview contains one supported
rating and the due time that would result if reviewed at the query time.

#### `engine.review(itemId, rating, options?)`

```ts
review(
  itemId: LearningItemId,
  rating: string,
  options?: {
    readonly at?: Date;
    readonly responseTimeMs?: number;
  },
): Promise<CompletedReview<StateData, ReviewData>>
```

Loads and parses current state, calculates the transition, validates the
algorithm result, and asks the store to atomically update state and append a
review. `at` defaults to now. `responseTimeMs`, when supplied, must be a finite
non-negative number.

```ts
interface CompletedReview<
  StateData extends JsonObject,
  ReviewData extends JsonObject,
> {
  readonly outcome: AlgorithmReview<StateData, ReviewData>;
  readonly record: ReviewRecord;
}
```

The engine validates that `rating` is advertised by the algorithm before
loading state. It does not enforce that the item is currently due.

#### `engine.history(itemId, query?)`

```ts
history(
  itemId: LearningItemId,
  query?: PageQuery,
): Promise<readonly ReviewRecord[]>
```

Verifies item ownership and returns its review records. Ordering is defined by
the store; SQLite returns newest first.

#### `engine.close()`

```ts
close(): void
```

Calls `close()` on the supplied store. Do not continue using the engine or its
store afterward.

### JSON types

```ts
type JsonPrimitive = boolean | number | string | null;
type JsonArray = readonly JsonValue[];
interface JsonObject {
  readonly [key: string]: JsonValue;
}
type JsonValue = JsonPrimitive | JsonArray | JsonObject;
```

At runtime the engine additionally requires finite numbers, dense arrays,
plain objects, string-keyed properties and no circular references. Item data,
algorithm configuration, algorithm state and review data must all cross this
JSON boundary.

### Identifier types and constructors

```ts
declare const brand: unique symbol; // conceptual; the real symbol is internal

type LearningItemId = number & { readonly [brand]: "LearningItem" };
type AlgorithmId = number & { readonly [brand]: "Algorithm" };
type LearningStateId = number & { readonly [brand]: "LearningState" };
type ReviewRecordId = number & { readonly [brand]: "ReviewRecord" };

learningItemId(value: number): LearningItemId;
algorithmId(value: number): AlgorithmId;
learningStateId(value: number): LearningStateId;
reviewRecordId(value: number): ReviewRecordId;
```

Branding prevents accidentally mixing identifier kinds in TypeScript. Each
constructor accepts only a positive safe integer and throws `TypeError`
otherwise. Most applications only need `learningItemId` when parsing an ID at
an external boundary; stores use all four helpers while mapping persisted data.

### Persisted domain values

```ts
interface LearningItem {
  readonly id: LearningItemId;
  readonly data: JsonObject;
}

interface LearningState {
  readonly id: LearningStateId;
  readonly learningItemId: LearningItemId;
  readonly algorithmId: AlgorithmId;
  readonly revision: number;
  readonly dueAt: Date;
  readonly data: JsonObject;
}

interface ReviewRecord {
  readonly id: ReviewRecordId;
  readonly learningItemId: LearningItemId;
  readonly algorithmId: AlgorithmId;
  readonly rating: string;
  readonly data: JsonObject;
  readonly reviewedAt: Date;
  readonly responseTimeMs?: number;
}

interface PageQuery {
  readonly limit?: number;
  readonly offset?: number;
}
```

`LearningItem.data` is application-owned. `LearningState.data` and
`ReviewRecord.data` are algorithm-owned. Applications should not rewrite
algorithm state directly.

### Algorithm contract

```ts
interface AlgorithmRating {
  readonly value: string;
  readonly label: string;
}

interface AlgorithmState<StateData extends JsonObject = JsonObject> {
  readonly dueAt: Date;
  readonly data: StateData;
}

interface ReviewPreview {
  readonly rating: AlgorithmRating;
  readonly dueAt: Date;
}

interface AlgorithmReview<
  StateData extends JsonObject = JsonObject,
  ReviewData extends JsonObject = JsonObject,
> {
  readonly rating: AlgorithmRating;
  readonly state: AlgorithmState<StateData>;
  readonly data: ReviewData;
}

interface LearningAlgorithm<
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
```

Names and versions must be non-blank, ratings must be a non-empty list with
unique non-blank values, and all dates and JSON outputs must be valid. A review
result must preserve the requested rating. See [Extending Alstate](extending.md)
for a complete example and versioning rules.

### Store contract

`LearningStore` is asynchronous even when its implementation is local:

```ts
interface AlgorithmRegistration {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly configuration: JsonObject;
}

interface RegisteredAlgorithm extends AlgorithmRegistration {
  readonly id: AlgorithmId;
}

interface NewItemWithState {
  readonly data: JsonObject;
  readonly algorithmId: AlgorithmId;
  readonly dueAt: Date;
  readonly stateData: JsonObject;
}

interface DueStoredItem {
  readonly item: LearningItem;
  readonly state: LearningState;
}

interface StateUpdate {
  readonly state: LearningState;
  readonly dueAt: Date;
  readonly data: JsonObject;
}

interface NewReviewRecord {
  readonly learningItemId: LearningItemId;
  readonly algorithmId: AlgorithmId;
  readonly rating: string;
  readonly data: JsonObject;
  readonly reviewedAt: Date;
  readonly responseTimeMs?: number;
}
```

`StateUpdate.state` is the previously loaded state snapshot, including the
revision that must still be current. `dueAt` and `data` are its proposed next
values.

```ts
interface LearningStore {
  registerAlgorithm(registration: AlgorithmRegistration): Promise<RegisteredAlgorithm>;
  createItem(input: NewItemWithState): Promise<LearningItem>;
  findItem(id: LearningItemId, algorithmId: AlgorithmId): Promise<LearningItem | null>;
  listItems(algorithmId: AlgorithmId, query?: PageQuery): Promise<readonly LearningItem[]>;
  updateItem(id: LearningItemId, algorithmId: AlgorithmId, data: JsonObject): Promise<LearningItem | null>;
  deleteItem(id: LearningItemId, algorithmId: AlgorithmId): Promise<boolean>;
  findState(itemId: LearningItemId, algorithmId: AlgorithmId): Promise<LearningState | null>;
  listDue(input: {
    readonly algorithmId: AlgorithmId;
    readonly dueAtOrBefore: Date;
    readonly limit?: number;
  }): Promise<readonly DueStoredItem[]>;
  commitReview(input: {
    readonly state: StateUpdate;
    readonly review: NewReviewRecord;
  }): Promise<ReviewRecord>;
  listReviews(
    itemId: LearningItemId,
    algorithmId: AlgorithmId,
    query?: PageQuery,
  ): Promise<readonly ReviewRecord[]>;
  close(): void;
}
```

`createItem` must atomically create the item and its initial state.
`commitReview` must compare `StateUpdate.state.revision`, atomically update state
and append one review, and reject stale revisions. Every item operation must be
scoped by `algorithmId`. The [extension guide](extending.md) gives the complete
store checklist.

### Errors

| Error | Meaning |
| --- | --- |
| `LearningEngineError` | Base class for engine-specific errors. |
| `ItemNotFoundError` | The item is missing from the active algorithm's scope. |
| `AlgorithmMismatchError` | An algorithm name is already stored with another version or canonical configuration. |
| `AlgorithmContractError` | An algorithm definition or output violates the core contract. |
| `UnsupportedRatingError` | The requested rating is not advertised by the active algorithm. |
| `ConcurrentReviewError` | A store rejected a review based on a stale state revision. |

Input validation commonly throws `TypeError`. Algorithm-specific state parsers
may throw their own errors when persisted state is malformed.

## `@alstate/sqlite`

### `SqliteLearningStore`

```ts
class SqliteLearningStore implements LearningStore {
  constructor(path?: string);
}
```

`path` defaults to `":memory:"`. A filesystem path causes missing parent
directories to be created. Construction opens the database, enables foreign
keys, configures a 5-second busy timeout and applies schema migrations. The
instance exposes the `LearningStore` methods documented above; `close()` closes
the underlying `node:sqlite` connection.

Node.js 22.13 or later is required. See [First-party adapters](adapters.md) and
the [SQLite data model](data-model.md) for ordering, transaction and schema
details.

## `@alstate/fsrs`

### `FsrsAlgorithm`

```ts
class FsrsAlgorithm
  implements LearningAlgorithm<FsrsState, FsrsReviewData> {
  constructor(options?: FsrsOptions);
}
```

The adapter exposes the identity `FSRS`, the `ts-fsrs` `FSRSVersion`, four
ratings (`again`, `hard`, `good`, `easy`) and a fully resolved, serializable
configuration. It delegates scheduling calculations to `ts-fsrs`.

### `FsrsOptions`

```ts
interface FsrsOptions {
  readonly requestRetention?: number;
  readonly maximumInterval?: number;
  readonly weights?: readonly number[];
  readonly enableFuzz?: boolean;
  readonly enableShortTerm?: boolean;
  readonly learningSteps?: readonly FsrsStep[];
  readonly relearningSteps?: readonly FsrsStep[];
}

type FsrsStep = `${number}${"d" | "h" | "m"}`;
```

`FsrsConfiguration` is the normalized snake-case configuration stored for
algorithm identity. `FsrsState` is the JSON representation of a card, and
`FsrsReviewData` is the JSON representation of a `ts-fsrs` review log. These
types are public for typed inspection and adapter interoperability; the FSRS
adapter owns their persistence format.

```ts
interface FsrsConfiguration extends JsonObject {
  readonly request_retention: number;
  readonly maximum_interval: number;
  readonly w: readonly number[];
  readonly enable_fuzz: boolean;
  readonly enable_short_term: boolean;
  readonly learning_steps: readonly FsrsStep[];
  readonly relearning_steps: readonly FsrsStep[];
}

interface FsrsState extends JsonObject {
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

interface FsrsReviewData extends JsonObject {
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
```

See [First-party adapters](adapters.md) for option meanings and configuration
compatibility.

## Stability

All packages are experimental `0.x` releases. Public TypeScript API, persisted
algorithm state and storage schema are compatibility-sensitive and may change
before `1.0`. The three public packages use lockstep versions during `0.x`.
