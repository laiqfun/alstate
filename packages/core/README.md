# `@alstate/core`

Experimental storage- and algorithm-independent learning scheduling runtime.

```ts
import { LearningEngine } from "@alstate/core";

const engine = await LearningEngine.create({ store, algorithm });
const item = await engine.add({ prompt: "Question", answer: "Answer" });
await engine.review(item.id, "good");
```

Applications provide a `LearningAlgorithm` and `LearningStore`. The core has no
Node.js or third-party runtime dependencies. Store implementations must preserve
the atomic and optimistic-concurrency semantics documented in the repository's
[architecture](https://github.com/laiqfun/alstate/blob/main/docs/architecture.md).

MIT
