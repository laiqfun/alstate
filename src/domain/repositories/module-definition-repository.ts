import type {
  ModuleDefinition,
  NewModuleDefinition,
} from "../entities/index.js";
import type { ModuleDefinitionId } from "../values/index.js";

export interface ModuleDefinitionRepository {
  create(definition: NewModuleDefinition): Promise<ModuleDefinition>;
  findById(id: ModuleDefinitionId): Promise<ModuleDefinition | null>;
  findByName(name: string): Promise<ModuleDefinition | null>;
  list(): Promise<readonly ModuleDefinition[]>;
  update(definition: ModuleDefinition): Promise<void>;
}

