import {
  audioModule,
  chineseMeaningModule,
  englishMeaningModule,
  exampleModule,
  memoryNoteModule,
} from "./built-ins/index.js";
import { ContentModuleRegistry } from "./content-module-registry.js";
import { relatedMeaningsModule } from "./related-meanings/index.js";

export function createDefaultContentModuleRegistry(): ContentModuleRegistry {
  return new ContentModuleRegistry([
    englishMeaningModule,
    chineseMeaningModule,
    exampleModule,
    audioModule,
    memoryNoteModule,
    relatedMeaningsModule,
  ]);
}

