import type { JsonObject, ModuleDefinitionId } from "../values/index.js";
import { requireNonBlank } from "./validation.js";

export type ModuleCardinality = "multiple" | "single";

export interface ModuleDefinition {
  readonly id: ModuleDefinitionId;
  readonly name: string;
  readonly schema: JsonObject;
  readonly cardinality: ModuleCardinality;
  readonly description?: string;
  readonly version: string;
}

export interface NewModuleDefinition {
  readonly name: string;
  readonly schema: JsonObject;
  readonly cardinality: ModuleCardinality;
  readonly description?: string;
  readonly version: string;
}

export function defineModuleDefinition(definition: ModuleDefinition): ModuleDefinition {
  requireNonBlank(definition.name, "ModuleDefinition.name");
  requireNonBlank(definition.version, "ModuleDefinition.version");

  return Object.freeze({ ...definition });
}
