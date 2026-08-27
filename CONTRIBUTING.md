# Contributing

Alstate is experimental and intentionally small. Changes should preserve the
package boundaries documented in `docs/architecture.md` and be driven by a
concrete application or adapter need.

## Development

Requires Node.js 22.13 or later.

```bash
npm install
npm run check
```

`npm run check` builds every workspace, enforces the core dependency boundary,
type-checks source and tests, and runs package plus cross-package integration
tests.

## Pull requests

- Add tests for behavior changes, including failure and concurrency paths.
- Keep application schemas and interaction policy outside public packages.
- Do not expose `ts-fsrs` or SQLite types through `@alstate/core`.
- Treat persisted state and algorithm configuration changes as compatibility
  changes and document them.
- Keep the three public package versions in lockstep during `0.x`.
