# `@alstate/sqlite`

Experimental SQLite persistence adapter for `@alstate/core`, implemented with
Node.js `node:sqlite`.

## Requirements and install

Node.js 22.13 or later is required.

```bash
npm install @alstate/core @alstate/sqlite
```

Add a scheduling algorithm separately; `@alstate/fsrs` is the first-party
choice.

## Use

```ts
import { LearningEngine } from "@alstate/core";
import { FsrsAlgorithm } from "@alstate/fsrs";
import { SqliteLearningStore } from "@alstate/sqlite";

const engine = await LearningEngine.create({
  store: new SqliteLearningStore("data/learning.db"),
  algorithm: new FsrsAlgorithm(),
});

try {
  const item = await engine.add({ prompt: "2 + 2", answer: "4" });
  await engine.review(item.id, "good");
} finally {
  engine.close();
}
```

The constructor defaults to an in-memory database when no path is supplied:

```ts
const store = new SqliteLearningStore(); // ":memory:"
```

For a file path, missing parent directories are created automatically. The
adapter opens or creates the database, enables foreign keys, applies pending
schema migrations and sets a 5-second busy timeout.

## Behavior

- item creation and initial-state creation share one transaction;
- state update and review insertion share one transaction;
- reviews compare and increment a state revision, rejecting stale writers with
  `ConcurrentReviewError`;
- operations are scoped to the registered algorithm;
- deleting an item cascades to state and review history;
- items are ordered by ID, due items by due time then ID, and history newest
  first;
- timestamps are persisted as ISO 8601 strings and returned as `Date` objects.

`engine.close()` closes its store. Do not reuse the connection afterward.

- [SQLite and FSRS adapter guide](https://github.com/laiqfun/alstate/blob/main/docs/adapters.md)
- [SQLite data model](https://github.com/laiqfun/alstate/blob/main/docs/data-model.md)
- [Core API reference](https://github.com/laiqfun/alstate/blob/main/docs/api-reference.md)

MIT
