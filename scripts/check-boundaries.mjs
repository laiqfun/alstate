import { readdir, readFile } from "node:fs/promises";

const coreSource = new URL("../packages/core/src/", import.meta.url);
const forbidden = ["node:", "@alstate/sqlite", "@alstate/fsrs", "ts-fsrs"];

for (const file of await sourceFiles(coreSource)) {
  const contents = await readFile(file, "utf8");
  for (const dependency of forbidden) {
    if (contents.includes(`from \"${dependency}`)) {
      throw new Error(`@alstate/core must not import '${dependency}' (${file}).`);
    }
  }
}

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = new URL(entry.name, directory);
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(new URL(`${entry.name}/`, directory))));
    } else if (entry.name.endsWith(".ts")) {
      files.push(path);
    }
  }
  return files;
}
