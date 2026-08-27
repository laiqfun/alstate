import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runCli } from "../src/cli/run-cli.js";

test("vocabulary example supports create, content, review, history, and import", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "alstate-cli-test-"));
  const databasePath = join(directory, "alstate.db");
  const output: string[] = [];
  const execute = (...args: string[]) =>
    runCli({
      args,
      databasePath,
      write: (message) => output.push(message),
    });
  context.after(() => rmSync(directory, { recursive: true, force: true }));

  await execute("item:add", "bank");
  const item = JSON.parse(output.at(-1)!) as { id: number };
  await execute(
    "meaning:add",
    String(item.id),
    "english",
    "a financial institution",
  );
  await execute("item:show", String(item.id));
  assert.match(output.at(-1)!, /financial institution/);

  await execute("review", "good");
  assert.match(output.at(-1)!, /^Next review:/);
  await execute("history", String(item.id));
  assert.match(output.at(-1)!, /"rating": "good"/);

  const importPath = join(directory, "import.json");
  writeFileSync(
    importPath,
    JSON.stringify([
      {
        word: "river",
        englishMeanings: ["a natural stream of water"],
      },
    ]),
  );
  await execute("import", importPath);
  await execute("item:list", "river");
  const items = JSON.parse(output.at(-1)!) as unknown[];
  assert.equal(items.length, 1);
});
