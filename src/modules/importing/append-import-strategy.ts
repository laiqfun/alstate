import type {
  ImportCandidate,
  ImportLookup,
  ImportResolution,
  ImportStrategy,
} from "./import-strategy.js";

export class AppendImportStrategy implements ImportStrategy {
  public readonly name = "append";

  public async resolve(
    _candidate: ImportCandidate,
    _lookup: ImportLookup,
  ): Promise<ImportResolution> {
    return { action: "append" };
  }
}

