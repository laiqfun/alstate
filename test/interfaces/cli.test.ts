import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runCli } from "../../src/interfaces/cli/index.js";

test("CLI supports create, content, review, history, and import", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "alstate-cli-test-"));
  const databasePath = join(directory, "alstate.db");
  const output: string[] = [];
  const execute = (...args: string[]) =>
    runCli({ args, databasePath, write: (message) => output.push(message) });
  context.after(() => rmSync(directory, { recursive: true, force: true }));

  await execute("item:add", "bank");
  const item = JSON.parse(output.at(-1)!) as { id: number };
  await execute(
    "content:add",
    String(item.id),
    "EnglishMeaning",
    JSON.stringify({ meaning: "a financial institution" }),
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
        word: "bank",
        contents: [
          {
            moduleName: "EnglishMeaning",
            data: { meaning: "the side of a river" },
            orderIndex: 0,
          },
        ],
      },
    ]),
  );
  await execute("import", importPath);
  await execute("item:list", "bank");
  const items = JSON.parse(output.at(-1)!) as unknown[];
  assert.equal(items.length, 2);
});

