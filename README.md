# Alstate

Alstate is a modular learning-state engine for building adaptive learning applications.

It is intended to support applications such as vocabulary trainers and flashcard systems by separating learning items, scheduling decisions, content modules, import policies, and user interfaces into independent layers.

> Alstate is currently in early development. The architecture and core domain contracts are defined, but user-facing business features have not yet been implemented.

## Current Scope

The first application profile is designed around **learning English vocabulary**, while the core architecture uses reusable learning-item, module, algorithm, and repository contracts.

In the vocabulary profile, one `LearningItem` represents one English meaning of a spelling. Its `word` value is not an identity or uniqueness key: two items may both contain `bank` while representing different meanings. Meanings, examples, translations, and links to other meanings are supplied by content modules attached directly to the item.

## Goals

Within the English-vocabulary learning scenario, Alstate is designed to help applications answer three questions:

- What should a learner study next?
- When should an item be reviewed again?
- How should learner feedback update its learning state?

The initial implementation will focus on:

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
│  └─ domain/
├─ package.json
├─ tsconfig.json
├─ tsconfig.build.json
└─ tsconfig.test.json
```

The directories currently contain only module boundaries and entry points. Domain models, repositories, algorithms, commands, and database implementations will be added incrementally.

## Requirements

- Node.js 22 or later
- npm

## Getting Started

Install the development dependencies:

```bash
npm install
```

Run the empty CLI entry point during development:

```bash
npm run dev
```

Build and run the compiled entry point:

```bash
npm run build
npm start
```

The CLI currently exits without output because commands have not yet been implemented.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run the TypeScript CLI entry point. |
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

The TypeScript scaffold, stable domain contracts, initial content modules, RelatedMeanings validation, and append-only import strategy are complete. The project passes type checking, compilation, and its test suite. The next stage is to implement the complete FSRS adapter before persistence or user-facing commands.

The data model and APIs are still subject to change.
