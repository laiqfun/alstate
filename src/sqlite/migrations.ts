import type { DatabaseSync } from "node:sqlite";

const migrations = [
  {
    version: 1,
    name: "learning_engine_schema",
    sql: `
      CREATE TABLE engine_items (
        id INTEGER PRIMARY KEY,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      ) STRICT;

      CREATE TABLE engine_algorithms (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
        description TEXT,
        version TEXT NOT NULL CHECK (length(trim(version)) > 0),
        config_json TEXT NOT NULL CHECK (json_valid(config_json))
      ) STRICT;

      CREATE TABLE engine_states (
        id INTEGER PRIMARY KEY,
        learning_item_id INTEGER NOT NULL,
        algorithm_id INTEGER NOT NULL,
        due_at TEXT NOT NULL,
        state_json TEXT NOT NULL CHECK (json_valid(state_json)),
        UNIQUE (learning_item_id, algorithm_id),
        FOREIGN KEY (learning_item_id)
          REFERENCES engine_items (id) ON DELETE CASCADE,
        FOREIGN KEY (algorithm_id)
          REFERENCES engine_algorithms (id) ON DELETE RESTRICT
      ) STRICT;

      CREATE INDEX engine_states_due_idx
        ON engine_states (algorithm_id, due_at, learning_item_id);

      CREATE TABLE engine_reviews (
        id INTEGER PRIMARY KEY,
        learning_item_id INTEGER NOT NULL,
        algorithm_id INTEGER NOT NULL,
        rating TEXT NOT NULL CHECK (length(trim(rating)) > 0),
        review_json TEXT NOT NULL CHECK (json_valid(review_json)),
        response_time_ms INTEGER CHECK (
          response_time_ms IS NULL OR response_time_ms >= 0
        ),
        reviewed_at TEXT NOT NULL,
        FOREIGN KEY (learning_item_id)
          REFERENCES engine_items (id) ON DELETE CASCADE,
        FOREIGN KEY (algorithm_id)
          REFERENCES engine_algorithms (id) ON DELETE RESTRICT
      ) STRICT;

      CREATE INDEX engine_reviews_item_time_idx
        ON engine_reviews (learning_item_id, reviewed_at DESC, id DESC);
    `,
  },
] as const;

export function migrateDatabase(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS engine_schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    ) STRICT;
  `);
  const applied = new Set(
    (
      database
        .prepare("SELECT version FROM engine_schema_migrations")
        .all() as Array<{ version: number }>
    ).map((row) => row.version),
  );
  const record = database.prepare(`
    INSERT INTO engine_schema_migrations (version, name, applied_at)
    VALUES (?, ?, ?)
  `);

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }
    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(migration.sql);
      record.run(migration.version, migration.name, new Date().toISOString());
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}
