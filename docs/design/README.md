# 设计原型与源码路径索引

本目录管理 **GitHub 源码 ↔ Figma 原型** 的稳定对应关系，避免依赖聊天上下文、临时导出文件或人工记忆。

## 当前 Figma 文件

- 文件名：`AW 小程序原型（main）`
- File key：`sBc3jQ6u01vDWLbGZQB7qM`
- 地址：https://www.figma.com/design/sBc3jQ6u01vDWLbGZQB7qM
- 当前工作页：`Working · GitHub main`
- 当前工作页 node：`0:1`

详细的页面 / 画板 / 源码映射见 [paths.json](./paths.json)。

## 版本管理

原型采用两层版本管理。

### Working Copy

`Working · GitHub main` 是唯一允许持续修改的工作页。

日常设计调整直接在该页进行。Work 或其他任务要读取“最新设计”时，默认读取这个页面。

### Snapshot

达到一个可识别的设计基线后，在同一 Figma 文件中新建快照页，命名格式：

```
vYYYY-MM-DD · <git-ref>@<short-sha> · <label>
```

当前首个快照：

```
v2026-10-03 · main@e660d7e · baseline
```

快照页建立后视为只读基线，不在其上继续日常编辑。后续设计从 Working Copy 继续演进。

每个快照同时登记到 `paths.json`，记录：

- Figma page node id
- 主要 screen node id
- 对应 Git commit
- 版本日期
- 版本说明

这样即使 Figma Working Copy 后续发生大量变化，也能准确恢复“某一提交当时对应的设计”。

> 不把 `.fig`、`.mg` 等二进制文件放进 Git 作为设计版本基准。Figma 云端保存设计实体，Git 保存定位、对应关系和版本索引。

## GitHub 与 Figma 的职责

### GitHub

GitHub 是以下内容的正式版本基准：

- 小程序实际运行代码
- 页面业务逻辑
- 云端 / 本地状态读写
- 数据文件与数据库结构
- 已经实现并可发布的功能

### Figma

Figma 是以下内容的设计工作区：

- 页面视觉结构
- 布局与层级
- 文本、卡片、按钮、输入框等设计元素
- 计划中的视觉与交互调整
- 代码尚未实现的设计改动

因此 **Figma 可以有意领先于 Git 代码**。差异本身不等于错误。

## Work 核对代码与原型时的规则

1. 先读取 `docs/design/paths.json`。
2. 明确比较的是 `working` 还是某个 `snapshot`，不要默认使用旧截图。
3. 代码侧读取目标分支 / commit 的真实文件。
4. 原型侧读取 JSON 指向的 Figma page 和 screen node。
5. 按 screen 的 `source_paths` 比较，不跨页面猜对应关系。
6. 发现差异后先分类，不自动覆盖任意一边。

差异分类：

- `design-ahead`：Figma 已设计、代码尚未实现。
- `code-ahead`：代码已有、Figma 尚未表示。
- `visual-drift`：同一功能的布局、文案、颜色、尺寸等出现非预期偏差。
- `behavior-only`：属于业务逻辑 / 状态变化，静态原型不要求完整表现。
- `data-only`：属于动态数据内容，不要求原型逐条同步。
- `intentional`：已确认的主动差异，不应自动修复。

默认核对任务只输出差异报告。除非任务明确要求，不因为发现差异就自动修改 Git 或 Figma。
