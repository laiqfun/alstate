# Alstate documentation

English | [简体中文](README.zh-CN.md)

Alstate is a headless learning scheduling runtime for applications that need to
decide *when* an item should be studied without handing the application model or
user experience to a framework.

It joins three concerns behind one small workflow:

```text
your item data -> LearningEngine -> scheduling algorithm
                       |
                       v
               state + review history
```

The application still owns cards, words, questions, media, tags, users, decks,
imports and presentation. Alstate owns item identity, scheduling coordination,
durable algorithm state and review-history consistency.

## Start here

- [Getting started](getting-started.md) installs the first-party stack and walks
  through adding, listing, scheduling and reviewing an item.
- [API reference](api-reference.md) documents every public export from
  `@alstate/core`, `@alstate/sqlite` and `@alstate/fsrs`.
- [First-party adapters](adapters.md) covers SQLite storage, FSRS configuration,
  persistence behavior and lifecycle details.
- [Extending Alstate](extending.md) explains how to implement a custom scheduling
  algorithm or storage adapter and which consistency rules must be preserved.

## Understand the design

- [Architecture](architecture.md) describes package boundaries, algorithm
  ownership and atomic workflows.
- [SQLite data model](data-model.md) documents tables, relationships, review
  commits and migrations.
- [Vocabulary CLI example](../examples/vocabulary-cli/README.md) is a runnable
  private application using all three packages.

## Packages

| Package | Use it for | Runtime dependencies |
| --- | --- | --- |
| `@alstate/core` | The engine and adapter contracts | None |
| `@alstate/sqlite` | Durable local storage | Node.js `node:sqlite` |
| `@alstate/fsrs` | FSRS scheduling | `ts-fsrs` |

The SQLite adapter requires Node.js 22.13 or later. All packages are ESM and are
currently experimental `0.x` releases.

## Choose a reading path

If you want to embed Alstate now, read [Getting started](getting-started.md), then
the [adapter guide](adapters.md). If you are building an adapter, read the
[architecture](architecture.md), [API reference](api-reference.md), and
[extension guide](extending.md) in that order.
