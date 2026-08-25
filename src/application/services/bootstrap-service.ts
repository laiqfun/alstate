import type {
  LearningAlgorithmDefinition,
  LearningAlgorithmRepository,
  ModuleDefinitionRepository,
} from "../../domain/index.js";
import type { FsrsLearningAlgorithm } from "../../learning/index.js";
import {
  type ContentModuleRegistry,
  toModuleDefinition,
} from "../../modules/index.js";
import type { TransactionRunner } from "../transactions/index.js";

export class BootstrapService {
  readonly #modules: ModuleDefinitionRepository;
  readonly #algorithms: LearningAlgorithmRepository;
  readonly #moduleRegistry: ContentModuleRegistry;
  readonly #fsrs: FsrsLearningAlgorithm;
  readonly #transactions: TransactionRunner;

  public constructor(dependencies: {
    modules: ModuleDefinitionRepository;
    algorithms: LearningAlgorithmRepository;
    moduleRegistry: ContentModuleRegistry;
    fsrs: FsrsLearningAlgorithm;
    transactions: TransactionRunner;
  }) {
    this.#modules = dependencies.modules;
    this.#algorithms = dependencies.algorithms;
    this.#moduleRegistry = dependencies.moduleRegistry;
    this.#fsrs = dependencies.fsrs;
    this.#transactions = dependencies.transactions;
  }

  public async initialize(): Promise<LearningAlgorithmDefinition> {
    return this.#transactions.transaction(async () => {
      for (const module of this.#moduleRegistry.list()) {
        const desired = toModuleDefinition(module);
        const existing = await this.#modules.findByName(module.name);

        if (existing === null) {
          await this.#modules.create(desired);
        } else if (
          existing.version !== desired.version ||
          existing.cardinality !== desired.cardinality ||
          JSON.stringify(existing.schema) !== JSON.stringify(desired.schema) ||
          existing.description !== desired.description
        ) {
          await this.#modules.update({ ...desired, id: existing.id });
        }
      }

      const existingAlgorithm = await this.#algorithms.findByName(this.#fsrs.name);
      const desiredAlgorithm = {
        name: this.#fsrs.name,
        version: this.#fsrs.version,
        description: "Free Spaced Repetition Scheduler",
        configData: this.#fsrs.configuration,
      } as const;

      if (existingAlgorithm === null) {
        return this.#algorithms.create(desiredAlgorithm);
      }

      if (
        existingAlgorithm.version !== desiredAlgorithm.version ||
        JSON.stringify(existingAlgorithm.configData) !==
          JSON.stringify(desiredAlgorithm.configData) ||
        existingAlgorithm.description !== desiredAlgorithm.description
      ) {
        const updated = { ...desiredAlgorithm, id: existingAlgorithm.id };
        await this.#algorithms.update(updated);
        return updated;
      }

      return existingAlgorithm;
    });
  }
}

