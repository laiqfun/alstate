# `@alstate/fsrs`

Experimental first-party adapter from `ts-fsrs` to the `@alstate/core`
algorithm contract. The package delegates scheduling mathematics to `ts-fsrs`
and owns the Alstate rating mapping, JSON persistence format and date
conversion.

## Install

```bash
npm install @alstate/core @alstate/fsrs
```

Add a `LearningStore` separately; `@alstate/sqlite` is the first-party choice.

## Use

```ts
import { FsrsAlgorithm } from "@alstate/fsrs";

const algorithm = new FsrsAlgorithm({
  requestRetention: 0.9,
  maximumInterval: 36_500,
  enableFuzz: true,
  enableShortTerm: true,
  learningSteps: ["1m", "10m"],
  relearningSteps: ["10m"],
});
```

Pass it to `LearningEngine.create({ store, algorithm })`. The adapter exposes
these exact rating values:

```text
again  hard  good  easy
```

Pass a lower-case value to `engine.review()`. Use the previews returned by
`engine.due()` to display the next due time for each choice.

## Options

| Option | Purpose |
| --- | --- |
| `requestRetention` | Target recall probability; higher values generally increase review load. |
| `maximumInterval` | Maximum scheduled interval in days. |
| `weights` | Complete FSRS model weight array. |
| `enableFuzz` | Randomizes longer intervals slightly. |
| `enableShortTerm` | Enables short-term scheduling behavior. |
| `learningSteps` | Steps for new items, using values such as `"1m"`, `"10m"` and `"1d"`. |
| `relearningSteps` | Steps used after a lapse. |

Omitted options use the defaults from the installed `ts-fsrs` version.
`algorithm.configuration` exposes the complete normalized configuration that
Alstate registers.

## Persistence compatibility

Algorithm name, `ts-fsrs` version and normalized configuration identify how
persisted FSRS state is interpreted. Reopening an existing database with changed
options or a changed FSRS version raises `AlgorithmMismatchError`; migrate state
explicitly or use another database. Alstate `0.1.x` has no general state
migration API.

The exported `FsrsState` and `FsrsReviewData` types describe persisted JSON for
typed inspection. Applications should treat those formats as algorithm-owned.

- [SQLite and FSRS adapter guide](https://github.com/laiqfun/alstate/blob/main/docs/adapters.md)
- [Complete API reference](https://github.com/laiqfun/alstate/blob/main/docs/api-reference.md)
- [Getting started](https://github.com/laiqfun/alstate/blob/main/docs/getting-started.md)

MIT
