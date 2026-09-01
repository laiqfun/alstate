# 扩展 Alstate

[English](extending.md) | 简体中文

`@alstate/core` 不包含具体调度器或持久化技术。应用可以实现
`LearningAlgorithm`、`LearningStore`，或同时实现两者。

请先阅读[架构说明](architecture.zh-CN.md)：自定义适配器必须参与维护原子性、算法
归属和乐观并发保证，而不只是满足 TypeScript 方法签名。

## 实现调度算法

以下示例按固定间隔进行调度。它刻意保持简单，并不能替代 FSRS，但完整展示了算法契约：

```ts
import type {
  AlgorithmRating,
  AlgorithmState,
  JsonObject,
  LearningAlgorithm,
} from "@alstate/core";

interface IntervalState extends JsonObject {
  readonly reviews: number;
}

interface IntervalReview extends JsonObject {
  readonly previousDueAt: string;
  readonly intervalDays: number;
}

const ratings = [
  { value: "again", label: "Again" },
  { value: "hard", label: "Hard" },
  { value: "good", label: "Good" },
  { value: "easy", label: "Easy" },
] as const satisfies readonly AlgorithmRating[];

type RatingValue = (typeof ratings)[number]["value"];

const intervalDays: Record<RatingValue, number> = {
  again: 0,
  hard: 1,
  good: 3,
  easy: 7,
};

const millisecondsPerDay = 86_400_000;

export class FixedIntervalAlgorithm
  implements LearningAlgorithm<IntervalState, IntervalReview>
{
  public readonly name = "fixed-interval";
  public readonly version = "1";
  public readonly description = "Example fixed-interval scheduler";
  public readonly ratings = ratings;
  public readonly configuration: JsonObject;

  readonly #scale: number;

  public constructor(scale = 1) {
    if (!Number.isFinite(scale) || scale <= 0) {
      throw new TypeError("scale must be positive.");
    }
    this.#scale = scale;
    this.configuration = Object.freeze({ scale });
  }

  public parse(data: JsonObject): IntervalState {
    const reviews = data["reviews"];
    if (
      typeof reviews !== "number" ||
      !Number.isSafeInteger(reviews) ||
      reviews < 0
    ) {
      throw new Error("Interval state has an invalid review count.");
    }
    return Object.freeze({ reviews });
  }

  public initialize(at: Date): AlgorithmState<IntervalState> {
    return Object.freeze({
      dueAt: new Date(at),
      data: Object.freeze({ reviews: 0 }),
    });
  }

  public preview(state: AlgorithmState<IntervalState>, at: Date) {
    this.parse(state.data);
    return Object.freeze(
      ratings.map((rating) =>
        Object.freeze({
          rating,
          dueAt: this.nextDueAt(at, rating.value),
        }),
      ),
    );
  }

  public review(
    state: AlgorithmState<IntervalState>,
    ratingValue: string,
    at: Date,
  ) {
    const current = this.parse(state.data);
    const rating = ratings.find(({ value }) => value === ratingValue);
    if (rating === undefined) throw new Error("Unsupported rating.");

    return Object.freeze({
      rating,
      state: Object.freeze({
        dueAt: this.nextDueAt(at, rating.value),
        data: Object.freeze({ reviews: current.reviews + 1 }),
      }),
      data: Object.freeze({
        previousDueAt: state.dueAt.toISOString(),
        intervalDays: intervalDays[rating.value] * this.#scale,
      }),
    });
  }

  private nextDueAt(at: Date, rating: RatingValue): Date {
    return new Date(
      at.getTime() + intervalDays[rating] * this.#scale * millisecondsPerDay,
    );
  }
}
```

### 算法的职责

实现必须满足以下全部规则：

- `name` 和 `version` 是持久化身份字段，不能为空；
- `configuration` 是解释状态所需的完整、规范且 JSON 兼容的配置，不能省略会影响
  行为的默认值；
- `ratings` 不能为空，每个 `value` 必须唯一且非空；
- `parse` 必须将存储视为不可信的运行时边界，校验每个字段并返回带类型的 JSON
  数据，不能只依赖 TypeScript 类型断言；
- `initialize`、`preview` 和 `review` 必须返回有效 `Date` 和 JSON 兼容数据；
- `preview` 只能返回已经公开的评分；
- `review` 必须保留请求的确切评分，且不能修改输入；
- 状态数据必须包含进程重启后算法仍需使用的全部内容，内存缓存不能成为唯一调度依据。

引擎会校验算法返回值的外层结构、日期、评分和 JSON 兼容性，但无法校验算法特有的状态
语义；后者必须由 `parse` 负责。

### 身份和状态演进

持久化的 `name`、`version` 和规范 `configuration` 共同标识状态的解释方式。
只有在旧状态含义完全不变时才能保持版本号不变。状态格式或调度语义发生破坏性变化时，
必须使用新版本，并由应用提供明确的迁移策略。

Alstate `0.1.x` 没有通用状态迁移 API。存储必须拒绝用不同版本或配置重新打开已有
算法名称，不能静默接受。

## 实现存储

实现 `@alstate/core` 导出的 `LearningStore` 接口。所有方法均为异步，因此实现
可以使用本地数据库、远程服务或事务型服务端。

### 各方法的必要行为

| 方法 | 必要行为 |
| --- | --- |
| `registerAlgorithm` | 按名称创建或查找注册记录。已有版本和规范配置必须一致，否则抛出 `AlgorithmMismatchError`。 |
| `createItem` | 原子地创建一个项目及其初始状态，绝不能留下没有对应状态的项目。 |
| `findItem`、`listItems`、`updateItem`、`deleteItem` | 每项操作都通过传入算法 ID 限定作用域；不存在时返回契约规定的 null/布尔值。 |
| `findState` | 只返回项目与算法组合对应的状态，并包含非负、单调递增的版本。 |
| `listDue` | 只返回指定算法中到期时间不晚于边界的状态，并遵守 `limit`。 |
| `commitReview` | 校验状态与复习身份，比较调用方提供的持久化版本，再原子地更新状态、递增版本并追加恰好一条复习记录。 |
| `listReviews` | 只返回指定项目与算法组合的记录，并记录清楚排序方式。 |
| `close` | 释放自己所有的资源，并提供可预测的生命周期行为。 |

### 乐观复习并发

`StateUpdate.state` 是计算状态转换时使用的快照。存储必须将其中的 `revision` 与
当前持久化版本比较。概念上等价于：

```sql
UPDATE states
SET due_at = :dueAt,
    state_json = :data,
    revision = revision + 1
WHERE id = :id
  AND revision = :expectedRevision;
```

如果更新数量不等于一，抛出 `ConcurrentReviewError`，且不能追加复习记录。状态
更新和复习插入必须位于同一个事务中；校验或存储失败时也必须一起回滚。

### 持久化数据校验

存储是不可信数据的运行时边界。映射持久化记录时，应校验 ID、版本、日期和 JSON
对象。返回新的 `Date`，避免调用方通过对象引用修改内部持久化状态。应用项目数据、
算法状态和复习数据应始终相互分离。

规范配置比较必须忽略对象属性的插入顺序，同时保留值和数组顺序的含义；不能使用有损或
算法特有的重新解释方式。

### 删除和历史

在项目生命周期内，复习记录不可修改。`deleteItem` 可以像 SQLite 适配器一样删除
整个项目聚合，即项目、状态和历史。如果其他存储刻意采用不同的保留策略，必须明确记录。

## 测试适配器

至少应覆盖以下测试：

- 通过 `LearningEngine` 完成添加、到期、复习和历史工作流；
- 错误的配置、状态、日期和 JSON 值；
- 算法名称、版本或配置不匹配；
- 两个算法之间的项目隔离；
- 创建初始状态失败时完整回滚；
- 插入复习记录失败时完整回滚；
- 基于同一版本提交两次复习，并证明恰好一次成功；
- 如果存储支持持久化，关闭并重新打开后数据仍存在；
- 分页、排序和项目不存在时的行为。

应用可以将自定义适配器与任一官方适配器组合。依赖方向必须保持单向：适配器可以依赖
`@alstate/core`，核心则绝不能依赖适配器。
