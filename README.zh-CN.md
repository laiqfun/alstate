# Alstate

[English](README.md) | 简体中文

> 实验性项目：所有软件包目前均处于 `0.x` 阶段；在 `1.0` 之前，公开 API
> 和持久化状态格式仍可能发生变化。

Alstate 是一个无界面、可嵌入的学习调度运行时。它为学习项目、到期队列、调度状态和
复习历史提供一套一致的工作流，同时将内容模型和用户体验完全交给应用管理。

你可以用它为 CLI、桌面应用、服务端或其他服务加入间隔重复或自定义学习调度，而无需
采用某种固定的卡片结构、牌组系统或 UI 框架。

## Alstate 负责什么

- 学习项目身份和不透明的应用 JSON 数据；
- 算法初始化、到期预览和复习状态转换；
- “项目与初始状态”及“状态更新与复习记录”的原子持久化边界；
- 不可变复习历史和乐观复习并发控制；
- 算法身份、配置及版本安全；
- 自定义算法和存储的扩展契约。

题目、单词、媒体、标签、牌组、导入、用户、身份验证、页面渲染和交互策略均由应用
负责。

## 软件包

| 软件包 | 职责 |
| --- | --- |
| `@alstate/core` | 与算法和存储无关的引擎工作流及扩展契约。 |
| `@alstate/sqlite` | 核心存储契约的本地持久化实现。 |
| `@alstate/fsrs` | 将 `ts-fsrs` 接入核心算法契约的官方适配器。 |

各软件包之间保持单向依赖：

```text
@alstate/core
   ^          ^
   |          |
sqlite      fsrs ---> ts-fsrs
   ^          ^
    \        /
   词汇示例程序
```

## 快速开始

官方组合要求 Node.js 22.13 或更高版本，并要求项目使用 ESM。

```bash
npm install @alstate/core @alstate/sqlite @alstate/fsrs
```

```ts
import { LearningEngine } from "@alstate/core";
import { FsrsAlgorithm } from "@alstate/fsrs";
import { SqliteLearningStore } from "@alstate/sqlite";

const engine = await LearningEngine.create({
  store: new SqliteLearningStore("data/learning.db"),
  algorithm: new FsrsAlgorithm({ requestRetention: 0.9 }),
});

try {
  const item = await engine.add({ prompt: "2 + 2", answer: "4" });
  const [next] = await engine.due(new Date(), 20);

  if (next !== undefined) {
    console.log(next.preview); // 每种评分对应的下次到期时间
    await engine.review(next.item.id, "good", { responseTimeMs: 1_200 });
  }

  console.log(await engine.history(item.id));
} finally {
  engine.close();
}
```

每个引擎实例只绑定一个已注册算法，学习项目操作也限定在该算法的作用域内。一次复习
会原子地更新状态并追加历史；过期的并发状态转换不能覆盖较新的版本。

## 文档

- [文档首页](docs/README.zh-CN.md)：按使用场景选择阅读内容；
- [快速上手](docs/getting-started.zh-CN.md)：安装和完整应用工作流；
- [API 参考](docs/api-reference.zh-CN.md)：全部公开软件包导出；
- [官方适配器](docs/adapters.zh-CN.md)：SQLite 行为和 FSRS 选项；
- [扩展 Alstate](docs/extending.zh-CN.md)：自定义算法和存储；
- [架构说明](docs/architecture.zh-CN.md)：边界和一致性保证；
- [SQLite 数据模型](docs/data-model.zh-CN.md)：数据库结构和迁移；
- [词汇 CLI](examples/vocabulary-cli/README.zh-CN.md)：可运行的消费端示例。

## 仓库开发

本仓库使用 npm workspace。根目录刻意不设置 `src/`；每个可发布软件包都拥有自己的
源码、测试和构建产物。

```text
packages/core/
packages/sqlite/
packages/fsrs/
examples/vocabulary-cli/
test/integration/
```

词汇 CLI 是可执行的私有示例 workspace，不会发布到 npm。

```bash
npm install
npm run check
npm run example:vocabulary -- help
```

## 兼容性

在 `0.x` 阶段，三个公开软件包使用相同版本号并同步发布。如果使用不同版本或有效
配置重新打开已保存的算法，Alstate 会拒绝启动，而不会静默地重新解释状态。`0.1.x`
API 尚未提供通用的算法状态迁移能力。

## 许可证

MIT
