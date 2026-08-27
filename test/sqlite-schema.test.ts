import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { migrateDatabase } from "../src/sqlite/migrations.js";

test("the SQLite schema contains only engine-owned tables", () => {
  const database = new DatabaseSync(":memory:");
  migrateDatabase(database);
  migrateDatabase(database);

  const tables = (
    database
      .prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `)
      .all() as Array<{ name: string }>
  ).map((row) => row.name);
  assert.deepEqual(tables, [
    "engine_algorithms",
    "engine_items",
    "engine_reviews",
    "engine_schema_migrations",
    "engine_states",
  ]);
  database.close();
});
