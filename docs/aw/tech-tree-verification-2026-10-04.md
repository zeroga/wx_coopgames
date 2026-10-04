# AW 当前科技树游戏内核验（2026-10-04）

## 证据范围

项目维护者于 2026-10-04 提供当前游戏客户端的 Dealer 科技树总览截图，覆盖全部 6 个 Dealer：

- Sophie Wölfli
- Marat Shishkin
- Zhang Feng
- Oscar Faraday
- Sol Schreiber
- Francine De Laroche

本次只把截图能直接证明的 **车辆节点之间展示/研发关系** 作为游戏内证据。总览图没有显示完整的升级模块门槛、Token 数量、伤害/成就阈值或其他隐藏条件，因此这些字段继续保持原状态，不因本次截图自动判定完整。

## 本次结果

当前本地目录的 `vehicle_progression_edges` 共 270 条。本次把其中 **158 条非 Token 关系**按游戏内总览核验为 `ingame_verified`：

| Dealer（按起点车辆归属） | 游戏内核验关系数 |
| --- | ---: |
| Sophie Wölfli | 42 |
| Marat Shishkin | 43 |
| Zhang Feng | 33 |
| Oscar Faraday | 6 |
| Sol Schreiber | 17 |
| Francine De Laroche | 17 |
| **合计** | **158** |

发现并修正 1 条现有关系：

- 原：`LAV-150 -> XM800T LAW`
- 现：`M113 ACAV -> XM800T LAW`
- 依据：当前 Sophie Wölfli 科技树总览中，XM800T LAW 的分支线从 M113 ACAV 节点引出。

其余本次覆盖的非 Token 关系与当前游戏画面一致。

## 明确保留的边界

- **112 条现有 `public_verified` 关系不因本次截图改成游戏内核验。** 其中包含 Tier 9 / Tier 10 Dealer Token 机制及特殊关系；总览中的横向排布或图标不足以证明 Token 可以由哪一辆来源车支付给哪一辆目标车。
- `unlock_paths` / `unlock_requirements` 没有因总览截图批量标记完整。车辆前置升级节点、Token 数量、LRA/伤害门槛等仍需单独证据。
- Dealer 页面上的高级车、金币/特殊货币车、锁定区车辆，仅因“出现在页面”不能推导为普通研发车，也不能凭位置补线。
- `Go to` 节点只用于核对当前已有的跨 Dealer 显示关系，不把按钮本身解释成额外获取条件。

## 维护方式

游戏内核验覆盖层保存在：

- `data/aw/tech_tree_ingame_overrides.json`

`tools/build_aw_miniprogram_catalog.py` 在读取原始手动数据包后应用该覆盖层，再生成：

- `miniprogram/data/aw/catalog.js`

这样不会改写原始快照，也不会要求重新生成整份 ZIP；以后重新生成小程序本地目录时，本次游戏内修正仍会保留。数据库和手动导入包如需同步修正，应另行执行明确的数据更新，不自动写正式库。
