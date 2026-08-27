import { join } from "node:path";
import { createInterface } from "node:readline/promises";

import { learningItemId } from "../../../src/index.js";
import { createVocabularyApp } from "../app/create-app.js";
import {
  createVocabularyItem,
  parseVocabularyItem,
  type VocabularyItemData,
} from "../domain/vocabulary-item.js";
import { readVocabularyImport } from "../infrastructure/read-import-file.js";

export interface CliOptions {
  readonly args?: readonly string[];
  readonly databasePath?: string;
  readonly write?: (message: string) => void;
  readonly ask?: (question: string) => Promise<string>;
}

export async function runCli(options: CliOptions = {}): Promise<void> {
  const args = [...(options.args ?? process.argv.slice(2))];
  const write = options.write ?? console.log;
  const databasePath =
    options.databasePath ??
    process.env["ALSTATE_VOCABULARY_DB_PATH"] ??
    join(process.cwd(), ".alstate", "vocabulary-example.db");
  const engine = await createVocabularyApp(databasePath);

  try {
    const command = args.shift() ?? "help";
    switch (command) {
      case "item:add": {
        const item = await engine.add(
          createVocabularyItem(argument(args.shift(), "word")),
        );
        write(JSON.stringify(item));
        break;
      }
      case "item:list": {
        const word = args.shift();
        const items = (await engine.list())
          .map((item) => ({ id: item.id, ...parseVocabularyItem(item.data) }))
          .filter((item) => word === undefined || item.word === word);
        write(JSON.stringify(items, null, 2));
        break;
      }
      case "item:show": {
        const item = await engine.get(itemId(args.shift()));
        write(JSON.stringify({ id: item.id, ...parseVocabularyItem(item.data) }, null, 2));
        break;
      }
      case "item:delete":
        write(String(await engine.remove(itemId(args.shift()))));
        break;
      case "meaning:add": {
        const id = itemId(args.shift());
        const language = argument(args.shift(), "language");
        const meaning = argument(args.shift(), "meaning");
        const data = parseVocabularyItem((await engine.get(id)).data);
        const updated: VocabularyItemData = {
          ...data,
          ...(language === "english"
            ? { englishMeanings: [...data.englishMeanings, meaning] }
            : language === "chinese"
              ? { chineseMeanings: [...data.chineseMeanings, meaning] }
              : fail("language must be 'english' or 'chinese'.")),
        };
        write(JSON.stringify(await engine.update(id, updated)));
        break;
      }
      case "note:add": {
        const id = itemId(args.shift());
        const data = parseVocabularyItem((await engine.get(id)).data);
        write(
          JSON.stringify(
            await engine.update(id, {
              ...data,
              notes: [...data.notes, argument(args.shift(), "note")],
            }),
          ),
        );
        break;
      }
      case "import": {
        const imported = [];
        for (const data of await readVocabularyImport(
          argument(args.shift(), "file path"),
        )) {
          imported.push(await engine.add(data));
        }
        write(JSON.stringify(imported, null, 2));
        break;
      }
      case "review": {
        const current = (await engine.due(new Date(), 1))[0];
        if (current === undefined) {
          write("No learning item is due.");
          break;
        }
        write(JSON.stringify(parseVocabularyItem(current.item.data), null, 2));
        const rating = args.shift() ?? (await askRating(options.ask));
        const completed = await engine.review(
          current.item.id,
          rating.toLowerCase(),
        );
        write(`Next review: ${completed.outcome.state.dueAt.toISOString()}`);
        break;
      }
      case "history":
        write(
          JSON.stringify(await engine.history(itemId(args.shift())), null, 2),
        );
        break;
      case "help":
        write(helpText);
        break;
      default:
        throw new Error(`Unknown command '${command}'.`);
    }
  } finally {
    engine.close();
  }
}

async function askRating(customAsk?: (question: string) => Promise<string>) {
  if (customAsk !== undefined) {
    return customAsk("Rating (again/hard/good/easy): ");
  }
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await readline.question("Rating (again/hard/good/easy): ");
  } finally {
    readline.close();
  }
}

function itemId(value: string | undefined) {
  const parsed = Number(argument(value, "learning item id"));
  return learningItemId(parsed);
}

function argument(value: string | undefined, name: string): string {
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

function fail(message: string): never {
  throw new Error(message);
}

const helpText = `Vocabulary example commands:
  item:add <word>
  item:list [word]
  item:show <item-id>
  item:delete <item-id>
  meaning:add <item-id> <english|chinese> <meaning>
  note:add <item-id> <note>
  import <json-file>
  review [again|hard|good|easy]
  history <item-id>`;
