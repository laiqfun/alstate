import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = join(root, "pack-test");
const packs = join(temporary, "packs");
const consumer = join(temporary, "consumer");
const cache = join(temporary, "cache");
const npmCli = process.env["npm_execpath"];

if (npmCli === undefined) {
  throw new Error("Run package verification through 'npm run verify:packages'.");
}

rmSync(temporary, { recursive: true, force: true });
mkdirSync(packs, { recursive: true });
mkdirSync(consumer, { recursive: true });

try {
  for (const workspace of ["@alstate/core", "@alstate/sqlite", "@alstate/fsrs"]) {
    run(process.execPath, [
      npmCli,
      "pack",
      "-w",
      workspace,
      "--pack-destination",
      packs,
      "--cache",
      cache,
    ]);
  }
  run(process.execPath, [
    npmCli,
    "pack",
    join(root, "node_modules", "ts-fsrs"),
    "--pack-destination",
    packs,
    "--cache",
    cache,
  ]);

  writeFileSync(
    join(consumer, "package.json"),
    `${JSON.stringify(
      {
        name: "alstate-pack-consumer",
        private: true,
        type: "module",
        dependencies: {
          "@alstate/core": "file:../packs/alstate-core-0.1.0.tgz",
          "@alstate/fsrs": "file:../packs/alstate-fsrs-0.1.0.tgz",
          "@alstate/sqlite": "file:../packs/alstate-sqlite-0.1.0.tgz",
          "ts-fsrs": "file:../packs/ts-fsrs-5.4.1.tgz",
        },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(consumer, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          skipLibCheck: true,
          outDir: "dist",
        },
        include: ["index.ts"],
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(consumer, "index.ts"),
    `import { LearningEngine } from "@alstate/core";
import { FsrsAlgorithm } from "@alstate/fsrs";
import { SqliteLearningStore } from "@alstate/sqlite";

const engine = await LearningEngine.create({
  store: new SqliteLearningStore(),
  algorithm: new FsrsAlgorithm(),
});

try {
  const at = new Date("2026-08-25T00:00:00.000Z");
  const item = await engine.add({ prompt: "2 + 2", answer: "4" }, at);
  const due = await engine.due(at);
  if (due.length !== 1 || due[0]?.preview.length !== 4) {
    throw new Error("Packed packages did not produce the expected preview.");
  }
  await engine.review(item.id, "good", { at });
  if ((await engine.history(item.id)).length !== 1) {
    throw new Error("Packed packages did not persist review history.");
  }
  console.log("packed consumer workflow passed");
} finally {
  engine.close();
}
`,
  );

  run(process.execPath, [
    npmCli,
    "install",
    "--offline",
    "--cache",
    cache,
  ], consumer);
  run(process.execPath, [
    join(root, "node_modules", "typescript", "bin", "tsc"),
    "--project",
    join(consumer, "tsconfig.json"),
  ]);
  run(process.execPath, [join(consumer, "dist", "index.js")]);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

function run(command, args, cwd = root) {
  const environment = { ...process.env };
  delete environment["npm_config_allow_scripts"];
  delete environment["NPM_CONFIG_ALLOW_SCRIPTS"];
  const result = spawnSync(command, args, {
    cwd,
    env: environment,
    stdio: "inherit",
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Command failed with exit code ${result.status}.`);
  }
}
