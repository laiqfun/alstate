# Vocabulary CLI example

This is a runnable application built on Alstate. Nothing in this directory is
part of the engine package API.

## Structure

```text
algorithm/fsrs.ts                  concrete scheduling adapter
app/create-app.ts                  composition root
cli/run-cli.ts                     command handling
domain/vocabulary-item.ts          vocabulary data and validation
infrastructure/read-import-file.ts JSON input adapter
main.ts                            executable entry point
```

The application stores its complete vocabulary record in the engine's opaque
item data. FSRS is implemented here and injected at composition time.

## Run

```bash
npm run example:vocabulary -- help
npm run example:vocabulary -- item:add bank
npm run example:vocabulary -- meaning:add 1 english "a financial institution"
npm run example:vocabulary -- review good
```

Data defaults to `.alstate/vocabulary-example.db`. Override it with
`ALSTATE_VOCABULARY_DB_PATH`.

## Import format

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

Import is application code rather than an engine strategy.
