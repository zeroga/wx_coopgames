# AW 车辆资料库：本次执行结果与接续说明

项目：wx_coopgame（tnprvuglqxugbbmxzjdx）
数据库检查时间：2026-10-01 15:49 UTC
本文件描述已执行的实际修改。不是待执行方案，也不是完整数据已经核实的声明。

## 1. 旧 Work 与初始状态

写入前检查了 pg_stat_activity、事务年龄、pg_locks、应用连接及 migration 历史。
未发现可确认属于旧 Work 的遗留 active / idle in transaction 事务、锁等待或长时间未结束的应用 SQL。
正常 PostgREST、连接池、监控、pg_net、cron 会话保留；本次没有终止任何 backend。

初始数据库已经提交 3 个 AW migration，存在 295 辆车辆、433 个武器配置、776 个弹药配置、270 条展示用科技树边、327 条解锁路径、330 个条件、28 条 Token 产出关系及 6 个 Dealer。
复用了这些结构与车辆 ID，没有从头初始化。private 中已有共享团队与成员机制，AW 实际计划为 0。

完整前后字段、类型、主外键、唯一/Check 约束、索引、函数、视图、Trigger、policy 与 RLS 清单分别见 schema_inventory_before.json 和 schema_inventory_after.json。

## 2. 最终记录数

| 实体 | 记录数 |
| --- | ---: |
| 车辆 | 298 |
| 武器配置 | 440 |
| 弹药配置 | 782 |
| 研发配件 / 升级 | 1172 |
| 能力定义 / 车辆能力配置 | 22 / 390 |
| ERA 配置 / 覆盖位置 | 59 / 0 |
| 步兵能力配置 | 22 |
| 导弹制导模式关联 / 弹药效果标签关联 | 22 / 72 |
| 弹药与升级关联 / 武器与升级关联 | 213 / 31 |
| Token 定义 / 产出关系 | 6 / 28 |
| 解锁路径 / 条件 | 364 / 369 |
| 展示用科技树边 | 270 |
| 有名称的历史分支 / 成员关系 | 1 / 8 |
| 装甲记录 / 乘员职责记录 | 4 / 4 |
| 完成的导入批次 | 25 |
| 实际团队计划 | 0 |

实体数是车辆相关配置数，不代表全球唯一的武器或弹药型号数；同名武器在不同车辆/配置中可拥有不同性能。唯一键确保同一配置不重复。

## 3. 结构与语义

| 需求 | 当前实现 |
| --- | --- |
| 身份、性能、获取状态 | vehicles，dealer 外键；内部名称、中文名、重量、功率、功重比、上市状态等独立字段 |
| 能力与获取阶段 | capabilities、vehicle_capabilities；default / research / upgrade / unknown / absent |
| ERA 类型、代数、层数、覆盖 | vehicle_era、era_coverage；未知覆盖位置不猜测 |
| 步兵班 | vehicle_infantry；兵种、数量、冷却、能力配件关联可扩展 |
| 多武器 / 多弹药 | vehicle_weapons、vehicle_ammo；口径、装填、弹匣、穿深等独立字段 |
| 导弹 | ammo_guidance_modes、ammo_trait_links；制导、攻顶、战斗部等规范代码 |
| AP 条件穿深 | ammo_type 区分 AP / APFSDS / APDS / APCR；基础 penetration + ammo_penetration_samples |
| 配件依赖与效果 | vehicle_upgrades、upgrade_prerequisites、weapon_upgrade_links、ammo_upgrade_links |
| Token | tokens + vehicle_token_rewards + unlock_requirements.token_id |
| 复杂科技树 | unlock_paths + unlock_requirements；路径间 OR、同路径内 AND；可引用前置车辆、前置升级、Token、事件、数值条件 |
| 升级目标解锁 | unlock_paths.target_upgrade_id；允许另一辆车解锁某车辆升级 |
| 团队计划 | 复用 private.coop_profiles / workspace_members 与 private.aw_fleet_plan_items；唯一键为团队 + 成员 + 车辆 |
| 计划状态 | planned / researching / owned / abandoned |
| 来源与续跑 | source_url / source_type / verification_status / last_checked_at；private 导入批次、原始快照、问题队列 |

public.aw_effective_capabilities 统一处理 APS 子能力和武器产生的 ATGM / 机炮能力。
public.aw_token_relations 提供 produces / requires。
public.aw_tech_tree_requirements 提供车辆目标关系；public.aw_upgrade_unlock_requirements 提供配件目标关系。
vehicle_progression_edges 只用于展示线索，不作为已完整核实的研发条件来源。
“无 ERA”仅返回明确记录 absent 或能力清单已核实完整的车辆；缺少 ERA 记录不等于无 ERA。

标准单位：速度 km/h；炮弹/导弹飞行速度 m/s；装填、瞄准、加速、冷却时间秒；距离米；穿深与装甲毫米；重量吨；功率 hp；射速发/分钟；伤害为游戏数值。
线性散布 accuracy 使用米；角度散布 accuracy_deg 使用度，不能缺少距离时强行换算。
装甲物理厚度与 effective_ap / effective_heat 分开；当前少量 Wiki 有效装甲未猜测成正面物理厚度。

## 4. 已执行的验证

PR 补充说明：本节如实记录此前正式库上已发生的检查与事务测试，不代表推荐的测试流程。正式库事务测试即使回滚也会取得锁，不应作为验证环境。后续测试仅限隔离数据库和合成数据；新幂等脚本尚未完成隔离环境验证，详见 README.md 与 production_test_audit.json。原 ZIP 保留原始交付版本。

已实际执行 Tier、车型、Dealer、ERA、烟幕、APS、步兵、自导、攻顶、Fire-and-forget、AP 阈值、Token、分支与科技树查询。
使用最终结构的事务内测试还验证：默认/研发能力区分、前置配件解锁车辆、多条件组合、多人计划同车、owned 状态、错误团队码拒绝、非成员拒绝。
其中匿名角色测试实际使用 SET LOCAL ROLE anon；测试结束 ROLLBACK，没有保留模拟用户或模拟车辆。

当前公开查询结果举例：

| 查询 | 匹配车辆数 |
| --- | ---: |
| Tier = 10 | 55（含 3 辆仅公布的新车） |
| ERA = 有 | 55 |
| 明确 ERA = 无 | 1 |
| 烟幕 | 136 |
| APS | 39 |
| 步兵班 | 22 |
| 自导导弹 | 16 |
| 攻顶导弹 | 4 |
| Fire-and-forget | 1 |
| AP 类穿深 ≥ 800 mm | 33 |
| Russian Fire Support 历史分支 | 8 |
| 需要 Sophie Wolfli T10 Token | 3 |
| 生成 Sophie Wolfli T10 Token | 5 |

最终检查：异常 active / idle in transaction 为 0，等待锁 0，未完成批次 0，失效索引 0，未验证约束 0，重复车辆 slug 0，同车同名同配置武器重复 0，孤立弹药和解锁路径 0，残留测试车辆 0。
最新 unknown 弹药配置筛选不会把已确认需要研发的配置误归入未知。

## 5. 数据核实范围与缺口

295 辆原有车辆保留 needs_ingame_check，不能因为字段已经结构化就升级成已核实。
新增 ZBD-100、Type 100 CSV、ZTZ-100 依据官方 2026 年公布资料记录身份与活动条件，release_status=announced；数值性能留 NULL。public_verified 指已有公开来源支持的记录，不代表尚未上线的性能实测。
官方 LRA 资料补入 17 辆侦察车辆的升级能力与两条可选获取路径；无法可靠确认的伤害门槛保持 NULL、不完整标记。
修复网页导航误当弹药、合并武器名称、AMPV 发射器文本碎片等解析错误；原始问题记录已隔离，无法可靠对应的数值未迁移到猜测的武器。
2 辆原来没有弹药的车补入 6 个 Wiki 弹药配置；同时补少量乘员、装甲、加速数据，仍待游戏内确认。

当前关键缺口：

- 209 辆车辆有 HP、最大速度、视野、隐蔽四项基础数值。
- 除 3 辆 announced 新车，25 辆尚无弹药记录，2 辆尚无武器记录。
- 143 辆获取/研发条件仍为待核实占位问题。
- 272 辆没有已完整核实的车辆解锁路径。43 条完整路径中 26 条目标为车辆，17 条目标为 LRA 升级。
- 当前完整科技树的数据尚未填齐，不能把 270 条展示边当成所有前置条件已确认。
- ERA 覆盖位置、多条件 AP 穿深样本、升级之间明确依赖目前为空，结构已预留。
- 分支成员依据官方历史介绍，只能作为待当前版本复核的分支信息。
- 问题队列共 176 项，171 项未解决；缺数据清单可直接从数据库读取。
- 中文名、内部名称、未核实性能、ERA 位置、兵种数量、研究费用等未知值继续留 NULL。

## 6. 小程序使用示例

```sql
-- 10级 MBT，具有 ERA 和烟幕；any 包含已记载的研究/升级配置
select id, name, tier, vehicle_class
from public.search_aw_vehicles(
 p_tier => 10, p_vehicle_class => 'MBT',
 p_has_era => true, p_capabilities => array['smoke']
);

-- 仅默认拥有的步兵能力
select id, name from public.search_aw_vehicles(
 p_capabilities => array['infantry_squad'], p_availability => 'default'
);

-- 同一弹药同时拥有自导和攻顶特性
select id, name from public.search_aw_vehicles(
 p_ammo_traits => array['self_guided','top_attack']
);

-- AP类数值穿深；指定距离时只使用该距离已记录的样本，不作插值
select id, name from public.search_aw_vehicles(p_min_ap_penetration => 800);

select * from public.aw_token_relations;
select * from public.aw_tech_tree_requirements;
select * from public.aw_upgrade_unlock_requirements;
select * from public.aw_catalog_quality;

-- 团队计划接口需真实 workspace_id 与团队码；不要向客户端暴露 private 表
-- public.get_aw_fleet_plan(...)
-- public.upsert_aw_fleet_plan_item(...)
-- public.set_aw_vehicle_plan_status(...)
```

search_aw_vehicles 返回完整车辆行，字段和 RPC 参数见 database.types.ts。
已公布车辆暂不等于可获得车辆：前端应再检查 release_status、is_currently_researchable。
AP 主数值当前是来源的基准口径；没有确认距离/角度时不宣称为特定距离穿深。
能力筛选区分配置获取阶段；未记录的能力或 unknown 配置不能当作默认没有/默认拥有。

## 7. 安全状态

public 车辆资料表启用 RLS，仅向 anon / authenticated 授予读取；新增视图使用 security_invoker。
private 团队、原始快照、导入批次与问题表无公开读写权限。团队写入通过校验团队码与成员存在性的 RPC。
复用当前团队码模型：持有有效团队码即可修改该团队成员的计划，并非 auth.uid() 对应成员的独立写权限。下一阶段做微信登录时应绑定成员身份。
删除仍有 AW 计划的成员会被 Trigger 拒绝，以避免留下悬空成员计划。
service_role 未写入任何客户端文件或本交付包。

Supabase Advisor 仍报告：
- 6 条 INFO：private 表 RLS 无 policy，这是禁止直接客户端访问的设计。
- 6 条 WARN：原有共享团队 / game_state 的 public SECURITY DEFINER RPC 可匿名执行；它们为现有团队码工作流入口，需在后续登录体系中继续复核。
- 14 条 INFO：尚未被统计使用的新/旧索引；没有因此删除筛选与外键用途的索引。
未报告缺失外键索引。完整结果见 advisors.json。
说明链接：
https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

## 8. 中断后如何接续

1. 首先运行 resume_readonly.sql，重新检查真实事务、锁、migration、表数量、完成批次和未解决问题。
2. 不根据本文件假设数据库此后未改变。读取 private.aw_import_batches 与 supabase_migrations.schema_migrations。
3. 已完成批次不重跑；确定新的问题/缺数据后才建立新的唯一 batch_key。
4. 每批只处理有限车辆，配合唯一键 / ON CONFLICT；数据写入和该批完成标记应在同一短事务提交。
5. 限制 lock_timeout 与 statement_timeout；任何失败批次回滚，不把长事务留在连接上。
6. 仅在确认 backend 无正常用途且属于旧任务后才考虑终止。检查 SQL 不会自动终止连接。
7. 更新来源及 verification_status，补齐真实关系，再解决对应 issue_key；没有可信来源就保持未解决。
8. private.aw_source_snapshots 保存原始已切换字段；本次已从核心表移除旧 traits / researchable_components JSON，后续重解析应读快照，不引用已删除字段。

01–24 SQL 是此次执行历史，并非可按编号重新执行的初始化脚本。一些早期脚本引用后来移除的旧字段；不要整包重跑。
22_final_rollback_tests.sql 对最终结构有效，测试需以维护角色运行，会回滚测试数据。
25_final_health.sql 和 resume_readonly.sql 用于再次检查当前状态。
catalog_snapshot.json 是公开目录的时间点数据导出；schema_inventory_after.json 是结构清单，均不代替完整 pg_dump 或 migration 基线。
交付包不含真实团队资料、团队码、用户身份或服务端密钥。

## 9. 本次补充的主要来源

- 官方 AMPV-30 开发介绍：https://armoredwarfare.com/en/news/general/development-ampv-30
- 官方高级车辆介绍：https://armoredwarfare.com/en/news/general/offer-firepower
- 官方 Leclerc T40 介绍：https://armoredwarfare.com/en/news/general/development-leclerc-t40
- 官方 LRA 开发日志：https://armoredwarfare.com/en/news/general/developer-diary-loitering-recon-ammunition
- Into the West 活动：https://armoredwarfare.com/en/news/general/west-battle-path-info-and-preorder
- 官方新车奖励预告：https://armoredwarfare.com/en/news/general/west-battle-path-prize-highlights
- ZBD-100：https://armoredwarfare.com/en/news/general/development-zbd-100
- Type 100 CSV：https://armoredwarfare.com/en/news/general/development-type-100-csv
- 历史分支：https://armoredwarfare.com/en/news/general/branch-month-russian-fire-support
- B1 Centauro 120 Wiki：https://armoredwarfare.fandom.com/wiki/B1_Centauro_120
- M8-120 Thunderbolt II Wiki：https://armoredwarfare.fandom.com/wiki/M8-120_Thunderbolt_II

具体记录还保留自身来源与备注；未把真实世界装甲数据误用为游戏数值。
