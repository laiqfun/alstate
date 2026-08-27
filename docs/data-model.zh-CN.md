# SQLite 数据模型

[English](data-model.md) | 简体中文

`@alstate/sqlite` 保存四类引擎数据，并额外记录数据库结构迁移历史。

## 学习项目

```sql
engine_items
------------
id          INTEGER PRIMARY KEY
data_json   JSON NOT NULL
```

`data_json` 归嵌入 Alstate 的应用所有。引擎通过算法状态限定学习项目的访问范围，
不会解释 JSON 中的任何字段。

## 已注册算法

```sql
engine_algorithms
-----------------
id            INTEGER PRIMARY KEY
name          TEXT UNIQUE NOT NULL
version       TEXT NOT NULL
description   TEXT
config_json   JSON NOT NULL
```

已有名称只能使用相同版本和规范化后的相同 JSON 配置再次注册。

## 学习状态

```sql
engine_states
-------------
id                  INTEGER PRIMARY KEY
learning_item_id    FK -> engine_items.id ON DELETE CASCADE
algorithm_id        FK -> engine_algorithms.id
revision             INTEGER NOT NULL DEFAULT 0
due_at               TEXT NOT NULL
state_json           JSON NOT NULL
UNIQUE (learning_item_id, algorithm_id)
```

`due_at` 是用于到期查询的索引投影，`state_json` 归调度算法所有。每次成功复习都会
递增 `revision`，该字段用于乐观并发控制。

## 复习记录

```sql
engine_reviews
--------------
id                  INTEGER PRIMARY KEY
learning_item_id    FK -> engine_items.id ON DELETE CASCADE
algorithm_id        FK -> engine_algorithms.id
rating              TEXT NOT NULL
review_json          JSON NOT NULL
response_time_ms    INTEGER
reviewed_at          TEXT NOT NULL
```

在学习项目的生命周期内，复习记录只追加、不修改。删除学习项目时，其状态和复习历史
也会一并删除。

## 原子复习提交

适配器使用与下列语句等价的方式更新状态：

```sql
UPDATE engine_states
SET due_at = ?, state_json = ?, revision = revision + 1
WHERE id = ? AND revision = ?;
```

如果没有更新任何记录，适配器会抛出并发错误，并且不会追加复习历史。两个写入操作
在同一个 SQLite 事务中执行。

## 数据库迁移

已执行的迁移版本记录在 `engine_schema_migrations` 中。版本 1 创建引擎表结构，
版本 2 增加状态版本号。迁移按顺序执行、可重复调用，并且每个迁移都在独立事务中完成。
