# API 参考

[English](api-reference.md) | 简体中文

Alstate 只发布 ESM 入口。请从各软件包根入口导入公开 API；软件包内部文件路径不属于
公开 API。

## `@alstate/core`

### `LearningEngine`

```ts
class LearningEngine<
  StateData extends JsonObject = JsonObject,
  ReviewData extends JsonObject = JsonObject,
>
```

引擎负责协调一个 `LearningStore` 和一个已注册的 `LearningAlgorithm`。两个泛型
参数会根据算法自动推断。

#### `LearningEngine.create(options)`

```ts
static create<StateData extends JsonObject, ReviewData extends JsonObject>(
  options: {
    readonly store: LearningStore;
    readonly algorithm: LearningAlgorithm<StateData, ReviewData>;
  },
): Promise<LearningEngine<StateData, ReviewData>>
```

校验算法契约，向存储注册算法名称、版本和配置，然后返回绑定后的引擎。如果存储中已有
不兼容的注册信息，存储可以抛出 `AlgorithmMismatchError`。

#### `engine.algorithm`

```ts
get algorithm(): LearningAlgorithm<StateData, ReviewData>
```

返回当前算法。应用可以读取其中的 `ratings`、`description` 和解析完成的
`configuration`。

#### `engine.add(data?, at?)`

```ts
add(data: JsonObject = {}, at: Date = new Date()): Promise<LearningItem>
```

校验应用数据，请算法生成初始状态，校验该状态，并原子地保存项目和状态。`at` 是
算法初始化时间。

#### `engine.get(id)`

```ts
get(id: LearningItemId): Promise<LearningItem>
```

返回当前算法作用域内的项目。项目不存在或属于另一个算法时抛出
`ItemNotFoundError`。

#### `engine.list(query?)`

```ts
list(query?: PageQuery): Promise<readonly LearningItem[]>
```

列出当前算法作用域内的项目。具体排序和分页执行方式由存储定义；SQLite 适配器按项目
ID 升序排列。

#### `engine.update(id, data)`

```ts
update(id: LearningItemId, data: JsonObject): Promise<LearningItem>
```

校验并替换项目的完整应用数据对象，不会合并字段。项目不在当前作用域内时抛出
`ItemNotFoundError`。

#### `engine.remove(id)`

```ts
remove(id: LearningItemId): Promise<boolean>
```

删除当前作用域内的项目。成功删除返回 `true`，不存在则返回 `false`。存储负责
清理关联状态和复习记录。

#### `engine.due(at?, limit?)`

```ts
due(at: Date = new Date(), limit?: number): Promise<readonly DueItem[]>
```

列出已保存到期时间小于或等于 `at` 的项目。引擎会对每个已保存状态调用算法的
`parse` 和 `preview`。可选的数量上限会传给存储。

```ts
interface DueItem {
  readonly item: LearningItem;
  readonly dueAt: Date;
  readonly preview: readonly ReviewPreview[];
}
```

`dueAt` 是当前保存的到期时间。每个预览项包含一项受支持评分，以及假定在查询时间
复习后得到的下次到期时间。

#### `engine.review(itemId, rating, options?)`

```ts
review(
  itemId: LearningItemId,
  rating: string,
  options?: {
    readonly at?: Date;
    readonly responseTimeMs?: number;
  },
): Promise<CompletedReview<StateData, ReviewData>>
```

读取并解析当前状态、计算状态转换、校验算法返回值，然后要求存储以原子方式更新状态并
追加复习记录。`at` 默认为当前时间；`responseTimeMs` 如果提供，必须是有限非负数。

```ts
interface CompletedReview<
  StateData extends JsonObject,
  ReviewData extends JsonObject,
> {
  readonly outcome: AlgorithmReview<StateData, ReviewData>;
  readonly record: ReviewRecord;
}
```

引擎会在读取状态前确认 `rating` 已由算法公开，但不会检查项目当前是否已经到期。

#### `engine.history(itemId, query?)`

```ts
history(
  itemId: LearningItemId,
  query?: PageQuery,
): Promise<readonly ReviewRecord[]>
```

确认项目归属后返回复习记录。排序由存储定义；SQLite 按从新到旧排列。

#### `engine.close()`

```ts
close(): void
```

调用传入存储的 `close()`。此后不要继续使用该引擎或存储。

### JSON 类型

```ts
type JsonPrimitive = boolean | number | string | null;
type JsonArray = readonly JsonValue[];
interface JsonObject {
  readonly [key: string]: JsonValue;
}
type JsonValue = JsonPrimitive | JsonArray | JsonObject;
```

运行时还要求数字有限、数组连续、对象是普通对象、属性使用字符串键，并且不存在循环
引用。项目数据、算法配置、算法状态和复习数据都必须满足这个 JSON 边界。

### ID 类型和构造函数

```ts
declare const brand: unique symbol; // 仅说明概念；实际 Symbol 不公开

type LearningItemId = number & { readonly [brand]: "LearningItem" };
type AlgorithmId = number & { readonly [brand]: "Algorithm" };
type LearningStateId = number & { readonly [brand]: "LearningState" };
type ReviewRecordId = number & { readonly [brand]: "ReviewRecord" };

learningItemId(value: number): LearningItemId;
algorithmId(value: number): AlgorithmId;
learningStateId(value: number): LearningStateId;
reviewRecordId(value: number): ReviewRecordId;
```

品牌类型可以避免在 TypeScript 中混用不同类型的 ID。每个构造函数只接受正安全整数，
否则抛出 `TypeError`。大多数应用只需在解析外部项目 ID 时使用
`learningItemId`；存储在映射持久化数据时会使用全部四个函数。

### 持久化领域值

```ts
interface LearningItem {
  readonly id: LearningItemId;
  readonly data: JsonObject;
}

interface LearningState {
  readonly id: LearningStateId;
  readonly learningItemId: LearningItemId;
  readonly algorithmId: AlgorithmId;
  readonly revision: number;
  readonly dueAt: Date;
  readonly data: JsonObject;
}

interface ReviewRecord {
  readonly id: ReviewRecordId;
  readonly learningItemId: LearningItemId;
  readonly algorithmId: AlgorithmId;
  readonly rating: string;
  readonly data: JsonObject;
  readonly reviewedAt: Date;
  readonly responseTimeMs?: number;
}

interface PageQuery {
  readonly limit?: number;
  readonly offset?: number;
}
```

`LearningItem.data` 由应用管理，`LearningState.data` 和
`ReviewRecord.data` 由算法管理。应用不应直接改写算法状态。

### 算法契约

```ts
interface AlgorithmRating {
  readonly value: string;
  readonly label: string;
}

interface AlgorithmState<StateData extends JsonObject = JsonObject> {
  readonly dueAt: Date;
  readonly data: StateData;
}

interface ReviewPreview {
  readonly rating: AlgorithmRating;
  readonly dueAt: Date;
}

interface AlgorithmReview<
  StateData extends JsonObject = JsonObject,
  ReviewData extends JsonObject = JsonObject,
> {
  readonly rating: AlgorithmRating;
  readonly state: AlgorithmState<StateData>;
  readonly data: ReviewData;
}

interface LearningAlgorithm<
  StateData extends JsonObject = JsonObject,
  ReviewData extends JsonObject = JsonObject,
> {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly configuration: JsonObject;
  readonly ratings: readonly AlgorithmRating[];

  parse(data: JsonObject): StateData;
  initialize(at: Date): AlgorithmState<StateData>;
  preview(
    state: AlgorithmState<StateData>,
    at: Date,
  ): readonly ReviewPreview[];
  review(
    state: AlgorithmState<StateData>,
    rating: string,
    at: Date,
  ): AlgorithmReview<StateData, ReviewData>;
}
```

名称和版本不能为空；评分列表不能为空，每个值必须唯一且非空；所有日期和 JSON 返回值
必须有效；复习结果必须保留请求的评分。完整示例和版本规则请参阅
[扩展 Alstate](extending.zh-CN.md)。

### 存储契约

即使是本地实现，`LearningStore` 也使用异步接口：

```ts
interface AlgorithmRegistration {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly configuration: JsonObject;
}

interface RegisteredAlgorithm extends AlgorithmRegistration {
  readonly id: AlgorithmId;
}

interface NewItemWithState {
  readonly data: JsonObject;
  readonly algorithmId: AlgorithmId;
  readonly dueAt: Date;
  readonly stateData: JsonObject;
}

interface DueStoredItem {
  readonly item: LearningItem;
  readonly state: LearningState;
}

interface StateUpdate {
  readonly state: LearningState;
  readonly dueAt: Date;
  readonly data: JsonObject;
}

interface NewReviewRecord {
  readonly learningItemId: LearningItemId;
  readonly algorithmId: AlgorithmId;
  readonly rating: string;
  readonly data: JsonObject;
  readonly reviewedAt: Date;
  readonly responseTimeMs?: number;
}
```

`StateUpdate.state` 是此前读取的状态快照，其中包含提交时必须仍为当前值的版本；
`dueAt` 和 `data` 是建议写入的下一值。

```ts
interface LearningStore {
  registerAlgorithm(registration: AlgorithmRegistration): Promise<RegisteredAlgorithm>;
  createItem(input: NewItemWithState): Promise<LearningItem>;
  findItem(id: LearningItemId, algorithmId: AlgorithmId): Promise<LearningItem | null>;
  listItems(algorithmId: AlgorithmId, query?: PageQuery): Promise<readonly LearningItem[]>;
  updateItem(id: LearningItemId, algorithmId: AlgorithmId, data: JsonObject): Promise<LearningItem | null>;
  deleteItem(id: LearningItemId, algorithmId: AlgorithmId): Promise<boolean>;
  findState(itemId: LearningItemId, algorithmId: AlgorithmId): Promise<LearningState | null>;
  listDue(input: {
    readonly algorithmId: AlgorithmId;
    readonly dueAtOrBefore: Date;
    readonly limit?: number;
  }): Promise<readonly DueStoredItem[]>;
  commitReview(input: {
    readonly state: StateUpdate;
    readonly review: NewReviewRecord;
  }): Promise<ReviewRecord>;
  listReviews(
    itemId: LearningItemId,
    algorithmId: AlgorithmId,
    query?: PageQuery,
  ): Promise<readonly ReviewRecord[]>;
  close(): void;
}
```

`createItem` 必须原子地创建项目和初始状态。`commitReview` 必须比较
`StateUpdate.state.revision`，原子地更新状态并追加一条复习记录，同时拒绝过期
版本。每项项目操作都必须通过 `algorithmId` 限定作用域。完整存储检查清单见
[扩展指南](extending.zh-CN.md)。

### 错误

| 错误 | 含义 |
| --- | --- |
| `LearningEngineError` | 所有引擎专用错误的基类。 |
| `ItemNotFoundError` | 当前算法的作用域内没有该项目。 |
| `AlgorithmMismatchError` | 同名算法已使用其他版本或规范配置保存。 |
| `AlgorithmContractError` | 算法定义或返回值违反核心契约。 |
| `UnsupportedRatingError` | 当前算法没有公开请求的评分。 |
| `ConcurrentReviewError` | 存储因状态版本过期而拒绝复习。 |

输入校验通常抛出 `TypeError`。算法解析损坏的持久化状态时，也可能抛出自己的错误。

## `@alstate/sqlite`

### `SqliteLearningStore`

```ts
class SqliteLearningStore implements LearningStore {
  constructor(path?: string);
}
```

`path` 默认为 `":memory:"`。传入文件路径时会创建缺失的父目录。构造过程会打开
数据库、启用外键、配置 5 秒 busy timeout，并执行数据库结构迁移。实例提供上述全部
`LearningStore` 方法；`close()` 会关闭底层 `node:sqlite` 连接。

要求 Node.js 22.13 或更高版本。排序、事务和数据库结构细节请阅读
[官方适配器](adapters.zh-CN.md)和 [SQLite 数据模型](data-model.zh-CN.md)。

## `@alstate/fsrs`

### `FsrsAlgorithm`

```ts
class FsrsAlgorithm
  implements LearningAlgorithm<FsrsState, FsrsReviewData> {
  constructor(options?: FsrsOptions);
}
```

该适配器使用身份名称 `FSRS`、`ts-fsrs` 的 `FSRSVersion`、四个评分
（`again`、`hard`、`good`、`easy`）及完整可序列化配置。调度计算委托给
`ts-fsrs`。

### `FsrsOptions`

```ts
interface FsrsOptions {
  readonly requestRetention?: number;
  readonly maximumInterval?: number;
  readonly weights?: readonly number[];
  readonly enableFuzz?: boolean;
  readonly enableShortTerm?: boolean;
  readonly learningSteps?: readonly FsrsStep[];
  readonly relearningSteps?: readonly FsrsStep[];
}

type FsrsStep = `${number}${"d" | "h" | "m"}`;
```

`FsrsConfiguration` 是用于算法身份的规范化 snake_case 配置。`FsrsState` 是卡片
的 JSON 表示，`FsrsReviewData` 是 `ts-fsrs` 复习日志的 JSON 表示。这些类型可供
带类型地读取和适配器互操作，但持久化格式仍由 FSRS 适配器管理。

```ts
interface FsrsConfiguration extends JsonObject {
  readonly request_retention: number;
  readonly maximum_interval: number;
  readonly w: readonly number[];
  readonly enable_fuzz: boolean;
  readonly enable_short_term: boolean;
  readonly learning_steps: readonly FsrsStep[];
  readonly relearning_steps: readonly FsrsStep[];
}

interface FsrsState extends JsonObject {
  readonly due: string;
  readonly stability: number;
  readonly difficulty: number;
  readonly elapsed_days: number;
  readonly scheduled_days: number;
  readonly learning_steps: number;
  readonly reps: number;
  readonly lapses: number;
  readonly state: number;
  readonly last_review: string | null;
}

interface FsrsReviewData extends JsonObject {
  readonly rating: number;
  readonly state: number;
  readonly due: string;
  readonly stability: number;
  readonly difficulty: number;
  readonly elapsed_days: number;
  readonly last_elapsed_days: number;
  readonly scheduled_days: number;
  readonly learning_steps: number;
  readonly review: string;
}
```

选项含义和配置兼容性请阅读[官方适配器](adapters.zh-CN.md)。

## 稳定性

所有软件包目前均为实验性的 `0.x` 版本。公开 TypeScript API、持久化算法状态和
存储结构都对兼容性敏感，并可能在 `1.0` 之前发生变化。三个公开软件包在 `0.x`
阶段使用相同版本号。
