import type { TagId } from "../values/index.js";
import { requireNonBlank } from "./validation.js";

export interface Tag {
  readonly id: TagId;
  readonly name: string;
  readonly description?: string;
}

export interface NewTag {
  readonly name: string;
  readonly description?: string;
}

export function defineTag(tag: Tag): Tag {
  requireNonBlank(tag.name, "Tag.name");
  return Object.freeze({ ...tag });
}

