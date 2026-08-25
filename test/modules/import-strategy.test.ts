import assert from "node:assert/strict";
import test from "node:test";

import {
  AppendImportStrategy,
  type ImportLookup,
} from "../../src/modules/index.js";

test("default import strategy always appends without identity lookup", async () => {
  const strategy = new AppendImportStrategy();
  const lookup: ImportLookup = {
    async findItemsByWord() {
      throw new Error("append strategy must not look up words");
    },
    async listContent() {
      throw new Error("append strategy must not inspect existing content");
    },
  };

  const resolution = await strategy.resolve(
    {
      word: "bank",
      contents: [
        {
          moduleName: "EnglishMeaning",
          data: { meaning: "a financial institution" },
          orderIndex: 0,
        },
      ],
    },
    lookup,
  );

  assert.deepEqual(resolution, { action: "append" });
});

