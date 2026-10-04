# SnowRunner UI 设计基准

> 状态：视觉基准（source of truth）  
> 基准提交：`4177de40fdb32517b98af83ce4b8a0fce9ab716d`  
> 基准日期：2026-10-04  
> 范围：微信小程序公共视觉语言、SnowRunner 首页、推进清单、赛季资料管理  
> 原则：以后 AW、战舰世界等模块优先继承本基准；不得以“统一触摸高度”等理由改变已确认的 SnowRunner 视觉密度。

## 1. 为什么以 4177de4 为基准

`2026.10.04.7` 的全局 UI 整改尝试把 SnowRunner 与 AW 抽成共享组件，但同时引入了 `min-height:44px` 等通用触摸尺寸，导致 SnowRunner 原有按钮、页签、选择项和操作区被撑高，页面明显变空。

因此：

- **4177de4 的 SnowRunner 实际代码是视觉事实来源。**
- `2026.10.04.7` 中新建的共享组件只能作为实现草案，不能反向定义 SnowRunner 应该长什么样。
- 触摸区域可以扩大，但必须与视觉盒模型分离，不能改变下面列出的已确认视觉尺寸和页面密度。
- 后续如果设计基准需要改变，应先单独确认 SnowRunner 的视觉变化，再更新本文件和机器可读基准。

## 2. 基础视觉 Token

### 页面与字体

| 项目 | 基准值 |
| --- | --- |
| 页面背景 | `#f1f0f2` |
| 主文字 | `#1c1a1e` |
| 次文字 | `#6b6370` |
| 基础字号 | `28rpx` |
| 字体栈 | `-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif` |

### 品牌与状态色

| 语义 | 基准值 |
| --- | --- |
| 主强调 / 用户 A | `#ea7428` |
| 用户 B | `#663171` |
| 完成深绿 | `#0c7156` |
| 同步成功浅绿 | `#58ba9b` |
| 危险 / 删除 | `#cf3a36` |
| 次级灰紫 | `#6b6370` / `#8a828e` |
| 浅灰控件底 | `#ece9ed` |
| 输入底色 | `#f1f0f2` / `#f6f4f7` |
| 备注底色 | `#f2eff3` |

## 3. 卡片规范

全局 `.card`：

- 背景：`#fbfafc`
- 边框：`1rpx solid rgba(28,26,30,.12)`
- 圆角：`22rpx`
- 阴影：`0 8rpx 26rpx rgba(28,26,30,.05)`

常见卡片内部尺寸：

| 场景 | 内边距 / 间距 |
| --- | --- |
| 推进阶段卡 `.step` | `25rpx` |
| 云存档卡 `.cloud` | `26rpx`，下间距 `18rpx` |
| 合作成员卡 `.identity` | `22rpx 26rpx`，下间距 `18rpx` |
| 赛季管理三类卡 | `26rpx`，下间距 `18rpx` |
| 首页游戏卡 | `30rpx 30rpx` |
| 推进卡列表间距 | `20rpx` |
| 首页游戏卡列表间距 | `18rpx` |

**锁定规则：** 后续共享卡片组件不能用更大的默认 padding 覆盖上述页面级尺寸。

## 4. 按钮规范

全局 `.btn` 原始定义：

```css
.btn {
  border: 0;
  border-radius: 14rpx;
  font-size: 26rpx;
  line-height: 1;
  padding: 22rpx 26rpx;
}
```

主按钮：

- 背景 `#1c1a1e`
- 文字白色

次按钮：

- 背景白色
- 文字 `#1c1a1e`
- `1rpx` 浅边框

### 关键约束

- **视觉按钮没有统一 `44px` 最小高度。**
- 不允许给 `.btn`、页签、分段选项、车辆归属按钮统一追加 `min-height:44px`。
- 如果需要满足更大的触摸区域，应使用**不参与布局的透明点击层、绝对定位命中区或其他不改变视觉盒尺寸的实现**。
- 不用“可点击区域至少 44px”反推视觉按钮必须 44px 高。
- 并排按钮可以通过父级 `display:flex`、`flex:1`、`min-width:0` 保证等宽，但不能通过增加高度来统一。

推进清单中：

- 云存档并排按钮继续使用全局按钮纵向 padding。
- `.cloud-actions-three .btn` 仅将字号改为 `24rpx`。
- `.btn-small` 仅将字号改为 `21rpx`，左右 padding 为 `18rpx`，不额外放大纵向高度。

## 5. 页签与分段选择

### PC / 主机页签

容器 `.tabs`：

- 背景 `#dedbe0`
- 圆角 `16rpx`
- padding `5rpx`
- 上下 margin `20rpx`

页签 `.tab`：

- `flex:1`
- `padding:17rpx`
- 圆角 `12rpx`
- 选中项白底、深色字、轻阴影
- **没有额外最小高度**

### 创建人分段

容器 `.segment`：

- 背景 `#ece9ed`
- 圆角 `12rpx`
- padding `3rpx`

单项 `.seg`：

- `padding:10rpx 17rpx`
- 圆角 `9rpx`
- 字号 `22rpx`
- 用户 A 选中：橙色
- 用户 B 选中：紫色

### 车辆归属

`.assign`：

- gap `8rpx`
- margin `10rpx 0 0 47rpx`

`.assign-btn`：

- `padding:8rpx 14rpx`
- 圆角 `9rpx`
- 字号 `20rpx`
- 最大宽度 `220rpx`

这类控件属于**紧凑状态选择**，不能被普通按钮高度覆盖。

## 6. 推进清单密度

页面：

- `.page`: `padding:28rpx 24rpx 80rpx`
- 顶部深色区：圆角 `24rpx`，padding `32rpx 30rpx`，下间距 `18rpx`
- 标题：`48rpx / 900`
- 同步状态：`21rpx`

阶段卡：

- 阶段卡 padding：`25rpx`
- 卡间距：`20rpx`
- 序号：`44rpx / 900 / line-height:1`
- 阶段标题：`34rpx / 900 / line-height:1.2`
- 副标题：`22rpx`
- 创建人行：上间距 `22rpx`，gap `12rpx`
- 两栏内容：上间距 `24rpx`
- 目标行：`padding:11rpx 0`
- 车辆行：`padding:12rpx 0`
- 行分隔线：`1rpx dashed rgba(28,26,30,.12)`

勾选框：

- 可见尺寸 `34rpx × 34rpx`
- 边框 `3rpx`
- 圆角 `9rpx`
- 完成态 `#0c7156`

目标输入：

- 最小高度 `62rpx`
- 圆角 `10rpx`
- padding `0 14rpx`
- 字号 `25rpx`

备注：

- 最小高度 `104rpx`
- padding `16rpx`
- 上间距 `20rpx`
- 圆角 `12rpx`
- 字号 `23rpx`

折叠完成块：

- `.collapse-tools`: `padding:18rpx 22rpx`
- 完成摘要：`padding:18rpx 20rpx`
- 已完成展开行：`padding:13rpx 16rpx`

## 7. 表单与输入

### 推进清单

合作码输入：

- 高度 `88rpx`
- 圆角 `14rpx`
- padding `0 20rpx`

成员名称：

- 最小高度 `72rpx`
- 圆角 `12rpx`
- padding `0 18rpx`
- 字号 `26rpx`

赛季选择器：

- 最小高度 `72rpx`
- `padding:18rpx 20rpx`
- 圆角 `12rpx`
- 字号 `25rpx`

### 赛季管理

普通输入：

- 高度 `88rpx`
- 圆角 `14rpx`
- padding `0 20rpx`
- 字号 `27rpx`

多行输入：

- 最小高度 `220rpx`
- 圆角 `14rpx`
- padding `20rpx`
- 字号 `27rpx`

## 8. 首页层级

首页：

- 页面 padding：`44rpx 30rpx 80rpx`
- Hero：`padding:42rpx 34rpx`，圆角 `26rpx`，下间距 `28rpx`
- Kicker：`20rpx`，字距 `4rpx`
- 标题：`52rpx / 800`
- 说明：`25rpx`
- 游戏卡：`padding:30rpx`
- 游戏名：`36rpx / 800`
- 游戏说明：`24rpx`
- 箭头：`40rpx`

以后其他游戏模块可以继承这套首页入口层级，不应为单一模块重做一套更高、更松的卡片尺寸。

## 9. SnowRunner 特有语言

以下属于 SnowRunner 已确认的视觉识别，不应被全局化时抹掉：

- 用户 A：橙色
- 用户 B：紫色
- 完成状态：绿色
- COMPLETE 印章
- 任务 / 车辆行使用浅色虚线
- 大号浅灰序号
- 深色顶栏 + 橙色 eyebrow
- 紧凑的分段选择和车辆归属按钮

AW 等模块应继承**层级、卡片、圆角、字体密度、按钮体系**，但不必复制 SnowRunner 特有的 A/B/COMPLETE 语义。

## 10. 共享组件的实现边界

共享组件必须满足：

1. SnowRunner 当前视觉尺寸不因抽象而改变。
2. 公共组件只提取“已经共同存在”的属性，不先发明更大的默认值再让页面适配。
3. 页面有明确尺寸时，页面尺寸优先于共享默认值。
4. 触摸命中区与可见控件分层，不能用统一 `min-height` 破坏密度。
5. 不为了“所有控件一样高”牺牲 SnowRunner 的不同控件层级：主按钮、页签、分段选择、车辆归属本来就不是同一高度。
6. 新模块优先复用本基准；发现确实需要新组件时，新组件不能反向污染现有模块。

## 11. 禁止项

后续 UI 整改中以下行为默认视为基准违例：

- 给所有按钮、页签、标签、选择项统一设置 `min-height:44px`
- 为扩大触摸区而增加卡片 / 行 / 标签的布局高度
- 将 `.assign-btn`、`.seg` 等紧凑控件改成普通按钮高度
- 将推进卡 padding 从 `25rpx` 普遍放大
- 将推进卡间距从 `20rpx` 普遍放大
- 将标签 / 选择项字号无条件提高到普通按钮字号
- 用新的共享样式覆盖 SnowRunner 已存在的页面专属尺寸
- 只凭“视觉更统一”调整已确认页面，而没有对照本基准

## 12. 源文件

视觉基准来自 `4177de40fdb32517b98af83ce4b8a0fce9ab716d`：

- `miniprogram/app.wxss`
- `miniprogram/pages/home/index.wxml`
- `miniprogram/pages/home/index.wxss`
- `miniprogram/pages/game/index.wxml`
- `miniprogram/pages/game/index.wxss`
- `miniprogram/pages/season/index.wxml`
- `miniprogram/pages/season/index.wxss`

机器可读值见 `snowrunner-ui-baseline.json`。

## 13. 后续使用方法

每次做 UI 改动时按下面顺序：

1. 先查本基准，确认要复用的组件层级。
2. 再看当前 SnowRunner 页面，不从 AW 当前样式反推公共规范。
3. 新增共享类时，先验证不会改变 SnowRunner 的可见尺寸。
4. UI 回归至少比较：首页、推进清单、赛季管理。
5. 对 SnowRunner 的视觉改动必须单独列出，不允许藏在“全局组件统一”里。
6. 用户确认视觉变更后，才修改本基准。

