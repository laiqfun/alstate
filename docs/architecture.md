# Alstate Architecture Design

> **Current profile:** The first application profile is English-vocabulary learning. The core architecture is organized around reusable `LearningItem`, content-module, learning-algorithm, import-strategy, and repository contracts.

## Architecture Overview

Alstate is a modular learning system. Its core does not assume that a display value such as a word uniquely identifies something being learned.

The vocabulary profile follows one central rule:

> One `LearningItem` represents one English meaning of a spelling.

Two LearningItems may therefore have the same `word` value while carrying different English meanings and independent learning states.

```text
                       CLI / UI
                          |
                   Application Layer
                          |
        +-----------------+-----------------+
        |                 |                 |
  Learning Items     Learning System   Module System
        |                 |                 |
        +-----------------+-----------------+
                          |
                 Repository Contracts
                          |
                  Infrastructure Layer
                          |
                  SQLite / File Storage
```

## Layer Design

### 1. Domain Layer

The Domain Layer contains stable business concepts and contracts. It does not depend on SQLite, the CLI, file formats, or a concrete FSRS package.

Core concepts:

```text
LearningItem
ModuleDefinition
LearningItemContent
Tag
LearningAlgorithm
LearningState
ReviewRecord
ImportStrategy
```

`LearningItem.id` is the identity. In the vocabulary profile, `LearningItem.word` is case-sensitive, may contain a phrase, and is not unique.

### 2. Learning Item System

The Learning Item System is responsible for:

- creating and identifying independently scheduled items;
- connecting items with content modules and tags;
- keeping item identity separate from display content;
- deleting item-owned content and learning data as one aggregate.

```text
LearningItem
   |
   +---- LearningItemContent
   |
   +---- LearningItemTag ---- Tag
   |
   +---- LearningState
   |
   +---- ReviewRecord
```

For English vocabulary, one item corresponds to one meaning:

```text
LearningItem #101: bank -> a financial institution
LearningItem #102: bank -> the side of a river
```

The repeated `word` value does not indicate a duplicate.

### 3. Module System

Content modules attach directly to a LearningItem. English meaning is no longer a structural parent for other content.

```text
LearningItem
   |
   +---- EnglishMeaning
   +---- ChineseMeaning
   +---- Example
   +---- Audio
   +---- MemoryNote
   +---- RelatedMeanings
```

All content records are siblings owned by the same LearningItem. A module defines its own schema and validation rules without changing the LearningItem structure.

#### RelatedMeanings Module

`RelatedMeanings` links a LearningItem to other LearningItems that represent other English meanings of the same spelling. It uses LearningItem IDs rather than treating the spelling as identity.

The module owns validation of its references. Deleting an item must also remove references to that item.

### 4. Learning System

The Learning System determines:

- which LearningItem is due;
- when it should be reviewed again;
- how a rating changes its learning state;
- what review history must be recorded.

```text
LearningAlgorithm
        |
        v
LearningState ---- LearningItem
        |
        v
ReviewRecord
```

#### LearningAlgorithm Contract

The contract keeps scheduling independent of the concrete algorithm package. An implementation must be able to:

- initialize state for a new LearningItem;
- calculate review options;
- apply a selected rating;
- calculate the next due time;
- expose retrievability where supported;
- preserve algorithm version, parameters, state, and review log data.

#### FSRS Module

The initial implementation uses FSRS completely rather than a simplified imitation.

The FSRS module:

- supports the four ratings `Again`, `Hard`, `Good`, and `Easy`;
- preserves the complete FSRS card state and review log;
- records the algorithm and implementation version;
- allows FSRS parameters to be configured and upgraded explicitly;
- adapts the maintained TypeScript implementation behind the project-owned LearningAlgorithm contract.

The Domain Layer does not expose third-party package types, so the FSRS implementation can be upgraded without changing application use cases.

### 5. Application Layer

The Application Layer coordinates use cases such as:

```text
Create Learning Item
Manage Item Content
Link Related Meanings
Import Learning Items
Review Learning Item
Modify Learning Settings
```

It coordinates domain contracts and transaction boundaries without containing CLI presentation or SQL.

### 6. Interface Layer

The first interface is a CLI. It receives commands, displays content, collects one of the four FSRS ratings, and presents application results.

The Interface Layer does not schedule reviews or access SQLite directly.

### 7. Infrastructure Layer

The Infrastructure Layer provides concrete implementations for:

```text
SQLite repositories
Database migrations
File access
```

Repository direction:

```text
Domain Repository Contract
            |
            v
Infrastructure Implementation
            |
            v
          SQLite
```

## Import Strategy

Import identity and conflict handling are extension policies, not fixed domain behavior.

```text
External Source
      |
      v
Import Parser
      |
      v
ImportStrategy
      |
      v
Create LearningItem and Content
```

The default strategy is append-only:

- every valid imported record creates a new LearningItem;
- no record is skipped, overwritten, merged, or deduplicated;
- `word` is never used as an item identity key.

Developers may provide another ImportStrategy later to implement source-specific identity, conflict detection, merging, skipping, or overwriting.

## Data Flows

### Review Flow

```text
User
  |
  v
CLI
  |
  v
Review Service
  |
  v
Select Due LearningItem
  |
  v
Load Item Content and FSRS State
  |
  v
Collect Again / Hard / Good / Easy
  |
  v
FSRS Algorithm Module
  |
  +---- Update LearningState
  |
  +---- Create ReviewRecord
```

### Import Flow

```text
External File
  |
  v
Parser
  |
  v
Configured ImportStrategy
  |
  v
Create LearningItem
  |
  v
Create LearningItemContent
  |
  v
Save through Repositories
```

## Deletion Rules

Deleting a LearningItem deletes:

- its LearningItemContent records;
- its tag associations;
- its LearningState records;
- its ReviewRecord history;
- references to it from RelatedMeanings modules.

Deleting a Tag removes tag associations but does not delete any LearningItem.

Soft deletion and recovery are outside the initial scope.

## Initial Implementation

The first implementation focuses on:

```text
CLI
LearningItem management
Content modules
RelatedMeanings module
Complete FSRS module
Append-only import strategy
SQLite database
```

The architecture keeps content, scheduling, import policy, persistence, and interface concerns independently replaceable.
