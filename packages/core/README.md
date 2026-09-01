# `@alstate/core`

Experimental storage- and algorithm-independent learning scheduling runtime.
Core coordinates application-owned items, algorithm state, due previews and
review history without depending on Node.js or any third-party runtime package.

## Install

```bash
npm install @alstate/core
```

Applications also supply a `LearningAlgorithm` and `LearningStore`. For the
first-party stack:

```bash
npm install @alstate/core @alstate/sqlite @alstate/fsrs
```

## Use

```ts
import { LearningEngine } from "@alstate/core";
import { FsrsAlgorithm } from "@alstate/fsrs";
import { SqliteLearningStore } from "@alstate/sqlite";

const engine = await LearningEngine.create({
  store: new SqliteLearningStore("learning.db"),
  algorithm: new FsrsAlgorithm(),
});

try {
  const item = await engine.add({ prompt: "Question", answer: "Answer" });
  const due = await engine.due(new Date(), 10);

  if (due[0] !== undefined) {
    await engine.review(due[0].item.id, "good", {
      responseTimeMs: 800,
    });
  }

  console.log(await engine.history(item.id));
} finally {
  engine.close();
}
```

## Engine workflow

| Method | Behavior |
| --- | --- |
| `add(data?, at?)` | Atomically creates application data and initial algorithm state. |
| `get(id)` | Gets an item in the active algorithm's scope. |
| `list(query?)` | Lists scoped items with optional `limit` and `offset`. |
| `update(id, data)` | Replaces the item's complete data object. |
| `remove(id)` | Removes the item and returns whether it existed. |
| `due(at?, limit?)` | Returns due items and a next-due preview for each rating. |
| `review(id, rating, options?)` | Atomically commits next state and one review record. |
| `history(id, query?)` | Lists the item's immutable review records. |
| `close()` | Closes the supplied store. |

Every engine instance registers and binds one algorithm. Item access is scoped
to that algorithm, and stores must compare state revisions so stale reviews
cannot overwrite a newer transition.

## Data boundary

Item data, algorithm configuration, algorithm state and review data must be
JSON-compatible objects. Numbers must be finite; arrays must be dense; objects
must be plain and contain no circular references. Serialize values such as
`Date` and `bigint` in application code.

Identifiers are branded numeric types. Use IDs returned by the engine directly,
or validate an external numeric item ID with `learningItemId(value)`.

## Extension contracts

The package exports `LearningAlgorithm` and `LearningStore` plus their input
and output types. A store implementation must preserve two atomic boundaries:
item plus initial state, and state update plus review record. It must also scope
operations by algorithm and reject stale state revisions.

- [Getting started](https://github.com/laiqfun/alstate/blob/main/docs/getting-started.md)
- [Complete API reference](https://github.com/laiqfun/alstate/blob/main/docs/api-reference.md)
- [Implementing adapters](https://github.com/laiqfun/alstate/blob/main/docs/extending.md)
- [Architecture](https://github.com/laiqfun/alstate/blob/main/docs/architecture.md)

MIT
