# Alstate CLI

## Database

Alstate stores data in `.alstate/alstate.db` under the current working directory. Set `ALSTATE_DB_PATH` to use another path.

```bash
ALSTATE_DB_PATH=/path/to/alstate.db npm run dev -- item:list
```

## Commands

```text
init
item:add <word>
item:list [word]
item:show <item-id>
item:delete <item-id>
content:add <item-id> <module-name> <json> [order]
content:delete <content-id>
tag:create <name>
tag:list
tag:attach <item-id> <tag-id>
import <json-file>
review [again|hard|good|easy]
history <item-id>
```

Arguments containing spaces or JSON must be quoted for the active shell.

## Example Workflow

```bash
npm run dev -- init
npm run dev -- item:add bank
npm run dev -- content:add 1 EnglishMeaning '{"meaning":"a financial institution"}' 0
npm run dev -- content:add 1 ChineseMeaning '{"meaning":"银行"}' 1
npm run dev -- content:add 1 Example '{"sentence":"She deposited money at the bank."}' 2
npm run dev -- review
npm run dev -- history 1
```

`review` prompts for an FSRS rating. Pass a rating argument for non-interactive use.

## Built-in Content Modules

| Module | Cardinality | Data |
| --- | --- | --- |
| `EnglishMeaning` | single | `{ "meaning": string }` |
| `ChineseMeaning` | multiple | `{ "meaning": string }` |
| `Example` | multiple | `{ "sentence": string, "translation"?: string, "source"?: string }` |
| `Audio` | multiple | `{ "uri": string, "accent"?: string }` |
| `MemoryNote` | multiple | `{ "note": string }` |
| `RelatedMeanings` | single | `{ "learningItemIds": number[] }` |

RelatedMeaning targets must exist, must not reference the current item, and must have the same case-sensitive `word` value.

## JSON Import

The import file is an array. The default strategy appends every record as a new LearningItem without comparing `word` values.

```json
[
  {
    "word": "bank",
    "sourceReference": "example-001",
    "tags": ["CET6"],
    "contents": [
      {
        "moduleName": "EnglishMeaning",
        "data": { "meaning": "a financial institution" },
        "orderIndex": 0
      },
      {
        "moduleName": "ChineseMeaning",
        "data": { "meaning": "银行" },
        "orderIndex": 1
      }
    ]
  }
]
```

Each record is transactional. An invalid record is rolled back; successfully imported earlier records remain saved.

