# Alstate

English | [简体中文](README.zh-CN.md)

> Experimental: the packages are in `0.x`; public APIs and persisted state may
> change before `1.0`.

Alstate is a headless, embeddable learning scheduling runtime. It coordinates
application-owned items, a scheduling algorithm, durable state and immutable
review history without defining a content model or user interface.

## Packages

| Package | Responsibility |
| --- | --- |
| `@alstate/core` | Storage- and algorithm-independent engine workflow and contracts. |
| `@alstate/sqlite` | SQLite implementation of the core store contract. |
| `@alstate/fsrs` | First-party adapter from `ts-fsrs` to the core algorithm contract. |

The packages have one-way dependencies:

```text
@alstate/core
   ^          ^
   |          |
sqlite      fsrs ---> ts-fsrs
   ^          ^
    \        /
 vocabulary example
```

## Quick start

```bash
npm install @alstate/core @alstate/sqlite @alstate/fsrs
```

```ts
import { LearningEngine } from "@alstate/core";
import { FsrsAlgorithm } from "@alstate/fsrs";
import { SqliteLearningStore } from "@alstate/sqlite";

const engine = await LearningEngine.create({
  store: new SqliteLearningStore("learning.db"),
  algorithm: new FsrsAlgorithm(),
});

const item = await engine.add({ prompt: "2 + 2", answer: "4" });
const due = await engine.due();
await engine.review(item.id, "good");
await engine.history(item.id);
engine.close();
```

An engine instance is bound to one registered algorithm. Item operations are
scoped to that algorithm, and concurrent reviews use optimistic state revisions
so stale transitions cannot overwrite newer state.

## Scope

Alstate owns:

- item identity and opaque JSON application data;
- algorithm initialization, due preview and review coordination;
- atomic item-plus-state and state-plus-review persistence boundaries;
- algorithm identity, configuration and version safety;
- adapter contracts for scheduling algorithms and stores.

Alstate does not own content schemas, tags, decks, import formats, users,
authentication, rendering, CLI or HTTP policy.

## Repository

This repository is an npm workspace. There is intentionally no root `src/`:
each publishable package owns its source, tests and build output.

```text
packages/core/
packages/sqlite/
packages/fsrs/
examples/vocabulary-cli/
test/integration/
```

The vocabulary CLI is a private workspace used for integration testing and is
not published.

## Development

Node.js 22.13 or later is required for the SQLite adapter.

```bash
npm install
npm run check
npm run example:vocabulary -- help
```

See [architecture](docs/architecture.md) and the [SQLite data model](docs/data-model.md).

## Versioning

The three public packages use lockstep versions during `0.x`. Registering an
algorithm with a changed version or configuration is rejected rather than
silently reinterpreting persisted state. A general algorithm-state migration API
is not part of `0.1.0`.

## License

MIT
