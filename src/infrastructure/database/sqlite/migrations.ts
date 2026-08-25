import type { DatabaseSync } from "node:sqlite";

interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

const migrations: readonly Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    sql: `
      CREATE TABLE learning_items (
        id INTEGER PRIMARY KEY,
        word TEXT NOT NULL CHECK (length(trim(word)) > 0)
      ) STRICT;

      CREATE INDEX learning_items_word_idx
        ON learning_items (word);

      CREATE TABLE module_definitions (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
        schema_json TEXT NOT NULL CHECK (json_valid(schema_json)),
        cardinality TEXT NOT NULL CHECK (cardinality IN ('single', 'multiple')),
        description TEXT,
        version TEXT NOT NULL CHECK (length(trim(version)) > 0)
      ) STRICT;

      CREATE TABLE learning_item_contents (
        id INTEGER PRIMARY KEY,
        learning_item_id INTEGER NOT NULL,
        module_id INTEGER NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json)),
        order_index INTEGER NOT NULL CHECK (order_index >= 0),
        FOREIGN KEY (learning_item_id)
          REFERENCES learning_items (id) ON DELETE CASCADE,
        FOREIGN KEY (module_id)
          REFERENCES module_definitions (id) ON DELETE RESTRICT
      ) STRICT;

      CREATE INDEX learning_item_contents_item_order_idx
        ON learning_item_contents (learning_item_id, order_index, id);

      CREATE INDEX learning_item_contents_module_idx
        ON learning_item_contents (module_id);

      CREATE TABLE tags (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
        description TEXT
      ) STRICT;

      CREATE TABLE learning_item_tags (
        learning_item_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (learning_item_id, tag_id),
        FOREIGN KEY (learning_item_id)
          REFERENCES learning_items (id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id)
          REFERENCES tags (id) ON DELETE CASCADE
      ) STRICT;

      CREATE INDEX learning_item_tags_tag_idx
        ON learning_item_tags (tag_id, learning_item_id);

      CREATE TABLE learning_algorithms (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
        description TEXT,
        version TEXT NOT NULL CHECK (length(trim(version)) > 0),
        config_json TEXT NOT NULL CHECK (json_valid(config_json))
      ) STRICT;

      CREATE TABLE learning_states (
        id INTEGER PRIMARY KEY,
        learning_item_id INTEGER NOT NULL,
        algorithm_id INTEGER NOT NULL,
        due_at TEXT NOT NULL,
        state_json TEXT NOT NULL CHECK (json_valid(state_json)),
        UNIQUE (learning_item_id, algorithm_id),
        FOREIGN KEY (learning_item_id)
          REFERENCES learning_items (id) ON DELETE CASCADE,
        FOREIGN KEY (algorithm_id)
          REFERENCES learning_algorithms (id) ON DELETE RESTRICT
      ) STRICT;

      CREATE INDEX learning_states_due_idx
        ON learning_states (algorithm_id, due_at, learning_item_id);

      CREATE TABLE review_records (
        id INTEGER PRIMARY KEY,
        learning_item_id INTEGER NOT NULL,
        algorithm_id INTEGER NOT NULL,
        rating TEXT NOT NULL CHECK (length(trim(rating)) > 0),
        review_json TEXT NOT NULL CHECK (json_valid(review_json)),
        response_time_ms REAL CHECK (
          response_time_ms IS NULL OR response_time_ms >= 0
        ),
        reviewed_at TEXT NOT NULL,
        FOREIGN KEY (learning_item_id)
          REFERENCES learning_items (id) ON DELETE CASCADE,
        FOREIGN KEY (algorithm_id)
          REFERENCES learning_algorithms (id) ON DELETE RESTRICT
      ) STRICT;

      CREATE INDEX review_records_item_time_idx
        ON review_records (learning_item_id, reviewed_at DESC, id DESC);
    `,
  },
];

export function migrateDatabase(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    ) STRICT;
  `);

  const appliedRows = database
    .prepare("SELECT version FROM schema_migrations")
    .all() as Array<{ version: number }>;
  const applied = new Set(appliedRows.map((row) => row.version));
  const recordMigration = database.prepare(`
    INSERT INTO schema_migrations (version, name, applied_at)
    VALUES (?, ?, ?)
  `);

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }

    database.exec("BEGIN IMMEDIATE");

    try {
      database.exec(migration.sql);
      recordMigration.run(
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}

