# Alstate

Alstate is a modular learning-state engine for building adaptive learning applications.

It is intended to support applications such as vocabulary trainers and flashcard systems by separating learning items, scheduling decisions, content modules, import policies, and user interfaces into independent layers.

> Alstate is currently an early MVP. Its data model and APIs may still change.

## Current Scope

The first application profile is designed around **learning English vocabulary**, while the core architecture uses reusable learning-item, module, algorithm, and repository contracts.

In the vocabulary profile, one `LearningItem` represents one English meaning of a spelling. Its `word` value is not an identity or uniqueness key: two items may both contain `bank` while representing different meanings. Meanings, examples, translations, and links to other meanings are supplied by content modules attached directly to the item.

## Goals

Within the English-vocabulary learning scenario, Alstate is designed to help applications answer three questions:

- What should a learner study next?
- When should an item be reviewed again?
- How should learner feedback update its learning state?

The MVP includes:

- a command-line interface;
- learning-item management for English meanings;
- extensible item-content modules;
- a complete FSRS algorithm module;
- an extensible import-strategy contract with append-only default behavior;
- SQLite persistence.

## Architecture

The project follows a layered architecture:

```text
CLI
 |
Application
 |
+----------------+----------------+----------------+
|                |                |                |
Learning items   Learning         Content modules  Import strategies
|                |                |                |
+----------------+----------------+----------------+
 |
Repository contracts
 |
Infrastructure
 |
SQLite / file storage
```

### Layers

- **Domain** contains core entities and repository contracts. It does not depend on databases or interfaces.
- **Modules** organizes extensible item-content modules and developer-provided import strategies.
- **Learning** contains the learning-algorithm contract, the FSRS module, and learning-state concepts.
- **Application** coordinates use cases without handling presentation or persistence details.
- **Infrastructure** provides concrete integrations such as SQLite repositories and file storage.
- **Interfaces** receives user input and presents results. The first interface will be a CLI.

See [Architecture Design](docs/architecture.md) and [Data Model Design](docs/data-model.md) for the current design.

### FSRS

The built-in FSRS adapter uses the official [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs) implementation. It exposes all four FSRS ratings, preserves the complete card state and review log as JSON, records the implementation version, and keeps third-party types behind Alstate's own learning-algorithm contract.

## Project Structure

```text
alstate/
├─ docs/
│  ├─ architecture.md
│  └─ data-model.md
├─ src/
│  ├─ application/
│  │  └─ services/
│  ├─ domain/
│  │  ├─ entities/
│  │  └─ repositories/
│  ├─ infrastructure/
│  │  ├─ database/
│  │  └─ files/
│  ├─ interfaces/
│  │  └─ cli/
│  ├─ learning/
│  │  ├─ algorithms/
│  │  │  └─ fsrs/
│  │  └─ state/
│  ├─ modules/
│  │  ├─ content/
│  │  │  └─ related-meanings/
│  │  └─ importing/
│  └─ index.ts
├─ test/
│  ├─ application/
│  ├─ domain/
│  ├─ infrastructure/
│  ├─ interfaces/
│  ├─ learning/
│  └─ modules/
├─ package.json
├─ tsconfig.json
├─ tsconfig.build.json
└─ tsconfig.test.json
```

The source tree contains the complete MVP implementation; future features should continue to respect these layer boundaries.

## Requirements

- Node.js 22.13 or later
- npm

## Getting Started

Install the development dependencies:

```bash
npm install
```

Show the CLI help during development:

```bash
npm run dev -- help
```

Build and run the compiled entry point:

```bash
npm run build
npm start
```

By default, data is stored in `.alstate/alstate.db` under the current working directory. Set `ALSTATE_DB_PATH` to use another database file.

See the [CLI Guide](docs/cli.md) for commands, module schemas, a complete workflow, and the JSON import format.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run the TypeScript CLI entry point. |
| `npm run check` | Run type checking, build, and all tests. |
| `npm run typecheck` | Check TypeScript types without emitting files. |
| `npm run build` | Compile the project into `dist/`. |
| `npm start` | Run the compiled CLI entry point. |
| `npm test` | Compile and run the Node.js test suite. |

## Design Principles

- Keep the domain independent of databases, interfaces, and external services.
- Depend on repository contracts rather than concrete storage implementations.
- Treat each independently scheduled meaning as a LearningItem; never infer item identity from `word`.
- Add content types through modules without changing the LearningItem structure.
- Allow learning algorithms to define and evolve their own state structures.
- Keep import identity and conflict rules behind a developer-provided strategy contract.
- Keep interface code free of learning and persistence logic.

## Development Status

The English-vocabulary learning CLI MVP is implemented. It includes modular content, RelatedMeanings validation, append-only JSON import, complete FSRS scheduling, SQLite persistence, transactional application services, and end-to-end tests.

The data model and APIs are still subject to change.
