# 官方适配器

[English](adapters.md) | 简体中文

常见的本地组合是 `SqliteLearningStore` 加 `FsrsAlgorithm`：

```ts
import { LearningEngine } from "@alstate/core";
import { FsrsAlgorithm } from "@alstate/fsrs";
import { SqliteLearningStore } from "@alstate/sqlite";

const store = new SqliteLearningStore("data/learning.db");
const algorithm = new FsrsAlgorithm({
  requestRetention: 0.9,
  enableFuzz: true,
});

const engine = await LearningEngine.create({ store, algorithm });
```

## SQLite 存储

### 运行环境和打开数据库

`@alstate/sqlite` 使用 Node.js 内置的 `node:sqlite` 模块，要求 Node.js 22.13
或更高版本。

```ts
const memoryStore = new SqliteLearningStore();
const durableStore = new SqliteLearningStore("data/learning.db");
```

省略路径时使用内存数据库。传入文件路径时，适配器会创建缺失的父目录、打开或创建
数据库、启用外键、设置 5 秒 SQLite busy timeout，并在构造函数返回前应用所有尚未
执行的数据库结构迁移。

由于底层使用 `DatabaseSync`，构造和单条 SQL 调用在内部是同步的；公开方法则实现
异步的 `LearningStore` 契约。

### 排序和分页

适配器使用确定性的查询顺序：

| 操作 | 顺序 |
| --- | --- |
| `engine.list()` | 项目 ID 升序 |
| `engine.due()` | 到期时间升序，然后项目 ID 升序 |
| `engine.history()` | 复习时间降序，然后复习记录 ID 降序 |

`limit` 和 `offset` 必须是非负安全整数。`limit: 0` 返回空结果。`due` 支持
数量上限，但不支持偏移量。

所有时间戳以 ISO 8601 UTC 字符串保存，读取时转换成新的 `Date` 对象。应用数据、
状态和复习数据以 JSON 文本保存。

### 原子性和并发

SQLite 事务保护两类组合写入：

1. 插入项目及其初始算法状态；
2. 更新算法状态并插入复习记录。

每个状态的初始版本为 `0`。复习更新只有在已保存版本仍与调用方读取的版本一致时才会
成功，并在成功后递增版本。过期写入方会收到 `ConcurrentReviewError`，事务不会
添加复习历史。

事务使用 `BEGIN IMMEDIATE` 开始。配合 busy timeout，本地并发写入方可以在有限时间
内等待写锁。调用方仍应处理并发错误，以及普通 SQLite I/O 或锁错误。

### 作用域和删除

每项项目操作都包含已注册算法 ID。两个不同名称的算法可以共用一个数据库，而不会看到
彼此的项目。删除项目会级联删除其状态和复习记录。

内容分组仍属于应用策略。你可以把牌组或标签保存在项目数据中，也可以使用应用自有
存储；公开 SQLite 数据库结构只包含引擎表。

### 生命周期和运维建议

`engine.close()` 会调用 `store.close()`。应将传入存储视为由引擎所有，关闭后
不要再次使用。对于独立管理的多个引擎，即使指向同一个数据库文件，也应创建并分别管理
存储实例。

复制或备份数据库文件之前，请关闭活动存储，或使用支持 SQLite 一致性的备份方式。
不要手动编辑 `engine_states.state_json` 或算法注册记录；算法和引擎会校验它们
之间的一致性。

完整数据库结构见 [SQLite 数据模型](data-model.zh-CN.md)。

## FSRS 调度

`@alstate/fsrs` 负责适配 `ts-fsrs`，不会重新实现 FSRS 数学。它负责映射 Alstate
评分、转换日期、序列化卡片及复习状态，并在调度前校验持久化状态。

### 评分

适配器按以下顺序公开四项评分：

```ts
algorithm.ratings;
// [
//   { value: "again", label: "Again" },
//   { value: "hard",  label: "Hard" },
//   { value: "good",  label: "Good" },
//   { value: "easy",  label: "Easy" }
// ]
```

评分值区分大小写。调用 `engine.review()` 时应传入 `value`，而不是标签。

### 配置

```ts
const algorithm = new FsrsAlgorithm({
  requestRetention: 0.9,
  maximumInterval: 36_500,
  enableFuzz: true,
  enableShortTerm: true,
  learningSteps: ["1m", "10m"],
  relearningSteps: ["10m"],
  // weights: [...],
});
```

| Alstate 选项 | 持久化字段 | 用途 |
| --- | --- | --- |
| `requestRetention` | `request_retention` | 从 `0.0` 到 `1.0` 的目标回忆概率；值越高，复习量通常越大。 |
| `maximumInterval` | `maximum_interval` | 最长调度间隔，单位为天。 |
| `weights` | `w` | FSRS 模型权重，需提供完整且兼容的权重数组。 |
| `enableFuzz` | `enable_fuzz` | 为较长间隔加入少量随机变化。 |
| `enableShortTerm` | `enable_short_term` | 启用短期调度行为。 |
| `learningSteps` | `learning_steps` | 新项目的短期步骤，例如 `"1m"`、`"10m"` 或 `"1d"`。 |
| `relearningSteps` | `relearning_steps` | 遗忘后的短期重新学习步骤。 |

选项会经过 `ts-fsrs` 的参数补全和校验。省略的值采用当前已安装 `ts-fsrs` 版本的
默认值。通过 `algorithm.configuration` 可以查看 Alstate 实际注册和保存的完整规范
配置：

```ts
console.log(algorithm.configuration.request_retention);
console.log(algorithm.configuration.learning_steps);
```

### 状态和复习数据

调用 `add` 时，适配器创建一个在初始化时间到期的空 FSRS 卡片。完整卡片会序列化为
`FsrsState`，同时把到期时间投影到存储中，以便高效查询队列。

调用 `due` 时，适配器会解析并校验已保存卡片，确认卡片内部到期时间与存储投影一致，
再以查询时间为基准计算四项预览。

调用 `review` 时，适配器计算一张新卡片并生成 `FsrsReviewData`，即 JSON 兼容的
复习日志。应用可以读取带类型的结果用于分析，但应将两种格式都视为算法管理的数据。

### 配置和版本兼容性

注册身份由算法名称（`FSRS`）、导出的 `ts-fsrs` 版本以及完整规范配置组成。对象
属性顺序不影响配置相等性，但值和数组顺序会影响。

使用不同 FSRS 选项或 FSRS 版本打开已有数据库，会抛出
`AlgorithmMismatchError`。Alstate 刻意禁止静默地重新解释已有状态。若要修改两者
之一，应继续使用原设置，直到应用完成显式迁移；也可以改用另一个数据库。`0.1.x`
没有通用算法状态迁移 API。

由于 SQLite 存储中的算法名称唯一，同一个数据库不能以相同名称注册多套相互独立的
FSRS 配置。

## 选择其他适配器

核心并不绑定这些实现。只要保持契约，就可以把其他 `LearningStore` 与
`FsrsAlgorithm` 组合，或把 `SqliteLearningStore` 与其他
`LearningAlgorithm` 组合。详见[扩展 Alstate](extending.zh-CN.md)。
