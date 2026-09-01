# 词汇 CLI 示例

[English](README.md) | 简体中文

这个私有 workspace 是三个 Alstate 软件包的可运行消费端，用来展示无界面引擎外层的
应用模型和交互流程。它不会发布，其中的词汇结构和 CLI 行为也不属于 Alstate 公开
API。

## 示例展示的内容

- 组合 `LearningEngine`、`SqliteLearningStore` 和 `FsrsAlgorithm`；
- 将词汇字段作为不透明的应用项目数据保存；
- 使用领域字段前先解析已保存的 JSON；
- 添加、读取、完整替换和删除项目；
- 构建到期队列、提交评分并查询复习历史；
- 在引擎外部适配 JSON 导入文件。

```text
src/app/create-app.ts                  组合入口
src/cli/run-cli.ts                     命令处理
src/domain/vocabulary-item.ts          词汇数据和校验
src/infrastructure/read-import-file.ts JSON 输入适配器
src/main.ts                            可执行入口
```

## 运行

在仓库根目录执行：

```bash
npm install
npm run example:vocabulary -- help
```

启动 CLI 前会先构建所有 workspace。默认数据文件是
`.alstate/vocabulary-example.db`。可以通过环境变量运行一个隔离数据库：

```powershell
$env:ALSTATE_VOCABULARY_DB_PATH = "data/my-vocabulary.db"
npm run example:vocabulary -- item:add bank
```

## 命令

| 命令 | 用途 |
| --- | --- |
| `item:add <word>` | 创建一个立即到期的词汇项目。 |
| `item:list [word]` | 列出全部项目，或按单词精确筛选。 |
| `item:show <item-id>` | 显示一个已解析的词汇项目。 |
| `item:delete <item-id>` | 删除项目、状态和历史。 |
| `meaning:add <item-id> <english\|chinese> <meaning>` | 通过替换项目数据追加释义。 |
| `note:add <item-id> <note>` | 通过替换项目数据追加笔记。 |
| `import <json-file>` | 校验并添加 JSON 数组中的记录。 |
| `review [again\|hard\|good\|easy]` | 复习最早到期的项目；省略评分时交互式询问。 |
| `history <item-id>` | 输出项目的复习记录。 |

一套完整的非交互式流程：

```bash
npm run example:vocabulary -- item:add bank
npm run example:vocabulary -- meaning:add 1 english "a financial institution"
npm run example:vocabulary -- meaning:add 1 chinese "银行"
npm run example:vocabulary -- note:add 1 "Common noun"
npm run example:vocabulary -- item:show 1
npm run example:vocabulary -- review good
npm run example:vocabulary -- history 1
```

ID 由 SQLite 生成，因此应使用 `item:add` 实际输出的 ID，不要假设它一定是 `1`。

## 导入格式

`import` 接受 JSON 数组，其中 `word` 必填；释义、笔记和标签数组可省略，省略时
默认为空数组。

```json
[
  {
    "word": "bank",
    "englishMeanings": ["a financial institution"],
    "chineseMeanings": ["银行"],
    "notes": ["Common noun"],
    "tags": ["CET6"]
  }
]
```

导入适配器刻意只支持本示例需要的字段。领域模型中也包含音频和例句数据，但 CLI 没有
提供相应的编辑命令。

## 示例中体现的应用边界

`createVocabularyApp` 是组合入口，也是唯一选择 FSRS 和 SQLite 的地方。领域解析器
负责词汇校验，CLI 负责参数解析、单词精确筛选、评分输入和输出格式。Alstate 只会看到
JSON 项目数据和调度操作。

本示例复习 `engine.due(new Date(), 1)` 返回的第一项。实际应用可以实现不同的队列
策略，但仍应通过 `engine.review()` 提交选中的评分。

可复用的公开 API 请继续阅读仓库的
[快速上手](../../docs/getting-started.zh-CN.md)和
[API 参考](../../docs/api-reference.zh-CN.md)。
