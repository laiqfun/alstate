import { ContentModuleError } from "./content-module-error.js";
import type { ContentModule } from "./content-module.js";

export class ContentModuleRegistry {
  readonly #modules = new Map<string, ContentModule>();

  public constructor(modules: readonly ContentModule[] = []) {
    for (const module of modules) {
      this.register(module);
    }
  }

  public register(module: ContentModule): void {
    if (this.#modules.has(module.name)) {
      throw new ContentModuleError(
        `Content module '${module.name}' is already registered.`,
      );
    }

    this.#modules.set(module.name, module);
  }

  public get(name: string): ContentModule | null {
    return this.#modules.get(name) ?? null;
  }

  public require(name: string): ContentModule {
    const module = this.get(name);

    if (module === null) {
      throw new ContentModuleError(`Content module '${name}' is not registered.`);
    }

    return module;
  }

  public list(): readonly ContentModule[] {
    return Object.freeze([...this.#modules.values()]);
  }
}

