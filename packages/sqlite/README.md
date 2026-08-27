# `@alstate/sqlite`

Experimental SQLite persistence adapter for `@alstate/core`, implemented with
Node.js `node:sqlite`.

```ts
import { SqliteLearningStore } from "@alstate/sqlite";

const store = new SqliteLearningStore("learning.db");
```

Requires Node.js 22.13 or later. The adapter applies schema migrations on open,
uses transactions for composite writes and rejects stale review revisions.

MIT
