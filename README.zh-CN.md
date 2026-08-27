# Alstate

[English](README.md) | 简体中文

> 实验性项目：所有软件包目前均处于 `0.x` 阶段；在 `1.0` 之前，公开 API
> 和持久化状态格式仍可能发生变化。

Alstate 是一个无界面、可嵌入的学习调度运行时。它负责协调由应用管理的学习项目、
调度算法、持久化状态和不可变的复习历史，但不规定具体的内容模型或用户界面。

## 软件包

| 软件包 | 职责 |
| --- | --- |
| `@alstate/core` | 与算法和存储无关的引擎工作流及扩展契约。 |
| `@alstate/sqlite` | 核心存储契约的 SQLite 实现。 |
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

```bash
npm install @alstate/core @alstate/sqlite @alstate/fsrs
```

```ts
import { LearningEngine } from "@alstate/core";
import { FsrsAlgorithm } from "@alstate/fsrs";
import { SqliteLearningStore } from "@alstate/sqlite";

const engine = await LearningEngine.create({
  store: new SqliteLearningStore("learning.db"),
  algorithm: new FsrsAlgorithm(),
});

const item = await engine.add({ prompt: "2 + 2", answer: "4" });
const due = await engine.due();
await engine.review(item.id, "good");
await engine.history(item.id);
engine.close();
```

每个引擎实例绑定一个已注册的算法。所有学习项目操作都限定在该算法的作用域内；
并发复习通过乐观状态版本控制，避免较旧的状态转换覆盖较新的结果。

## 项目边界

Alstate 负责：

- 学习项目的身份和由应用定义的不透明 JSON 数据；
- 算法初始化、到期预览和复习流程协调；
- “学习项目与初始状态”以及“状态更新与复习记录”的原子持久化边界；
- 算法身份、配置和版本安全；
- 调度算法和存储适配器的扩展契约。

Alstate 不负责内容结构、标签、牌组、导入格式、用户、身份验证、页面渲染、CLI
或 HTTP 交互策略。

## 仓库结构

本仓库使用 npm workspace。根目录刻意不设置 `src/`；每个可发布软件包都拥有自己
的源码、测试和构建产物。

```text
packages/core/
packages/sqlite/
packages/fsrs/
examples/vocabulary-cli/
test/integration/
```

词汇 CLI 是用于集成测试的私有 workspace，不会发布到 npm。

## 本地开发

SQLite 适配器要求 Node.js 22.13 或更高版本。

```bash
npm install
npm run check
npm run example:vocabulary -- help
```

进一步了解实现设计，请阅读[架构说明](docs/architecture.zh-CN.md)和
[SQLite 数据模型](docs/data-model.zh-CN.md)。

## 版本策略

在 `0.x` 阶段，三个公开软件包使用相同版本号并同步发布。如果尝试使用不同版本或
配置重新注册同名算法，Alstate 会拒绝启动，而不会静默地重新解释已有状态。
`0.1.0` 尚未提供通用的算法状态迁移 API。

## 许可证

MIT
