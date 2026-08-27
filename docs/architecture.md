# Architecture

English | [简体中文](architecture.zh-CN.md)

## Package boundaries

Alstate separates orchestration from concrete policy and infrastructure:

```text
Application
    |
    v
LearningEngine (@alstate/core)
    |                         |
    v                         v
LearningAlgorithm        LearningStore
    ^                         ^
    |                         |
FsrsAlgorithm            SqliteLearningStore
(@alstate/fsrs)           (@alstate/sqlite)
```

`@alstate/core` contains no Node.js, SQLite or `ts-fsrs` imports. It defines the
workflow and the behavioral contracts adapters must preserve.

## Core workflow

`LearningEngine` exposes eight application operations:

- `add`: validate application JSON, initialize algorithm state, and atomically
  persist the item and state;
- `get`, `list`, `update`, `remove`: operate on items owned by the active
  algorithm;
- `due`: load projected due state, parse it through the algorithm, and return
  rating previews;
- `review`: validate a rating, calculate the next state, then atomically commit
  that state and one immutable review record;
- `history`: list review records for an item owned by the active algorithm.

The engine validates algorithm identity, ratings, dates and JSON-compatible
outputs at runtime. Application data remains opaque to it.

## Algorithm ownership

An engine instance registers and binds one `LearningAlgorithm`. A registered
name can be reopened only with the same version and canonical configuration.
This prevents accidental state reinterpretation.

Different algorithms may share one physical store, but their item operations
are isolated. Moving an item to another algorithm is a migration operation and
is deliberately outside the `0.1.0` API.

## Store contract

`LearningStore` is asynchronous so local, remote and server-backed adapters can
implement it. Its composite methods define two mandatory atomic boundaries:

1. item creation together with initial state;
2. state transition together with its review record.

Every stored state has a monotonically increasing `revision`. `commitReview`
must compare the supplied revision and reject a stale transition. The SQLite
adapter implements this with a conditional update inside a transaction.

## First-party adapters

`@alstate/sqlite` supplies durable local persistence through `node:sqlite`.
`@alstate/fsrs` delegates scheduling mathematics to the open-source `ts-fsrs`
package and owns only the Alstate adapter, JSON state format and date conversion.

## Excluded concerns

Content schemas, tags, decks, imports, users, authentication, interfaces and
interaction flows remain application policy. The private vocabulary CLI shows
one possible composition without expanding the engine API.
