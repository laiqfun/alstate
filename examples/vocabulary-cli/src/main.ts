#!/usr/bin/env node

import { runCli } from "./cli/run-cli.js";

try {
  await runCli();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
