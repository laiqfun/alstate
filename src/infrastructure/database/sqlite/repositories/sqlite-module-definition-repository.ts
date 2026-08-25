import type { DatabaseSync } from "node:sqlite";

import {
  defineModuleDefinition,
  moduleDefinitionId,
  type ModuleCardinality,
  type ModuleDefinition,
  type ModuleDefinitionId,
  type ModuleDefinitionRepository,
  type NewModuleDefinition,
} from "../../../../domain/index.js";
import {
  optionalString,
  parseJsonObject,
  requireNumber,
  requireString,
  toNumber,
  type SqliteRow,
} from "../row-mapping.js";

const columns =
  "id, name, schema_json, cardinality, description, version";

export class SqliteModuleDefinitionRepository
  implements ModuleDefinitionRepository
{
  readonly #database: DatabaseSync;

  public constructor(database: DatabaseSync) {
    this.#database = database;
  }

  public async create(
    definition: NewModuleDefinition,
  ): Promise<ModuleDefinition> {
    const result = this.#database
      .prepare(`
        INSERT INTO module_definitions
          (name, schema_json, cardinality, description, version)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        definition.name,
        JSON.stringify(definition.schema),
        definition.cardinality,
        definition.description ?? null,
        definition.version,
      );

    return defineModuleDefinition({
      ...definition,
      id: moduleDefinitionId(toNumber(result.lastInsertRowid)),
    });
  }

  public async findById(
    id: ModuleDefinitionId,
  ): Promise<ModuleDefinition | null> {
    const row = this.#database
      .prepare(`SELECT ${columns} FROM module_definitions WHERE id = ?`)
      .get(id) as SqliteRow | undefined;
    return row === undefined ? null : mapDefinition(row);
  }

  public async findByName(name: string): Promise<ModuleDefinition | null> {
    const row = this.#database
      .prepare(`SELECT ${columns} FROM module_definitions WHERE name = ?`)
      .get(name) as SqliteRow | undefined;
    return row === undefined ? null : mapDefinition(row);
  }

  public async list(): Promise<readonly ModuleDefinition[]> {
    const rows = this.#database
      .prepare(`SELECT ${columns} FROM module_definitions ORDER BY id`)
      .all() as SqliteRow[];
    return Object.freeze(rows.map(mapDefinition));
  }

  public async update(definition: ModuleDefinition): Promise<void> {
    const valid = defineModuleDefinition(definition);
    this.#database
      .prepare(`
        UPDATE module_definitions
        SET name = ?, schema_json = ?, cardinality = ?, description = ?, version = ?
        WHERE id = ?
      `)
      .run(
        valid.name,
        JSON.stringify(valid.schema),
        valid.cardinality,
        valid.description ?? null,
        valid.version,
        valid.id,
      );
  }
}

function mapDefinition(row: SqliteRow): ModuleDefinition {
  const description = optionalString(row, "description");
  return defineModuleDefinition({
    id: moduleDefinitionId(requireNumber(row, "id")),
    name: requireString(row, "name"),
    schema: parseJsonObject(row, "schema_json"),
    cardinality: requireString(row, "cardinality") as ModuleCardinality,
    ...(description === undefined ? {} : { description }),
    version: requireString(row, "version"),
  });
}

