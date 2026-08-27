export type JsonPrimitive = boolean | number | string | null;
export type JsonArray = readonly JsonValue[];
export interface JsonObject {
  readonly [key: string]: JsonValue;
}
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

declare const identifierBrand: unique symbol;
type Identifier<Kind extends string> = number & {
  readonly [identifierBrand]: Kind;
};

export type LearningItemId = Identifier<"LearningItem">;
export type AlgorithmId = Identifier<"Algorithm">;
export type LearningStateId = Identifier<"LearningState">;
export type ReviewRecordId = Identifier<"ReviewRecord">;

export function learningItemId(value: number): LearningItemId {
  return identifier(value, "LearningItem");
}

export function algorithmId(value: number): AlgorithmId {
  return identifier(value, "Algorithm");
}

export function learningStateId(value: number): LearningStateId {
  return identifier(value, "LearningState");
}

export function reviewRecordId(value: number): ReviewRecordId {
  return identifier(value, "ReviewRecord");
}

export interface LearningItem {
  readonly id: LearningItemId;
  readonly data: JsonObject;
}

export interface LearningState {
  readonly id: LearningStateId;
  readonly learningItemId: LearningItemId;
  readonly algorithmId: AlgorithmId;
  readonly revision: number;
  readonly dueAt: Date;
  readonly data: JsonObject;
}

export interface ReviewRecord {
  readonly id: ReviewRecordId;
  readonly learningItemId: LearningItemId;
  readonly algorithmId: AlgorithmId;
  readonly rating: string;
  readonly data: JsonObject;
  readonly reviewedAt: Date;
  readonly responseTimeMs?: number;
}

export interface PageQuery {
  readonly limit?: number;
  readonly offset?: number;
}

function identifier<Kind extends string>(
  value: number,
  kind: Kind,
): Identifier<Kind> {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${kind} id must be a positive safe integer.`);
  }
  return value as Identifier<Kind>;
}
