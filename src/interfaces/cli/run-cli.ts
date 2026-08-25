import { join } from "node:path";
import { createInterface } from "node:readline/promises";

import { learningItemContentId, learningItemId, tagId } from "../../domain/index.js";
import { readJsonImportFile } from "../../infrastructure/files/index.js";
import { createCliApplication } from "./application.js";

export interface CliOptions {
  readonly args?: readonly string[];
  readonly databasePath?: string;
  readonly write?: (message: string) => void;
  readonly ask?: (question: string) => Promise<string>;
}

export async function runCli(options: CliOptions = {}): Promise<void> {
  const args = [...(options.args ?? process.argv.slice(2))];
  const write = options.write ?? console.log;
  const databasePath = options.databasePath ?? process.env["ALSTATE_DB_PATH"] ?? join(process.cwd(), ".alstate", "alstate.db");
  const application = await createCliApplication(databasePath);

  try {
    const command = args.shift() ?? "help";
    switch (command) {
      case "init": write(`Initialized ${databasePath}`); break;
      case "item:add": write(JSON.stringify(await application.items.create(requireArgument(args.shift(), "word")))); break;
      case "item:list": write(JSON.stringify(await application.items.list(args.shift()), null, 2)); break;
      case "item:show": write(JSON.stringify(await application.items.get(parseItemId(args.shift())), null, 2)); break;
      case "item:delete": write(String(await application.items.delete(parseItemId(args.shift())))); break;
      case "content:add": {
        const itemId = parseItemId(args.shift());
        const moduleName = requireArgument(args.shift(), "module name");
        const data = JSON.parse(requireArgument(args.shift(), "JSON data"));
        const orderIndex = Number(args.shift() ?? 0);
        write(JSON.stringify(await application.content.add({ learningItemId: itemId, moduleName, data, orderIndex })));
        break;
      }
      case "content:delete": write(String(await application.content.delete(learningItemContentId(parsePositiveInteger(args.shift(), "content id"))))); break;
      case "tag:create": write(JSON.stringify(await application.tags.create(requireArgument(args.shift(), "tag name")))); break;
      case "tag:list": write(JSON.stringify(await application.tags.list(), null, 2)); break;
      case "tag:attach":
        await application.tags.attach(parseItemId(args.shift()), tagId(parsePositiveInteger(args.shift(), "tag id")));
        write("attached");
        break;
      case "import": write(JSON.stringify(await application.importer.import(await readJsonImportFile(requireArgument(args.shift(), "file path"))), null, 2)); break;
      case "review": {
        const current = (await application.review.listDue(new Date(), 1))[0];
        if (current === undefined) { write("No LearningItem is due."); break; }
        write(current.item.word);
        write(JSON.stringify(current.contents.map((content) => content.data), null, 2));
        const rating = args.shift() ?? await askRating(options.ask);
        const completed = await application.review.review({ learningItemId: current.item.id, rating: rating.toLowerCase() });
        write(`Next review: ${completed.outcome.state.dueAt.toISOString()}`);
        break;
      }
      case "history": write(JSON.stringify(await application.records.list({ learningItemId: parseItemId(args.shift()) }), null, 2)); break;
      case "help": write(helpText); break;
      default: throw new Error(`Unknown command '${command}'.`);
    }
  } finally {
    application.database.close();
  }
}

async function askRating(customAsk?: (question: string) => Promise<string>) {
  if (customAsk !== undefined) return customAsk("Rating (again/hard/good/easy): ");
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try { return await readline.question("Rating (again/hard/good/easy): "); }
  finally { readline.close(); }
}

function parseItemId(value: string | undefined) { return learningItemId(parsePositiveInteger(value, "LearningItem id")); }

function parsePositiveInteger(value: string | undefined, label: string): number {
  const parsed = Number(requireArgument(value, label));
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

function requireArgument(value: string | undefined, label: string): string {
  if (value === undefined || value.length === 0) throw new Error(`Missing ${label}.`);
  return value;
}

const helpText = `Alstate commands:
  init
  item:add <word>
  item:list [word]
  item:show <item-id>
  item:delete <item-id>
  content:add <item-id> <module-name> <json> [order]
  content:delete <content-id>
  tag:create <name>
  tag:list
  tag:attach <item-id> <tag-id>
  import <json-file>
  review [again|hard|good|easy]
  history <item-id>`;
