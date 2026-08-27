# AGENTS.md

These instructions apply to the entire repository.

## Project intent

Alstate is an experimental, headless learning scheduling runtime. Keep the
public engine small and application-agnostic. Vocabulary schemas, import rules,
CLI behavior, rendering, authentication, tags and decks belong in applications,
not in the public runtime packages.

The public packages are:

- `@alstate/core`: engine workflow and adapter contracts;
- `@alstate/sqlite`: the `node:sqlite` store adapter;
- `@alstate/fsrs`: the first-party adapter for `ts-fsrs`.

Dependency direction is one-way: SQLite and FSRS may depend on core; core must
not depend on either adapter. The private vocabulary example may depend on all
three public packages.

## Repository layout

- `packages/core/`: runtime types, errors, contracts and `LearningEngine`;
- `packages/sqlite/`: SQLite schema migrations and `LearningStore` adapter;
- `packages/fsrs/`: FSRS state serialization and `LearningAlgorithm` adapter;
- `examples/vocabulary-cli/`: private consumer example, never published;
- `test/integration/`: cross-package behavior tests;
- `docs/`: English and Simplified Chinese architecture and data-model docs;
- `scripts/`: package-boundary and packed-consumer verification.

There is intentionally no root `src/` directory. Do not recreate one.

## Required architecture invariants

- `@alstate/core` must have no Node.js-specific or third-party runtime imports.
- Do not expose SQLite or `ts-fsrs` types through the core public API.
- An engine instance is bound to one registered algorithm; item operations must
  remain scoped to that algorithm.
- Creating an item with initial state is atomic.
- Updating state and appending its review record is atomic.
- Review commits must compare the stored state `revision` and reject stale
  concurrent transitions.
- Persisted algorithm name, version and canonical configuration identify how
  state is interpreted. Never reinterpret them silently.
- Application data, algorithm state and review data must remain JSON-compatible.
- `@alstate/fsrs` adapts `ts-fsrs`; do not reimplement FSRS mathematics.
- Published SQLite migrations are append-only. Do not edit an already released
  migration; add a new ordered migration and an upgrade test.

## TypeScript conventions

- Preserve the strict settings in `tsconfig.base.json`.
- Use NodeNext ESM and include `.js` extensions in relative imports.
- Use `import type` and `export type` for type-only dependencies.
- Keep public values readonly where practical and validate persisted data at
  runtime rather than trusting TypeScript types at storage boundaries.
- Export public API only through each package's `src/index.ts`.
- Do not commit generated `dist/`, `.test-dist/`, `.integration-dist/` or
  `pack-test/` contents.

## Testing and verification

Run the narrowest relevant test while iterating, then run the root check before
hand-off:

```bash
npm run test -w @alstate/core
npm run test -w @alstate/sqlite
npm run test -w @alstate/fsrs
npm run test -w @alstate/vocabulary-example
npm run test:integration
npm run check
```

Behavior changes require tests. Include failure paths for validation and
persistence changes, and include concurrency or rollback coverage when atomic
state is affected.

When changing package manifests, exports, declarations, dependency boundaries
or build configuration, also run:

```bash
npm run verify:packages
```

This packs all three public packages, installs the tarballs in a clean temporary
consumer, type-checks that consumer and runs an end-to-end workflow.

## Documentation

Keep paired documentation synchronized when behavior or architecture changes:

- `README.md` and `README.zh-CN.md`;
- `docs/architecture.md` and `docs/architecture.zh-CN.md`;
- `docs/data-model.md` and `docs/data-model.zh-CN.md`.

Update the relevant package README when its installation, public API or runtime
requirements change. Clearly distinguish publishable packages from the private
example and repository-only integration tests.

## Versions and releases

- The three public packages use lockstep versions during `0.x`.
- The workspace root and vocabulary example remain private and are not released.
- Treat public API, persisted state, algorithm identity and SQLite schema changes
  as compatibility-sensitive.
- Never overwrite an npm version or move a published Git tag.
- Do not publish packages, push commits, create tags or create releases unless
  the user explicitly requests the external action.
- For an authorized release, verify packages first and publish in dependency
  order: core, SQLite, then FSRS.

## Working practices

- Preserve unrelated user changes and avoid destructive Git commands.
- Prefer small changes that keep the public surface compact.
- Do not add adapters or abstractions without a concrete consumer need.
- Before finishing, report which checks ran and call out any check that could not
  be completed.
