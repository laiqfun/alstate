# First-party adapters

English | [简体中文](adapters.zh-CN.md)

The common local setup combines `SqliteLearningStore` and `FsrsAlgorithm`:

```ts
import { LearningEngine } from "@alstate/core";
import { FsrsAlgorithm } from "@alstate/fsrs";
import { SqliteLearningStore } from "@alstate/sqlite";

const store = new SqliteLearningStore("data/learning.db");
const algorithm = new FsrsAlgorithm({
  requestRetention: 0.9,
  enableFuzz: true,
});

const engine = await LearningEngine.create({ store, algorithm });
```

## SQLite storage

### Runtime and opening a database

`@alstate/sqlite` uses the built-in `node:sqlite` module and requires Node.js
22.13 or later.

```ts
const memoryStore = new SqliteLearningStore();
const durableStore = new SqliteLearningStore("data/learning.db");
```

Omitting the path uses an in-memory database. For a file path, the adapter
creates missing parent directories, opens or creates the database, enables
foreign keys, sets a 5-second SQLite busy timeout and applies every pending
schema migration before the constructor returns.

Construction and individual SQL calls are synchronous internally because that
is the `DatabaseSync` API, while the public methods implement the asynchronous
`LearningStore` contract.

### Ordering and pagination

The adapter has deterministic query order:

| Operation | Order |
| --- | --- |
| `engine.list()` | Item ID ascending |
| `engine.due()` | Due time ascending, then item ID ascending |
| `engine.history()` | Review time descending, then review ID descending |

`limit` and `offset` must be non-negative safe integers. `limit: 0` returns an
empty result. `due` supports a limit but not an offset.

All timestamps are stored as ISO 8601 UTC strings and are returned as new
`Date` objects. Application, state and review JSON are stored as JSON text.

### Atomicity and concurrency

SQLite transactions protect both composite writes:

1. inserting an item and its initial algorithm state;
2. updating algorithm state and inserting its review record.

Each state starts at revision `0`. A review update succeeds only if the stored
revision still matches the state loaded by the caller, then increments it. A
stale writer receives `ConcurrentReviewError`, and the transaction does not add
a history record.

The transaction begins with `BEGIN IMMEDIATE`. Combined with the busy timeout,
this gives competing local writers a bounded opportunity to wait for the write
lock. Callers should still handle both concurrency errors and ordinary SQLite
I/O or locking failures.

### Scope and deletion

Every item operation includes the registered algorithm ID. Two different
algorithm names may use one database without seeing one another's items.
Removing an item cascades to its state and review records.

Content grouping is still application policy. Store a deck or tag in item data,
or maintain it in application-owned storage; the public SQLite schema contains
only engine tables.

### Lifecycle and operational guidance

`engine.close()` calls `store.close()`. Treat the supplied store as owned by the
engine and do not reuse it after closing. For independently managed engines,
create independently managed store instances, even when they point to the same
database file.

Before copying or backing up a database file, close active stores or use a
SQLite-aware backup procedure. Do not edit `engine_states.state_json` or
algorithm registration rows by hand: their consistency is checked by the
algorithm and engine.

The full schema is documented in [SQLite data model](data-model.md).

## FSRS scheduling

`@alstate/fsrs` adapts `ts-fsrs`; it does not implement FSRS mathematics. It is
responsible for mapping Alstate ratings, converting dates, serializing card and
review state, and verifying persisted state before scheduling.

### Ratings

The adapter advertises four ratings in this order:

```ts
algorithm.ratings;
// [
//   { value: "again", label: "Again" },
//   { value: "hard",  label: "Hard" },
//   { value: "good",  label: "Good" },
//   { value: "easy",  label: "Easy" }
// ]
```

Rating values are case-sensitive. Pass the `value`, not the label, to
`engine.review()`.

### Configuration

```ts
const algorithm = new FsrsAlgorithm({
  requestRetention: 0.9,
  maximumInterval: 36_500,
  enableFuzz: true,
  enableShortTerm: true,
  learningSteps: ["1m", "10m"],
  relearningSteps: ["10m"],
  // weights: [...],
});
```

| Alstate option | Persisted key | Purpose |
| --- | --- | --- |
| `requestRetention` | `request_retention` | Target recall probability from `0.0` to `1.0`; higher values generally increase review load. |
| `maximumInterval` | `maximum_interval` | Maximum scheduled interval in days. |
| `weights` | `w` | FSRS model weights. Supply a complete compatible weight array. |
| `enableFuzz` | `enable_fuzz` | Adds small random variation to longer intervals. |
| `enableShortTerm` | `enable_short_term` | Enables short-term scheduling behavior. |
| `learningSteps` | `learning_steps` | Short-term steps for new items, such as `"1m"`, `"10m"` or `"1d"`. |
| `relearningSteps` | `relearning_steps` | Short-term steps after a lapse. |

Options are passed through `ts-fsrs` parameter normalization and validation.
Omitted values receive the defaults of the installed `ts-fsrs` version. Read
`algorithm.configuration` to inspect the complete normalized configuration that
Alstate registers and persists:

```ts
console.log(algorithm.configuration.request_retention);
console.log(algorithm.configuration.learning_steps);
```

### State and review data

On `add`, the adapter creates an empty FSRS card due at the initialization time.
The full card is serialized as `FsrsState`; the due time is also projected into
the store for efficient queue queries.

On `due`, the adapter parses and validates the stored card, checks that its
internal due time matches the store projection, and calculates four previews at
the query time.

On `review`, it calculates one new card and emits `FsrsReviewData`, a
JSON-compatible review log. Applications may read the typed result for
analytics, but should treat both formats as algorithm-owned persisted data.

### Configuration and version compatibility

The registration identity is the algorithm name (`FSRS`), the exported
`ts-fsrs` version, and the complete normalized configuration. Object key order
does not affect configuration equality, but values and array order do.

Opening a database with changed FSRS options or a changed FSRS version raises
`AlgorithmMismatchError`. Alstate intentionally does not reinterpret existing
state. To change either one, keep using the original setup until you have an
explicit application migration, or start with a separate database. A general
algorithm-state migration API is not available in `0.1.x`.

Because the algorithm name is unique in the SQLite store, one database cannot
register multiple independent FSRS configurations under that same name.

## Choosing other adapters

The core is not tied to these implementations. You may combine another
`LearningStore` with `FsrsAlgorithm`, or `SqliteLearningStore` with another
`LearningAlgorithm`, provided the contracts are preserved. See
[Extending Alstate](extending.md).
