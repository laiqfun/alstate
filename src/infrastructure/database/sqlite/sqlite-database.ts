import { DatabaseSync } from "node:sqlite";

import { migrateDatabase } from "./migrations.js";

export class SqliteDatabase {
  public readonly connection: DatabaseSync;

  public constructor(path: string = ":memory:") {
    this.connection = new DatabaseSync(path, {
      enableForeignKeyConstraints: true,
      enableDoubleQuotedStringLiterals: false,
    });
    this.connection.exec("PRAGMA busy_timeout = 5000");
  }

  public migrate(): void {
    migrateDatabase(this.connection);
  }

  public async transaction<Result>(
    work: () => Promise<Result>,
  ): Promise<Result> {
    this.connection.exec("BEGIN IMMEDIATE");

    try {
      const result = await work();
      this.connection.exec("COMMIT");
      return result;
    } catch (error) {
      this.connection.exec("ROLLBACK");
      throw error;
    }
  }

  public close(): void {
    this.connection.close();
  }
}

