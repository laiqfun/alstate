# 快速上手

[English](getting-started.md) | 简体中文

本指南使用完整的官方组合构建一个最小 TypeScript 应用：

- `LearningEngine` 协调整体工作流；
- `SqliteLearningStore` 持久化数据；
- `FsrsAlgorithm` 计算复习计划。

## 环境要求

- 使用 `@alstate/sqlite` 时需要 Node.js 22.13 或更高版本；
- 项目使用 ESM（Node.js 项目最简单的方式是配置 `"type": "module"`）；
- TypeScript 不是必需的，但本文用它展示公开类型。

安装软件包：

```bash
npm install @alstate/core @alstate/sqlite @alstate/fsrs
```

TypeScript Node.js 应用可以使用以下最小配置：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true
  }
}
```

## 创建引擎

一个引擎只绑定一个存储和一个算法：

```ts
import { LearningEngine } from "@alstate/core";
import { FsrsAlgorithm } from "@alstate/fsrs";
import { SqliteLearningStore } from "@alstate/sqlite";

const engine = await LearningEngine.create({
  store: new SqliteLearningStore("data/learning.db"),
  algorithm: new FsrsAlgorithm({ requestRetention: 0.9 }),
});
```

打开 SQLite 存储时，适配器会创建父目录、打开或创建数据库，并执行尚未应用的数据库
结构迁移。创建引擎时会注册当前算法。以后重新打开同一个数据库，必须使用相同的算法
版本和有效配置。

`LearningEngine` 管理传入存储的生命周期。应用使用完毕后应关闭引擎：

```ts
try {
  // 使用引擎。
} finally {
  engine.close();
}
```

## 定义应用数据

Alstate 不规定卡片结构。每个学习项目的根数据必须是由应用管理的 JSON 对象：

```ts
import type { JsonObject } from "@alstate/core";

interface FlashcardData extends JsonObject {
  readonly prompt: string;
  readonly answer: string;
  readonly tags: readonly string[];
  readonly createdAt: string;
}

const card: FlashcardData = {
  prompt: "2 + 2 等于多少？",
  answer: "4",
  tags: ["数学"],
  createdAt: new Date().toISOString(),
};
```

日期必须先序列化，例如调用 `toISOString()`。有效值包括有限数字、字符串、布尔值、
`null`、JSON 值数组以及普通 JSON 对象。`Date`、`undefined`、`bigint`、函数、
Symbol、类实例、稀疏数组和循环引用都会被拒绝。

TypeScript 静态类型不能校验来自导入文件、API 或数据库的数据。使用不可信项目数据的
字段之前，请在应用边界进行运行时解析。词汇示例中的
[`parseVocabularyItem`](../examples/vocabulary-cli/src/domain/vocabulary-item.ts)
演示了这种做法。

## 添加学习项目

```ts
const addedAt = new Date();
const item = await engine.add(card, addedAt);

console.log(item.id);   // 带品牌类型的数字 LearningItemId
console.log(item.data); // 应用数据对象
```

第二个参数决定算法的初始化时间，默认是当前时间。使用 FSRS 时，新项目会在该时间
到期。创建项目和创建初始调度状态属于同一次原子存储操作。

当 ID 来自路由参数、命令行或其他外部边界时，应先校验并转换品牌类型：

```ts
import { learningItemId } from "@alstate/core";

const id = learningItemId(Number(routeParameter));
const stored = await engine.get(id);
```

该辅助函数只接受正安全整数，否则抛出 `TypeError`。

## 查询、更新和删除

```ts
const sameItem = await engine.get(item.id);
const firstPage = await engine.list({ limit: 20, offset: 0 });

const updated = await engine.update(item.id, {
  ...sameItem.data,
  answer: "四",
});

const removed = await engine.remove(item.id);
```

`update` 会替换完整的数据对象，不会合并字段。项目不存在或不属于当前算法时，
`get` 和 `update` 抛出 `ItemNotFoundError`，`remove` 则返回 `false`。
使用 SQLite 时，删除项目也会删除其调度状态和复习历史。

`limit` 和 `offset` 是可选的非负安全整数。SQLite 按项目 ID 升序返回结果。

## 构建到期队列

```ts
const now = new Date();
const queue = await engine.due(now, 20);

for (const entry of queue) {
  console.log(entry.item.data);
  console.log(`已于 ${entry.dueAt.toISOString()} 到期`);

  for (const choice of entry.preview) {
    console.log(choice.rating.value, choice.rating.label, choice.dueAt);
  }
}
```

`due(at, limit)` 返回到期时间小于或等于 `at` 的状态。每项结果都包含学习项目、
当前到期时间，以及选择各项评分后对应的下次到期时间。官方 SQLite 存储先按到期时间、
再按项目 ID 排序。

FSRS 使用以下区分大小写的小写评分值：

| 值 | 默认标签 |
| --- | --- |
| `again` | Again |
| `hard` | Hard |
| `good` | Good |
| `easy` | Easy |

应用应使用 `entry.preview` 渲染选项，不要自行重复维护此列表；其他算法可能提供完全
不同的评分。

## 提交复习

```ts
const current = queue[0];

if (current !== undefined) {
  const reviewedAt = new Date();
  const completed = await engine.review(current.item.id, "good", {
    at: reviewedAt,
    responseTimeMs: 1_250,
  });

  console.log(completed.outcome.state.dueAt); // 下次到期时间
  console.log(completed.outcome.data);        // 算法复习详情
  console.log(completed.record.id);           // 已保存历史记录的 ID
}
```

`at` 默认为当前时间。`responseTimeMs` 可省略，但提供时必须为非负数；使用 SQLite
适配器时请传入整数毫秒。下一算法状态及其不可变复习记录会以原子方式提交。

引擎允许复习任意已存在项目，不要求项目已经由 `due()` 返回。是否允许提前复习、
手动复习或重复复习属于应用策略。

如果两个调用方并发复习同一版本的状态，SQLite 只允许其中一次提交成功，另一次会抛出
`ConcurrentReviewError`。此时应重新加载状态或到期队列，再由应用判断是否仍要应用
用户操作。盲目重放一次人工复习可能产生非预期的第二条复习记录。

## 查询复习历史

```ts
const recent = await engine.history(item.id, { limit: 50, offset: 0 });

for (const record of recent) {
  console.log(record.rating, record.reviewedAt, record.responseTimeMs);
  console.log(record.data); // 由算法管理的复习数据
}
```

`history` 会先确认学习项目属于当前算法。使用 SQLite 时，记录按复习时间、再按记录
ID 从新到旧返回。

## 处理预期错误

所有引擎专用错误都继承 `LearningEngineError`：

```ts
import {
  ConcurrentReviewError,
  ItemNotFoundError,
  UnsupportedRatingError,
} from "@alstate/core";

try {
  await engine.review(item.id, selectedRating);
} catch (error) {
  if (error instanceof UnsupportedRatingError) {
    // 从 engine.algorithm.ratings 或到期预览中刷新选项。
  } else if (error instanceof ItemNotFoundError) {
    // 当前算法的作用域内没有该项目。
  } else if (error instanceof ConcurrentReviewError) {
    // 先刷新状态，再决定是否重试。
  } else {
    throw error;
  }
}
```

应在 `LearningEngine.create()` 外层处理 `AlgorithmMismatchError`。它表示存储中已有同名
算法，但版本或有效配置不同；此时应使用原设置、执行显式迁移，或打开独立存储。

无效 ID、日期、JSON 输入、分页或响应时长会导致 `TypeError`。
`AlgorithmContractError` 表示算法返回值违反核心契约，主要与适配器作者有关。

## 运行仓库示例

在 Alstate 仓库根目录运行：

```bash
npm install
npm run example:vocabulary -- help
npm run example:vocabulary -- item:add bank
npm run example:vocabulary -- meaning:add 1 english "a financial institution"
npm run example:vocabulary -- review good
npm run example:vocabulary -- history 1
```

默认数据文件是 `.alstate/vocabulary-example.db`，也可以通过
`ALSTATE_VOCABULARY_DB_PATH` 修改。示例中的词汇结构和 CLI 命令属于应用代码，
不是 Alstate 公开软件包的一部分。

## 后续阅读

- 查看完整的 [API 参考](api-reference.zh-CN.md)；
- 配置和运行[官方适配器](adapters.zh-CN.md)；
- 通过[架构说明](architecture.zh-CN.md)了解软件包和事务边界；
- 根据[扩展 Alstate](extending.zh-CN.md)实现其他算法或存储。
