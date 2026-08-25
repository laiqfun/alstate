import { DomainValidationError } from "../errors/index.js";

declare const identifierBrand: unique symbol;

export type Identifier<Kind extends string> = number & {
  readonly [identifierBrand]: Kind;
};

export type LearningItemId = Identifier<"LearningItem">;
export type ModuleDefinitionId = Identifier<"ModuleDefinition">;
export type LearningItemContentId = Identifier<"LearningItemContent">;
export type TagId = Identifier<"Tag">;
export type LearningAlgorithmId = Identifier<"LearningAlgorithm">;
export type LearningStateId = Identifier<"LearningState">;
export type ReviewRecordId = Identifier<"ReviewRecord">;

function createIdentifierFactory<Kind extends string>(kind: Kind) {
  return (value: number): Identifier<Kind> => {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new DomainValidationError(`${kind} id must be a positive safe integer.`);
    }

    return value as Identifier<Kind>;
  };
}

export const learningItemId = createIdentifierFactory("LearningItem");
export const moduleDefinitionId = createIdentifierFactory("ModuleDefinition");
export const learningItemContentId = createIdentifierFactory("LearningItemContent");
export const tagId = createIdentifierFactory("Tag");
export const learningAlgorithmId = createIdentifierFactory("LearningAlgorithm");
export const learningStateId = createIdentifierFactory("LearningState");
export const reviewRecordId = createIdentifierFactory("ReviewRecord");

