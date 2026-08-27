# Alstate

Alstate is a small, embeddable learning scheduling engine.

## What is the engine?

The engine is the stable workflow between an application, a scheduling
algorithm and persistent state:

```text
application data
      |
      v
LearningEngine ---- injected LearningAlgorithm
      |
      v
 LearningStore ---- SQLite or another adapter
```

It is not a vocabulary framework, flashcard UI or FSRS wrapper. It does not
decide what is learned or how scheduling works.

## What does it own?

The engine has four responsibilities:

1. Give each independently scheduled item an identity and store its opaque JSON
   data.
2. Ask an injected algorithm to initialize, preview and update scheduling state.
3. Find due items and commit state changes together with immutable review
   records.
4. Hide persistence details behind one `LearningStore` interface.

The engine deliberately does not own:

- words, meanings, prompts, answers, audio or other content schemas;
- FSRS or any other concrete scheduling algorithm;
- tags, decks, import conflict policies or external file formats;
- CLI, HTTP, rendering or interaction logic;
- users and authentication. One store represents one learning-state namespace;
  multi-user hosts scope stores themselves.

## Public API

Applications work through one `LearningEngine` facade:

```ts
const engine = await LearningEngine.create({ store, algorithm });

const item = await engine.add({ prompt: "2 + 2", answer: "4" });
await engine.get(item.id);
await engine.list();
await engine.update(item.id, { prompt: "2 + 2", answer: "four" });
await engine.due();
await engine.review(item.id, "good");
await engine.history(item.id);
await engine.remove(item.id);

engine.close();
```

These eight operations are the engine surface. Application-specific workflows
are composed outside the engine.

## Injecting an algorithm

The package exports only the `LearningAlgorithm` protocol. An implementation
supplies its identity, configuration, ratings and pure state transitions:

```ts
const engine = await LearningEngine.create({
  store: new SqliteLearningStore("learning.db"),
  algorithm: myAlgorithm,
});
```

Alstate refuses to silently replace an already registered algorithm with a
different version or configuration, because that would reinterpret stored
state. Algorithm migration must be explicit.

## SQLite

`SqliteLearningStore` is an optional built-in storage adapter. The engine itself
depends only on `LearningStore`, so another adapter can implement the same
composite persistence operations and transaction guarantees.

## Runnable example

[`examples/vocabulary-cli`](examples/vocabulary-cli) is a complete consumer of
the engine. It owns its vocabulary schema, JSON import format, CLI and FSRS
adapter, then injects that adapter into `LearningEngine`.

```bash
npm run example:vocabulary -- help
npm run example:vocabulary -- item:add bank
```

The example is not exported by the package.

## Project structure

```text
src/
├─ index.ts
├─ learning-engine.ts
├─ learning-algorithm.ts
├─ learning-store.ts
├─ types.ts
├─ errors.ts
└─ sqlite/
   ├─ migrations.ts
   └─ sqlite-learning-store.ts

examples/vocabulary-cli/
├─ algorithm/
├─ app/
├─ cli/
├─ domain/
├─ infrastructure/
├─ main.ts
└─ README.md
```

See [Architecture](docs/architecture.md) and [Data model](docs/data-model.md).

## Development

Requires Node.js 22.13 or later.

```bash
npm install
npm run check
```

| Command | Description |
| --- | --- |
| `npm run typecheck` | Type-check the engine, example and tests. |
| `npm run build` | Build only the engine into `dist/`. |
| `npm test` | Run engine, SQLite, migration and example tests. |
| `npm run check` | Run type-checking, build and all tests. |
| `npm run example:vocabulary -- help` | Run the vocabulary application. |
