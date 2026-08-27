# Engine data model

The SQLite adapter persists four engine concepts.

## Learning item

```sql
engine_items
------------
id          INTEGER PRIMARY KEY
data_json   JSON NOT NULL
```

`data_json` belongs to the embedding application. The engine does not reserve or
index any field inside it.

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
configuration.

## Learning state

```sql
engine_states
-------------
id                  INTEGER PRIMARY KEY
learning_item_id    FK -> engine_items.id ON DELETE CASCADE
algorithm_id        FK -> engine_algorithms.id
due_at               TEXT NOT NULL
state_json           JSON NOT NULL
UNIQUE (learning_item_id, algorithm_id)
```

`due_at` is an indexed projection used for due queries. The injected algorithm
owns `state_json`.

## Review record

```sql
engine_reviews
--------------
id                  INTEGER PRIMARY KEY
learning_item_id    FK -> engine_items.id ON DELETE CASCADE
algorithm_id        FK -> engine_algorithms.id
rating              TEXT NOT NULL
review_json         JSON NOT NULL
response_time_ms    INTEGER
reviewed_at         TEXT NOT NULL
```

Review records are append-only during an item's lifetime. Removing an item also
removes its state and history.

## Transaction boundaries

Two writes must be atomic:

1. creating an item and its initial state;
2. updating state and appending the corresponding review record.

These are composite `LearningStore` operations rather than transactions exposed
to every application caller.
