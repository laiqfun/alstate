# `@alstate/fsrs`

Experimental first-party adapter from `ts-fsrs` to `@alstate/core`.

```ts
import { FsrsAlgorithm } from "@alstate/fsrs";

const algorithm = new FsrsAlgorithm({ requestRetention: 0.9 });
```

This package does not reimplement FSRS. It delegates scheduling to `ts-fsrs`
and owns the Alstate rating mapping, JSON persistence format and date
conversion.

MIT
