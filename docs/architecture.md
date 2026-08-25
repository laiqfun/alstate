# Alstate Architecture Design

> **Current scope:** This architecture is designed for learning English vocabulary. Its systems, entities, modules, and review flows are modeled around words. Supporting other kinds of learning content is a possible future direction, not a capability assumed by the current design.

## Architecture Overview

Alstate is designed as a modular learning system.

The system separates:

- **Domain Layer**: core entities and business concepts
- **Module Layer**: extensible content modules
- **Learning Layer**: learning algorithms and user learning state
- **Infrastructure Layer**: database and external services
- **Interface Layer**: user interaction methods

Overall structure:

```text
                    CLI / UI
                      |
                      |
                Application Layer
                      |
        --------------------------------
        |              |               |
   Word System   Learning System   Module System
        |              |               |
        --------------------------------
                      |
                Infrastructure
                      |
                  Database
```

---

# Layer Design

## 1. Domain Layer

The domain layer contains core concepts.

It does not depend on:

- database implementation
- CLI interface
- AI services

Core entities:

```text
Word

ModuleDefinition

WordContent

Tag

LearningAlgorithm

LearningState

ReviewRecord
```

---

## 2. Word System

Responsible for vocabulary entities.

Responsibilities:

- store words
- provide word identity
- connect words with content modules
- connect words with tags

Structure:

```text
Word

 |
 |
 +---- WordContent

 |
 |
 +---- WordTag ---- Tag
```

The Word entity itself does not contain:

- translation
- examples
- learning progress

---

## 3. Module System

The module system provides extensible word content.

A module consists of:

```text
ModuleDefinition

        +

WordContent
```

Relationship:

```text
ModuleDefinition
        |
        |
        ↓
WordContent
        |
        |
        ↓
Word
```

Example modules:

```text
ChineseMeaning

EnglishMeaning

Example

Audio

MemoryNote
```

A developer can define new modules without changing the Word structure.

---

## 4. Learning System

Responsible for determining:

- what to review
- when to review
- how to evaluate memory

Components:

```text
LearningAlgorithm

        |

        ↓

LearningState

        |

        ↓

ReviewRecord
```

---

## LearningAlgorithm

Defines a learning strategy.

Examples:

```text
Simple Review

SM2

AI Adaptive Learning
```

Different algorithms can have different state structures.

---

## LearningState

Stores the current state of learning.

Example:

```json
{
    "review_count": 5,
    "next_review": "2026-09-01"
}
```

---

## ReviewRecord

Stores historical learning events.

Used for:

- algorithm optimization
- learning analysis
- error analysis

---

# 5. Application Layer

The application layer coordinates user operations.

Examples:

```text
Review Word

Import Vocabulary

Add Content Module

Modify Learning Settings
```

It connects:

```text
User Command

        ↓

Application Service

        ↓

Domain Model
```

---

# 6. Interface Layer

The first interface is CLI.

Responsibilities:

- receive user commands
- display learning content
- collect user responses

Example:

```text
$ alstate review

distinction

Meaning?

> 区别

Result:

Remember / Forget
```

The interface does not contain learning logic.

---

# 7. Infrastructure Layer

Provides external implementations.

Components:

```text
Database

File Storage
```

Example:

```text
SQLite

        ↓

Repository

        ↓

Domain Layer
```

---

# Repository Design

The domain layer does not directly access the database.

Example:

```text
WordRepository

LearningRepository

ModuleRepository
```

Structure:

```text
Domain

    |

Repository Interface

    |

Database Implementation
```

---

# Data Flow

## Review Flow

```text
User

 ↓

CLI

 ↓

Review Service

 ↓

Learning Algorithm

 ↓

Select Word

 ↓

Load WordContent

 ↓

Display

 ↓

Record Result

 ↓

Update LearningState
```

---

## Import Flow

```text
CSV File

 ↓

Import Service

 ↓

Create Word

 ↓

Create WordContent

 ↓

Save Database
```

---

# Extension Design

The architecture supports adding new capabilities through modules.

Examples:

## New Content Module

```text
Add ModuleDefinition

        ↓

Create WordContent
```

No changes to Word.

---

## New Learning Algorithm

```text
Add LearningAlgorithm

        ↓

Create LearningState
```

No changes to Word.

---

# Initial Implementation

The first implementation focuses on:

```text
CLI

Word Management

Module System

Basic Review Algorithm

SQLite Database
```

The architecture keeps future extensions possible while maintaining a simple initial implementation.
