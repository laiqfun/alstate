# Alstate Data Model Design

> **Current scope:** This data model is designed for learning English vocabulary. `Word` is the central learning item, and the surrounding content and learning-state relationships are word-oriented. A future content-agnostic model would require a separate redesign.

## Design Overview

Alstate uses a modular data model.

The core entities are:

- Word: vocabulary entity
- ModuleDefinition: content module definition
- WordContent: content module instance attached to a word
- Tag: reusable labels
- WordTag: relationship between words and tags
- LearningAlgorithm: learning algorithm definition
- LearningState: current learning state
- ReviewRecord: learning history records

---

# Word

## Description

Represents an independent vocabulary entity.

A Word only represents the word itself.

It does not contain:

- meanings
- examples
- tags
- learning states

## Schema

```sql
Word
----
id              PK
word            TEXT
```

Example:

| id | word |
| --- | --- |
| 1 | distinction |

---

# ModuleDefinition

## Description

Defines available content modules.

A module is created by developers and has a fixed data structure.

Different modules can have different schemas.

Examples:

- Chinese meaning
- English meaning
- Example sentence
- Memory note
- Audio

## Schema

```sql
ModuleDefinition
----------------
id              PK

name            UNIQUE

schema          JSON

description

version
```

Example:

Chinese Meaning Module:

```json
{
    "name": "ChineseMeaning",
    "schema": {
        "meaning": "string"
    }
}
```

Example Sentence Module:

```json
{
    "name": "Example",
    "schema": {
        "sentence": "string",
        "translation": "string",
        "source": "string"
    }
}
```

---

# WordContent

## Description

Represents an instance of a content module attached to a Word.

A Word can contain multiple WordContent records.

Each WordContent references a ModuleDefinition and stores data following that module's schema.

## Schema

```sql
WordContent
-----------
id              PK

word_id         FK -> Word.id

module_id       FK -> ModuleDefinition.id

data            JSON

order_index
```

Example:

Word:

```
distinction
```

Content modules:

| module | data | order |
| --- | --- | --- |
| ChineseMeaning | {"meaning":"区别"} | 1 |
| Example | {"sentence":"There is a distinction between AI and AGI."} | 2 |
| MemoryNote | {"note":"distinction is different from direction"} | 3 |

---

# Tag

## Description

Defines reusable labels.

Examples:

- CET6
- TOEFL
- Computer Science
- Academic

## Schema

```sql
Tag
---
id              PK

name            UNIQUE

description
```

---

# WordTag

## Description

Represents the many-to-many relationship between Word and Tag.

A Word can have multiple Tags.

A Tag can belong to multiple Words.

## Schema

```sql
WordTag
-------
word_id         FK -> Word.id

tag_id          FK -> Tag.id
```

Example:

```
distinction

    |
    +---- CET6
    |
    +---- Computer Science
```

---

# LearningAlgorithm

## Description

Defines available learning algorithms.

Different algorithms can use different learning strategies and states.

Examples:

- SM2
- Spaced Repetition
- AI Adaptive Learning

## Schema

```sql
LearningAlgorithm
-----------------
id              PK

name            UNIQUE

description

version
```

---

# LearningState

## Description

Stores the current learning state of a Word under a specific learning algorithm.

Different algorithms can have different state structures.

## Schema

```sql
LearningState
-------------
id              PK

word_id         FK -> Word.id

algorithm_id    FK -> LearningAlgorithm.id

state_data      JSON
```

Example:

SM2:

```json
{
    "review_count": 5,
    "last_review": "2026-08-25",
    "next_review": "2026-09-01",
    "difficulty": 3
}
```

---

# ReviewRecord

## Description

Stores historical learning events.

Each review operation creates one record.

## Schema

```sql
ReviewRecord
------------
id              PK

word_id         FK -> Word.id

algorithm_id    FK -> LearningAlgorithm.id

result

response_time

created_at
```

Example:

```json
{
    "result": "wrong",
    "answer": "direction"
}
```

---

# Entity Relationship

```
                    ModuleDefinition
                           |
                           |
Word ------------ WordContent


Word ------------ WordTag ------------ Tag


Word ------------ LearningState ------ LearningAlgorithm


Word ------------ ReviewRecord
```
