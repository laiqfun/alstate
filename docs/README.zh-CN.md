# Alstate 文档

[English](README.md) | 简体中文

Alstate 是一个无界面的学习调度运行时，适合需要决定学习项目“何时复习”、同时又不想
把应用数据模型和用户体验交给框架的应用。

它用一套精简工作流连接三个部分：

```text
应用的项目数据 -> LearningEngine -> 调度算法
                       |
                       v
                 状态 + 复习历史
```

卡片、单词、题目、媒体、标签、用户、牌组、导入和界面仍由应用管理。Alstate 只管理
学习项目身份、调度流程、持久化算法状态，以及复习历史的一致性。

## 从这里开始

- [快速上手](getting-started.zh-CN.md)：安装官方组合，并完整演示添加、查询、调度和
  复习学习项目；
- [API 参考](api-reference.zh-CN.md)：说明 `@alstate/core`、`@alstate/sqlite` 和
  `@alstate/fsrs` 的全部公开导出；
- [官方适配器](adapters.zh-CN.md)：介绍 SQLite 存储、FSRS 配置、持久化行为和资源
  生命周期；
- [扩展 Alstate](extending.zh-CN.md)：说明如何实现自定义调度算法或存储适配器，以及
  必须维持的一致性规则。

## 理解设计

- [架构说明](architecture.zh-CN.md)：软件包边界、算法归属和原子工作流；
- [SQLite 数据模型](data-model.zh-CN.md)：数据表、关联、复习提交和迁移；
- [词汇 CLI 示例](../examples/vocabulary-cli/README.zh-CN.md)：使用三个软件包的可运行私有
  应用。

## 软件包

| 软件包 | 用途 | 运行时依赖 |
| --- | --- | --- |
| `@alstate/core` | 引擎和适配器契约 | 无 |
| `@alstate/sqlite` | 本地持久化 | Node.js `node:sqlite` |
| `@alstate/fsrs` | FSRS 调度 | `ts-fsrs` |

SQLite 适配器要求 Node.js 22.13 或更高版本。所有软件包均使用 ESM，目前处于实验性的
`0.x` 阶段。

## 如何选择阅读顺序

如果要立即在应用中接入 Alstate，请依次阅读[快速上手](getting-started.zh-CN.md)和
[适配器指南](adapters.zh-CN.md)。如果要开发适配器，请依次阅读
[架构说明](architecture.zh-CN.md)、[API 参考](api-reference.zh-CN.md)和
[扩展指南](extending.zh-CN.md)。
