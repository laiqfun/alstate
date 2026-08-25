import type { DatabaseSync } from "node:sqlite";

import {
  defineLearningAlgorithmDefinition,
  learningAlgorithmId,
  type LearningAlgorithmDefinition,
  type LearningAlgorithmId,
  type LearningAlgorithmRepository,
  type NewLearningAlgorithmDefinition,
} from "../../../../domain/index.js";
import {
  optionalString,
  parseJsonObject,
  requireNumber,
  requireString,
  toNumber,
  type SqliteRow,
} from "../row-mapping.js";

const columns = "id, name, description, version, config_json";

export class SqliteLearningAlgorithmRepository
  implements LearningAlgorithmRepository
{
  readonly #database: DatabaseSync;

  public constructor(database: DatabaseSync) {
    this.#database = database;
  }

  public async create(
    definition: NewLearningAlgorithmDefinition,
  ): Promise<LearningAlgorithmDefinition> {
    const result = this.#database
      .prepare(`
        INSERT INTO learning_algorithms (name, description, version, config_json)
        VALUES (?, ?, ?, ?)
      `)
      .run(
        definition.name,
        definition.description ?? null,
        definition.version,
        JSON.stringify(definition.configData),
      );
    return defineLearningAlgorithmDefinition({
      ...definition,
      id: learningAlgorithmId(toNumber(result.lastInsertRowid)),
    });
  }

  public async findById(
    id: LearningAlgorithmId,
  ): Promise<LearningAlgorithmDefinition | null> {
    const row = this.#database
      .prepare(`SELECT ${columns} FROM learning_algorithms WHERE id = ?`)
      .get(id) as SqliteRow | undefined;
    return row === undefined ? null : mapAlgorithm(row);
  }

  public async findByName(
    name: string,
  ): Promise<LearningAlgorithmDefinition | null> {
    const row = this.#database
      .prepare(`SELECT ${columns} FROM learning_algorithms WHERE name = ?`)
      .get(name) as SqliteRow | undefined;
    return row === undefined ? null : mapAlgorithm(row);
  }

  public async update(definition: LearningAlgorithmDefinition): Promise<void> {
    const valid = defineLearningAlgorithmDefinition(definition);
    this.#database
      .prepare(`
        UPDATE learning_algorithms
        SET name = ?, description = ?, version = ?, config_json = ?
        WHERE id = ?
      `)
      .run(
        valid.name,
        valid.description ?? null,
        valid.version,
        JSON.stringify(valid.configData),
        valid.id,
      );
  }
}

function mapAlgorithm(row: SqliteRow): LearningAlgorithmDefinition {
  const description = optionalString(row, "description");
  return defineLearningAlgorithmDefinition({
    id: learningAlgorithmId(requireNumber(row, "id")),
    name: requireString(row, "name"),
    ...(description === undefined ? {} : { description }),
    version: requireString(row, "version"),
    configData: parseJsonObject(row, "config_json"),
  });
}

