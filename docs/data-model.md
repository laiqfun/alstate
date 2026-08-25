# Alstate Data Model Design

> **Current profile:** The stored learning unit is a `LearningItem`. In the English-vocabulary profile, each LearningItem represents one English meaning of a spelling. The architecture keeps content and learning algorithms modular so that other profiles can reuse the same core contracts.

## Design Overview

Core entities:

- LearningItem: independently scheduled learning unit;
- ModuleDefinition: content-module definition;
- LearningItemContent: module instance attached directly to an item;
- Tag: reusable label;
- LearningItemTag: many-to-many item/tag association;
- LearningAlgorithm: registered scheduling-algorithm definition;
- LearningState: current algorithm state for an item;
- ReviewRecord: immutable review event.

ImportStrategy is an application extension contract rather than a persisted entity.

## LearningItem

### Description

A LearningItem is the identity and deletion boundary for something learned independently.

For English vocabulary, each row represents one English meaning. The `word` value is case-sensitive and is not unique. Words and phrases use the same representation.

### Schema

```sql
LearningItem
------------
id              PK
word            TEXT NOT NULL
```

Example:

| id | word | represented meaning |
| --- | --- | --- |
| 101 | bank | a financial institution |
| 102 | bank | the side of a river |
| 103 | Apple | a proper name |
| 104 | apple | a fruit |

Only `id` identifies the LearningItem. `word` must not be used for deduplication or foreign-key relationships.

## ModuleDefinition

### Description

Defines an available content module and the schema of its data. Developers can add modules without changing LearningItem.

### Schema

```sql
ModuleDefinition
----------------
id              PK
name            TEXT UNIQUE NOT NULL
schema          JSON NOT NULL
cardinality     TEXT NOT NULL
description     TEXT
version         TEXT NOT NULL
```

Initial content-module types include:

- EnglishMeaning;
- ChineseMeaning;
- Example;
- Audio;
- MemoryNote;
- RelatedMeanings.

## LearningItemContent

### Description

Represents a content-module instance attached directly to a LearningItem.

EnglishMeaning, ChineseMeaning, Example, and other contents are siblings. No content record is the structural parent of another.

### Schema

```sql
LearningItemContent
-------------------
id                  PK
learning_item_id    FK -> LearningItem.id ON DELETE CASCADE
module_id           FK -> ModuleDefinition.id
data                JSON NOT NULL
order_index         INTEGER NOT NULL
```

Example for LearningItem `101`:

| module | data | order |
| --- | --- | --- |
| EnglishMeaning | `{ "meaning": "a financial institution" }` | 1 |
| ChineseMeaning | `{ "meaning": "银行" }` | 2 |
| Example | `{ "sentence": "She deposited money at the bank." }` | 3 |
| RelatedMeanings | `{ "learningItemIds": [102] }` | 4 |

### RelatedMeanings

The RelatedMeanings module stores references to other LearningItem IDs representing other meanings of the same spelling.

Its module implementation is responsible for:

- validating that referenced items exist;
- preventing self-references;
- validating the same-word rule for the vocabulary profile;
- removing stale references when a target LearningItem is deleted.

## Tag

### Schema

```sql
Tag
---
id              PK
name            TEXT UNIQUE NOT NULL
description     TEXT
```

## LearningItemTag

### Description

Represents the many-to-many relationship between LearningItem and Tag.

### Schema

```sql
LearningItemTag
---------------
learning_item_id    FK -> LearningItem.id ON DELETE CASCADE
tag_id              FK -> Tag.id ON DELETE CASCADE

PRIMARY KEY (learning_item_id, tag_id)
```

Deleting a Tag removes these associations and does not delete LearningItems.

## LearningAlgorithm

### Description

Registers a scheduling algorithm and the configuration needed to interpret its state.

### Schema

```sql
LearningAlgorithm
-----------------
id              PK
name            TEXT UNIQUE NOT NULL
description     TEXT
version         TEXT NOT NULL
config_data     JSON NOT NULL
```

The initial algorithm is the complete FSRS implementation. Its stored version must distinguish algorithm and adapter upgrades.

## LearningState

### Description

Stores the current state of one LearningItem under one learning algorithm.

### Schema

```sql
LearningState
-------------
id                  PK
learning_item_id    FK -> LearningItem.id ON DELETE CASCADE
algorithm_id        FK -> LearningAlgorithm.id
due_at               TEXT NOT NULL
state_data          JSON NOT NULL

UNIQUE (learning_item_id, algorithm_id)
```

For FSRS, `state_data` preserves the complete card state returned by the selected FSRS implementation rather than a project-specific subset.

`due_at` is a queryable projection of the next due time contained in the algorithm state. It must be indexed so due items can be selected without scanning JSON.

## ReviewRecord

### Description

Stores an immutable review event for a LearningItem. Deleting the LearningItem deletes its review history.

### Schema

```sql
ReviewRecord
------------
id                  PK
learning_item_id    FK -> LearningItem.id ON DELETE CASCADE
algorithm_id        FK -> LearningAlgorithm.id
rating              TEXT NOT NULL
review_data         JSON NOT NULL
response_time_ms    INTEGER
reviewed_at         TEXT NOT NULL
```

For FSRS, domain rating values are:

```text
again
hard
good
easy
```

`review_data` preserves the complete FSRS review log, including its numeric FSRS Rating, needed for history, replay, analysis, and future parameter optimization.

## Import Contract

Import behavior is provided through an ImportStrategy contract.

The default append-only strategy follows these rules:

- every valid source record creates a new LearningItem ID;
- all valid content belonging to that record is written;
- no comparison by `word` is performed;
- no automatic skip, overwrite, merge, or conflict warning is performed.

Developers can provide custom strategies later. The strategy is responsible for defining identity and conflict behavior for its own source format.

## Deletion Ownership

```text
LearningItem
   |
   +---- LearningItemContent       DELETE CASCADE
   +---- LearningItemTag           DELETE CASCADE
   +---- LearningState             DELETE CASCADE
   +---- ReviewRecord              DELETE CASCADE
```

RelatedMeanings references to a deleted LearningItem must also be removed by the module implementation.

## Entity Relationship

```text
                         ModuleDefinition
                                |
                                |
LearningItem -------- LearningItemContent


LearningItem -------- LearningItemTag -------- Tag


LearningItem -------- LearningState ---------- LearningAlgorithm


LearningItem -------- ReviewRecord ----------- LearningAlgorithm
```
