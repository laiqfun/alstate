export interface TransactionRunner {
  transaction<Result>(work: () => Promise<Result>): Promise<Result>;
}

