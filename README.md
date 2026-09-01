# Alstate

English | [简体中文](README.zh-CN.md)

> Experimental: the packages are in `0.x`; public APIs and persisted state may
> change before `1.0`.

Alstate is a headless, embeddable learning scheduling runtime. It gives an
application one consistent workflow for items, due queues, scheduling state and
review history while leaving the content model and user experience entirely to
the application.

Use it to add spaced repetition or another learning schedule to a CLI, desktop
app, server or service without adopting a card schema, deck system or UI
framework.

## What Alstate owns

- item identity and opaque JSON application data;
- algorithm initialization, due previews and review transitions;
- atomic item-plus-state and state-plus-review persistence boundaries;
- immutable review history and optimistic review concurrency;
- algorithm identity, configuration and version safety;
- contracts for custom algorithms and stores.

Your application owns questions, words, media, tags, decks, imports, users,
authentication, rendering and interaction policy.

## Packages

| Package | Responsibility |
| --- | --- |
| `@alstate/core` | Storage- and algorithm-independent engine workflow and contracts. |
| `@alstate/sqlite` | Durable local implementation of the core store contract. |
| `@alstate/fsrs` | First-party adapter from `ts-fsrs` to the core algorithm contract. |

The dependency direction is one-way:

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

The first-party stack requires Node.js 22.13 or later and an ESM project.

```bash
npm install @alstate/core @alstate/sqlite @alstate/fsrs
```

```ts
import { LearningEngine } from "@alstate/core";
import { FsrsAlgorithm } from "@alstate/fsrs";
import { SqliteLearningStore } from "@alstate/sqlite";

const engine = await LearningEngine.create({
  store: new SqliteLearningStore("data/learning.db"),
  algorithm: new FsrsAlgorithm({ requestRetention: 0.9 }),
});

try {
  const item = await engine.add({ prompt: "2 + 2", answer: "4" });
  const [next] = await engine.due(new Date(), 20);

  if (next !== undefined) {
    console.log(next.preview); // next due time for every rating
    await engine.review(next.item.id, "good", { responseTimeMs: 1_200 });
  }

  console.log(await engine.history(item.id));
} finally {
  engine.close();
}
```

Each engine instance is bound to one registered algorithm. Item operations are
scoped to that algorithm. A review updates state and appends history atomically;
stale concurrent transitions cannot overwrite a newer revision.

## Documentation

- [Documentation home](docs/README.md): what to read for each use case;
- [Getting started](docs/getting-started.md): installation and the complete
  application workflow;
- [API reference](docs/api-reference.md): every public package export;
- [First-party adapters](docs/adapters.md): SQLite behavior and FSRS options;
- [Extending Alstate](docs/extending.md): custom algorithms and stores;
- [Architecture](docs/architecture.md): boundaries and consistency guarantees;
- [SQLite data model](docs/data-model.md): schema and migrations;
- [Vocabulary CLI](examples/vocabulary-cli/README.md): runnable consumer example.

## Repository development

This repository is an npm workspace. There is intentionally no root `src/`:
each publishable package owns its source, tests and build output.

```text
packages/core/
packages/sqlite/
packages/fsrs/
examples/vocabulary-cli/
test/integration/
```

The vocabulary CLI is a private workspace used as an executable example and is
not published.

```bash
npm install
npm run check
npm run example:vocabulary -- help
```

## Compatibility

The three public packages use lockstep versions during `0.x`. Reopening a stored
algorithm with a changed version or effective configuration is rejected rather
than silently reinterpreting state. A general algorithm-state migration API is
not part of the `0.1.x` API.

## License

MIT
