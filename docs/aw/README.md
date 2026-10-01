# AW 数据库建表、交付与接续

本目录记录 AW 车辆资料库在 Supabase 项目 wx_coopgame 的实际建设结果；2026-10-01 UTC / 2026-10-02 香港时间交付。
数据库已经完成本次建表与回填。本 PR 归档和固化 SQL，不要求再次初始化线上数据库。

## 文件入口

| 文件 | 用途 |
| --- | --- |
| [幂等建表 SQL](../../supabase/sql/003_aw_catalog_idempotent.sql) | 当前最终结构；30 张 AW 相关表，以及约束、索引、视图、函数、Trigger、RLS 与权限 |
| [只读检查 SQL](../../supabase/sql/004_aw_catalog_verify.sql) | 检查连接、锁、migration、批次、质量缺口、数量和 RLS |
| [最终结构测试](../../supabase/tests/aw_catalog_rollback_tests.sql) | 仅在隔离数据库以维护角色运行；使用合成数据 |
| [线上 migration](../../supabase/migrations/) | 14 条已提交的 AW 历史 migration，与线上 version/name 对应 |
| [完整执行报告](AW_database_report.md) | 数据模型、统计、查询示例、来源、权限边界及剩余工作 |
| [原交付包](AW_database_handoff.zip) | 保留此前交付的 ZIP 原文件；包含结构清单、快照、执行历史和接续检查 SQL |
| [公开目录快照](../../data/aw/catalog_snapshot.json) | 可通过 Git diff 查看和维护的车辆、武器、弹药、标签及关系数据 |
| [批次和问题清单](../../data/aw/data_quality_and_batches.json) | 已完成批次、公开车辆数据缺口；不包含真实团队记录或团队码 |
| [TypeScript 类型](../../supabase/types/database.types.ts) | 本次线上 schema 生成的类型 |
| [正式库试执行审计](production_test_audit.json) | 如实记录已发生的事务试执行；不是隔离环境验证通过的证明 |

## 使用幂等脚本

依赖现有共享团队表 private.coop_profiles 和 Supabase 提供的 anon / authenticated / service_role 角色。
新建环境先审查并应用 supabase/sql/001_snowrunner_core_idempotent.sql，再审查并应用 003_aw_catalog_idempotent.sql。
已建表环境先运行 004_aw_catalog_verify.sql；没有结构缺口时，无需因为合并本 PR 就再次执行 DDL。

幂等脚本：
- CREATE TABLE IF NOT EXISTS，缺字段才 ADD COLUMN IF NOT EXISTS。
- 约束、索引、Trigger、policy 先按名称检查；正确存在则保留，缺失才创建。
- 既有字段类型、NULL 约束、默认值/生成表达式，以及同名约束、索引或 Trigger 不兼容时明确报错并回滚。
- 视图与函数使用 CREATE OR REPLACE，恢复当前规范定义；公共目录只读，私有资料通过团队码 RPC。
- 不 DROP TABLE、不 TRUNCATE、不删除/覆盖车辆数据、不改写 migration history。
- 单个短事务，lock_timeout=3s、statement_timeout=25s、idle_in_transaction_session_timeout=30s。执行失败应关闭/回滚客户端事务。
- 不自动把旧版 traits / researchable_components JSON 再迁移或删除。较旧环境需结合历史迁移与数据批次人工审查，不能只加表就宣称完成升级。

验证限制：曾在正式库事务中连续试执行两次并 ROLLBACK，观测到 30 张表记录数不变，筛选与匿名权限结果正常。这种测试环境选择不妥：DDL 即使回滚仍会取得锁，不能据此宣称脚本已完成隔离验证。详见 production_test_audit.json。
尚未完成独立空库建表及重复执行测试；后续只能在隔离数据库验证，共享团队基线依赖必须先满足。禁止把正式库作为测试环境。测试脚本仅限隔离数据库及合成数据。
本 PR 不配置自动部署。不要把 001、003 与历史 migration 混合重跑：若先建最终结构又重放早期 CREATE TABLE，仍会冲突。

## 历史 migration 与数据导入

supabase/migrations 中的 SQL 保留线上原始行为，部分为一次性 DDL/字段切换，并非通用幂等建表入口。
目标项目的 14 个 version 均已应用；迁移工具应依赖实际 history 跳过已应用版本，先确认远端状态，不执行 reset，不通过 repair 伪造状态。
从旧版数据升级时，canonical_relations_cutover 前必须完成组件和 Token 回填；原 ZIP 中有相应执行历史，但不应按 01–24 无条件全部重跑。

公开快照不是自动 seed 脚本，也不是完整 pg_dump。后续补数据应按唯一键 / upsert 分小批写入，并在 private.aw_import_batches 中持久化完成状态。
原始快照和错误隔离记录保存在数据库 private schema，便于中断后继续。新增事实应有来源，不确定字段保留 NULL。

## 当前完成程度

298 辆车辆（含 3 辆仅公布的新车）、440 个武器配置、782 个弹药配置、1172 个升级项目。
已实现结构化 ERA、步兵、能力和弹药标签、Token、复杂解锁关系，以及多人计划同车与计划状态。
资料仍有缺口：25 辆未公布之外的车辆缺弹药、2 辆缺武器、272 辆没有完整核实的车辆解锁路径；不能声称完整科技树已经采集完毕。
295 辆原有车辆为 needs_ingame_check；3 辆新增身份有官方资料，上市状态 announced，性能数值留空。

团队权限目前复用共享团队码：持码者可修改团队成员计划，尚未绑定个人登录身份。公开目录无客户端写权限。
已有共享团队 RPC 的 SECURITY DEFINER 提示及新索引 unused INFO 详见报告/ZIP，不宣称整个项目 Advisor 零告警。

本次仅数据库与交付文件，不修改小程序页面。
