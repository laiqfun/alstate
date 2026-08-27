# Engine architecture

## Definition

A learning engine is a reusable state-transition coordinator. It connects item
identity, a caller-selected scheduling algorithm and durable review state. It is
useful only through an application, but it must not contain that application's
content model or interface.

Alstate therefore has three parts:

```text
LearningEngine
  ├─ uses LearningAlgorithm
  └─ uses LearningStore
```

### LearningEngine

The facade defines the use cases and their boundaries:

- `add`: store opaque application data and initialize algorithm state atomically;
- `get`, `list`, `update`, `remove`: manage independently scheduled items;
- `due`: query projected due times and ask the algorithm for rating previews;
- `review`: apply a rating and commit new state plus review history atomically;
- `history`: read immutable review events.

The engine does not expose repositories or separate services for each table.

### LearningAlgorithm

An algorithm is an injected policy. It owns:

- supported ratings;
- configuration and version identity;
- initial state;
- stored-state parsing;
- preview and review transitions.

The protocol uses JSON-compatible state at the persistence boundary. Concrete
packages and their types remain outside the engine. There is intentionally no
algorithm implementation under `src`.

### LearningStore

The store is one persistence port tailored to engine operations. Composite
methods such as item-plus-state creation and state-plus-review commit make the
required transaction boundary part of the interface.

`SqliteLearningStore` is the supplied adapter. It uses synchronous SQLite
internally, but consumers can implement an asynchronous remote or server store
through the same protocol.

## Data ownership

`LearningItem.data` is opaque JSON. The engine stores it but never validates or
interprets its fields. This small convenience lets an embedded application use
one database without introducing content modules, schemas or application tables
into the engine.

Applications that need relational content can store only an external reference
in `data` and own their content database separately.

## Algorithm safety

Persisted state is meaningful only under the algorithm version and configuration
that produced it. Store registration is therefore idempotent for an identical
algorithm and rejects mismatches. A future state migration must be an explicit
application operation rather than a bootstrap side effect.

## Dependency direction

- `learning-engine.ts` depends on the algorithm and store protocols.
- `sqlite/` implements the store protocol.
- examples depend on engine exports.
- engine source never imports examples or concrete algorithms.

## Excluded concerns

Tags, modules, imports, decks, user accounts, interfaces and concrete algorithms
are intentionally excluded. They are application policy, not necessary for the
state-transition loop. Keeping them outside prevents optional features from
expanding the engine API.
