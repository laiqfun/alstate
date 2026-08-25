# Alstate

Alstate is a modular learning-state engine for building adaptive learning applications.

It is intended to support applications such as vocabulary trainers and flashcard systems by separating learning state, scheduling decisions, content modules, and user interfaces into independent layers.

> Alstate is currently in the scaffolding stage. The architecture is defined, but business features and public APIs have not yet been implemented.

## Current Scope

The current architecture and data model are designed specifically around **learning English vocabulary**. Concepts such as `Word`, `WordContent`, meanings, example sentences, tags, and word-review records reflect this initial use case.

Alstate may evolve into a more general learning-state engine in the future, but the present structure should not be treated as a content-agnostic learning model. Generalizing beyond vocabulary learning would require a separate design decision and corresponding changes to the domain model.

## Goals

Within the English-vocabulary learning scenario, Alstate is designed to help applications answer three questions:

- What should a learner study next?
- When should an item be reviewed again?
- How should learner feedback update its learning state?

The initial implementation will focus on:

- a command-line interface;
- word management;
- extensible word-content modules;
- a basic review algorithm;
- SQLite persistence.

## Architecture

The project follows a layered architecture:

```text
CLI
 |
Application
 |
+----------------+----------------+
|                |                |
Word modules     Learning         Content modules
|                |                |
+----------------+----------------+
 |
Repository contracts
 |
Infrastructure
 |
SQLite / file storage
```

### Layers

- **Domain** contains core entities and repository contracts. It does not depend on databases or interfaces.
- **Modules** organizes the word system and extensible word-content modules.
- **Learning** contains learning algorithms and learning-state concepts.
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
│  │  └─ state/
│  ├─ modules/
│  │  ├─ content/
│  │  └─ word/
│  └─ index.ts
├─ package.json
├─ tsconfig.json
└─ tsconfig.build.json
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
| `npm test` | Run the Node.js test runner. No tests exist yet. |

## Design Principles

- Keep the domain independent of databases, interfaces, and external services.
- Depend on repository contracts rather than concrete storage implementations.
- Add content types through modules without changing the core Word entity.
- Allow learning algorithms to define and evolve their own state structures.
- Keep interface code free of learning and persistence logic.

## Development Status

The TypeScript project scaffold is complete and passes type checking and compilation. The next stage is to define stable domain contracts before implementing persistence or user-facing commands.

The data model and APIs are still subject to change.
