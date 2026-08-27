# Vocabulary CLI example

This private workspace is a runnable consumer of all three Alstate packages. It
is not published and none of its vocabulary model or CLI is part of the engine
API.

```text
src/app/create-app.ts                  composition root
src/cli/run-cli.ts                     command handling
src/domain/vocabulary-item.ts          vocabulary data and validation
src/infrastructure/read-import-file.ts JSON input adapter
src/main.ts                            executable entry point
```

Scheduling comes from `@alstate/fsrs`; persistence comes from
`@alstate/sqlite`. The complete vocabulary record is stored as opaque item data.

## Run

```bash
npm run example:vocabulary -- help
npm run example:vocabulary -- item:add bank
npm run example:vocabulary -- meaning:add 1 english "a financial institution"
npm run example:vocabulary -- review good
```

Data defaults to `.alstate/vocabulary-example.db`. Override it with
`ALSTATE_VOCABULARY_DB_PATH`.

Import accepts a JSON array such as:

```json
[
  {
    "word": "bank",
    "englishMeanings": ["a financial institution"],
    "chineseMeanings": ["银行"],
    "notes": [],
    "tags": ["CET6"]
  }
]
```
