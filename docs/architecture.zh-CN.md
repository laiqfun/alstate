# 架构说明

[English](architecture.md) | 简体中文

## 软件包边界

Alstate 将工作流协调、具体算法策略和基础设施实现相互分离：

```text
应用
 |
 v
LearningEngine（@alstate/core）
    |                         |
    v                         v
LearningAlgorithm        LearningStore
    ^                         ^
    |                         |
FsrsAlgorithm            SqliteLearningStore
（@alstate/fsrs）          （@alstate/sqlite）
```

`@alstate/core` 不导入 Node.js、SQLite 或 `ts-fsrs`。它只定义引擎工作流，以及
适配器必须遵守的行为契约。

## 核心工作流

`LearningEngine` 向应用提供八项操作：

- `add`：校验应用 JSON，初始化算法状态，并以原子方式保存学习项目和状态；
- `get`、`list`、`update`、`remove`：操作归属于当前算法的学习项目；
- `due`：读取到期状态，通过算法解析状态，并返回各评分对应的复习预览；
- `review`：校验评分、计算下一状态，然后以原子方式提交状态和一条不可变复习记录；
- `history`：查询归属于当前算法的学习项目复习历史。

引擎会在运行时校验算法身份、评分、日期和 JSON 兼容的输出。应用数据对引擎保持
不透明，引擎不会解释其中字段。

## 算法归属

每个引擎实例注册并绑定一个 `LearningAlgorithm`。已经注册的算法名称只能使用相同
版本和规范化后的相同配置再次打开，从而避免已有状态被意外地重新解释。

不同算法可以共用同一个物理存储，但学习项目操作彼此隔离。将学习项目转移到另一个
算法属于迁移操作，不在 `0.1.x` API 的范围内。

## 存储契约

`LearningStore` 使用异步接口，因此本地、远程或服务端存储都可以实现它。组合写入
方法定义了两个必须保证的原子边界：

1. 创建学习项目及其初始状态；
2. 提交状态转换及其对应的复习记录。

每个已保存状态都包含单调递增的 `revision`。`commitReview` 必须比较调用方提供的
版本，并拒绝过期的状态转换。SQLite 适配器通过事务中的条件更新实现该语义。

## 官方适配器

`@alstate/sqlite` 通过 `node:sqlite` 提供本地持久化；`@alstate/fsrs` 将调度计算
委托给开源的 `ts-fsrs`，自身只负责 Alstate 适配、JSON 状态格式和日期转换。

## 不包含的能力

内容结构、标签、牌组、导入、用户、身份验证、界面和交互流程均属于应用策略。私有的
词汇 CLI 展示了一种完整组合方式，但不会扩张引擎的公开 API。

## 相关文档

- [文档首页](README.zh-CN.md)
- [快速上手](getting-started.zh-CN.md)
- [API 参考](api-reference.zh-CN.md)
- [扩展 Alstate](extending.zh-CN.md)
