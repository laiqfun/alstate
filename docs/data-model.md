# SQLite data model

`@alstate/sqlite` persists four engine concepts plus schema migration history.

## Learning item

```sql
engine_items
------------
id          INTEGER PRIMARY KEY
data_json   JSON NOT NULL
```

`data_json` belongs to the embedding application. Item access is scoped through
the item's algorithm state; the engine never interprets its fields.

## Registered algorithm

```sql
engine_algorithms
-----------------
id            INTEGER PRIMARY KEY
name          TEXT UNIQUE NOT NULL
version       TEXT NOT NULL
description   TEXT
config_json   JSON NOT NULL
```

An existing name may be registered again only with the same version and
canonical JSON configuration.

## Learning state

```sql
engine_states
-------------
id                  INTEGER PRIMARY KEY
learning_item_id    FK -> engine_items.id ON DELETE CASCADE
algorithm_id        FK -> engine_algorithms.id
revision             INTEGER NOT NULL DEFAULT 0
due_at               TEXT NOT NULL
state_json           JSON NOT NULL
UNIQUE (learning_item_id, algorithm_id)
```

`due_at` is an indexed projection for due queries. The algorithm owns
`state_json`. `revision` is incremented on every successful review and is used
for optimistic concurrency control.

## Review record

```sql
engine_reviews
--------------
id                  INTEGER PRIMARY KEY
learning_item_id    FK -> engine_items.id ON DELETE CASCADE
algorithm_id        FK -> engine_algorithms.id
rating              TEXT NOT NULL
review_json          JSON NOT NULL
response_time_ms    INTEGER
reviewed_at          TEXT NOT NULL
```

Review records are append-only during an item's lifetime. Removing an item also
removes its state and review history.

## Atomic review commit

The adapter updates state with the equivalent of:

```sql
UPDATE engine_states
SET due_at = ?, state_json = ?, revision = revision + 1
WHERE id = ? AND revision = ?;
```

If no row changes, the adapter raises a concurrency error and does not append a
review record. Both operations run in one SQLite transaction.

## Migrations

Applied versions are recorded in `engine_schema_migrations`. Version 1 creates
the engine schema; version 2 adds state revisions. Migrations are ordered,
idempotent and individually transactional.
