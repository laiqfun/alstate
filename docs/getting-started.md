# Getting started

English | [简体中文](getting-started.zh-CN.md)

This guide builds a minimal TypeScript application with the complete
first-party stack:

- `LearningEngine` coordinates the workflow;
- `SqliteLearningStore` persists data;
- `FsrsAlgorithm` calculates review schedules.

## Requirements

- Node.js 22.13 or later when using `@alstate/sqlite`;
- an ESM project (`"type": "module"` is the simplest Node.js setup);
- TypeScript is optional, but the examples use it to show the public types.

Install the packages:

```bash
npm install @alstate/core @alstate/sqlite @alstate/fsrs
```

For a TypeScript Node.js application, a minimal configuration is:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true
  }
}
```

## Create an engine

An engine is bound to exactly one store and one algorithm:

```ts
import { LearningEngine } from "@alstate/core";
import { FsrsAlgorithm } from "@alstate/fsrs";
import { SqliteLearningStore } from "@alstate/sqlite";

const engine = await LearningEngine.create({
  store: new SqliteLearningStore("data/learning.db"),
  algorithm: new FsrsAlgorithm({ requestRetention: 0.9 }),
});
```

Opening the SQLite store creates the parent directory, opens or creates the
database and applies pending schema migrations. Creating the engine registers
the active algorithm. Reopening the same database later requires the same
algorithm version and effective configuration.

`LearningEngine` owns the supplied store's lifecycle. Close it when the
application is done:

```ts
try {
  // Use the engine.
} finally {
  engine.close();
}
```

## Define application data

Alstate does not define a card schema. The root value for each item is a JSON
object owned by your application:

```ts
import type { JsonObject } from "@alstate/core";

interface FlashcardData extends JsonObject {
  readonly prompt: string;
  readonly answer: string;
  readonly tags: readonly string[];
  readonly createdAt: string;
}

const card: FlashcardData = {
  prompt: "What is 2 + 2?",
  answer: "4",
  tags: ["math"],
  createdAt: new Date().toISOString(),
};
```

Dates must be serialized, for example with `toISOString()`. Valid values are
finite numbers, strings, booleans, `null`, arrays of JSON values and plain JSON
objects. `Date`, `undefined`, `bigint`, functions, symbols, class instances,
sparse arrays and circular references are rejected.

Static TypeScript types do not validate data loaded from an import, API or
database. Parse untrusted item data at your application boundary before using
its fields. The vocabulary example demonstrates this in
[`parseVocabularyItem`](../examples/vocabulary-cli/src/domain/vocabulary-item.ts).

## Add an item

```ts
const addedAt = new Date();
const item = await engine.add(card, addedAt);

console.log(item.id);   // branded numeric LearningItemId
console.log(item.data); // the application object
```

The second argument controls the algorithm's initialization time and defaults
to the current time. With FSRS, a new item is due at that time. Item creation and
initial scheduling-state creation are one atomic store operation.

When an ID comes back from a route, command-line argument or other external
boundary, validate and brand it before calling the engine:

```ts
import { learningItemId } from "@alstate/core";

const id = learningItemId(Number(routeParameter));
const stored = await engine.get(id);
```

The helper accepts only positive safe integers and otherwise throws `TypeError`.

## Read, update and remove items

```ts
const sameItem = await engine.get(item.id);
const firstPage = await engine.list({ limit: 20, offset: 0 });

const updated = await engine.update(item.id, {
  ...sameItem.data,
  answer: "four",
});

const removed = await engine.remove(item.id);
```

`update` replaces the complete data object; it does not merge fields. `get` and
`update` throw `ItemNotFoundError` when the item is missing or belongs to a
different active algorithm. `remove` returns `false` in that case. With SQLite,
removal also deletes the item's scheduling state and review history.

`limit` and `offset` are optional non-negative safe integers. SQLite returns
items in ascending item-ID order.

## Build a due queue

```ts
const now = new Date();
const queue = await engine.due(now, 20);

for (const entry of queue) {
  console.log(entry.item.data);
  console.log(`Due since ${entry.dueAt.toISOString()}`);

  for (const choice of entry.preview) {
    console.log(choice.rating.value, choice.rating.label, choice.dueAt);
  }
}
```

`due(at, limit)` returns states whose due time is less than or equal to `at`.
Each result contains the item, its current due time and the next due time
previewed for every rating. The first-party SQLite store orders the queue by due
time and then item ID.

For FSRS, rating values are exact, lower-case strings:

| Value | Default label |
| --- | --- |
| `again` | Again |
| `hard` | Hard |
| `good` | Good |
| `easy` | Easy |

Use `entry.preview` to render choices rather than duplicating this list in an
application; a different algorithm may expose different ratings.

## Commit a review

```ts
const current = queue[0];

if (current !== undefined) {
  const reviewedAt = new Date();
  const completed = await engine.review(current.item.id, "good", {
    at: reviewedAt,
    responseTimeMs: 1_250,
  });

  console.log(completed.outcome.state.dueAt); // next due time
  console.log(completed.outcome.data);        // algorithm review details
  console.log(completed.record.id);           // persisted history record
}
```

`at` defaults to the current time. `responseTimeMs` is optional and must be
non-negative; use an integer number of milliseconds with the SQLite adapter.
The next algorithm state and its immutable review record are committed
atomically.

The engine permits reviewing any existing item; it does not require the item to
be returned by `due()`. Deciding whether early, manual or repeated reviews are
allowed is application policy.

If two callers review the same state concurrently, only one SQLite commit can
succeed. The other throws `ConcurrentReviewError`; reload the current state or
queue and let the application decide whether the user's action should be
applied again. Blindly replaying a human review can create an unintended second
review.

## Read review history

```ts
const recent = await engine.history(item.id, { limit: 50, offset: 0 });

for (const record of recent) {
  console.log(record.rating, record.reviewedAt, record.responseTimeMs);
  console.log(record.data); // algorithm-owned review data
}
```

`history` first verifies that the item belongs to the active algorithm. With
SQLite, records are returned newest first, ordered by review time and then
record ID.

## Handle expected errors

All engine-specific errors extend `LearningEngineError`:

```ts
import {
  ConcurrentReviewError,
  ItemNotFoundError,
  UnsupportedRatingError,
} from "@alstate/core";

try {
  await engine.review(item.id, selectedRating);
} catch (error) {
  if (error instanceof UnsupportedRatingError) {
    // Refresh choices from engine.algorithm.ratings or a due preview.
  } else if (error instanceof ItemNotFoundError) {
    // The item is absent from this algorithm's scope.
  } else if (error instanceof ConcurrentReviewError) {
    // Refresh state before deciding whether to retry.
  } else {
    throw error;
  }
}
```

Handle `AlgorithmMismatchError` around `LearningEngine.create()`. It means the
store already contains the same algorithm name with another version or effective
configuration; use the original setup, perform an explicit migration, or open a
separate store.

Invalid IDs, dates, JSON input, pagination or response times throw `TypeError`.
`AlgorithmContractError` indicates that an algorithm returned data that violates
the core contract and is primarily relevant to adapter authors.

## Run the repository example

From a checkout of the Alstate repository:

```bash
npm install
npm run example:vocabulary -- help
npm run example:vocabulary -- item:add bank
npm run example:vocabulary -- meaning:add 1 english "a financial institution"
npm run example:vocabulary -- review good
npm run example:vocabulary -- history 1
```

The example stores data in `.alstate/vocabulary-example.db` unless
`ALSTATE_VOCABULARY_DB_PATH` is set. Its vocabulary schema and CLI commands are
application code, not part of Alstate's public packages.

## Next steps

- Read the complete [API reference](api-reference.md).
- Configure and operate the [first-party adapters](adapters.md).
- Learn the package and transaction boundaries in [Architecture](architecture.md).
- Implement another algorithm or store using [Extending Alstate](extending.md).
