import type {
  JsonObject,
  ModuleCardinality,
  NewModuleDefinition,
} from "../../domain/index.js";

export interface ContentModule<Data extends JsonObject = JsonObject> {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly cardinality: ModuleCardinality;
  readonly schema: JsonObject;

  parse(data: JsonObject): Data;
}

export function toModuleDefinition(
  module: ContentModule,
): NewModuleDefinition {
  return Object.freeze({
    name: module.name,
    version: module.version,
    description: module.description,
    cardinality: module.cardinality,
    schema: module.schema,
  });
}

