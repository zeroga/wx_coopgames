# AW 空表结构与手动数据导入

本次交付采用两个独立文件：**空表结构 SQL** 与 **数据文件包**。
合并 PR 只保存文件；没有自动建表或自动导入任务。本次未在正式库执行任何 SQL。

| 文件 | 作用 |
| --- | --- |
| [003_aw_empty_schema_idempotent.sql](../../supabase/sql/003_aw_empty_schema_idempotent.sql) | 建立当前最终结构；无车辆种子、回填或业务数据导入 |
| [AW_catalog_manual_data.zip](../../data/aw/AW_catalog_manual_data.zip) | 单独下载，解压后按清单手动执行数据 SQL |
| [数据包 manifest](../../data/aw/AW_catalog_manual_data.manifest.json) | 依赖顺序、表数量、每批行数与 SHA256 |
| [生成契约](../../data/aw/schema_data_contract.json) | 数据包使用的列、生成列、唯一键、主外键元数据 |
| [本地生成工具](../../tools/build_aw_manual_data_package.py) | 只读取文件生成 ZIP；不连接数据库、不自动导入 |

## 1. 建立空表结构

新环境先审查已有的 [SnowRunner 共享表基线](../../supabase/sql/001_snowrunner_core_idempotent.sql)，再执行 AW 空表 SQL。
AW 团队计划复用 private.coop_profiles，不另建用户/团队来源；还依赖 Supabase 标准角色。

SQL 建立 26 张公共资料表及 4 张私有计划/维护表，并配置必要的约束、索引、视图、函数、Trigger、RLS 与权限。
空库执行后这些 AW 表仍为空，能力定义和 Token 等字典也来自独立数据包。
既有正确对象允许重复执行；字段、约束、索引或 Trigger 不兼容时明确报错。
不会清空已有表，不删除车辆、不覆盖现有业务记录，不修改 migration history。
代码中的函数体可以定义未来的团队计划写入行为，但建表脚本不会调用这些写入函数。

目标项目现有表和数据已存在，无需因为本 PR 合并而再次执行任何文件。
此交付不是从旧字段自动升级的迁移链；如果遇到旧 traits / researchable_components 数据，应单独分析后形成修正，不自动删除或回填。

## 2. 手动导入数据包

下载 ZIP，查看包内 README.md 和 manifest.json。
按 batches 数组顺序逐个打开 sql/*.sql，在维护角色的 SQL Editor 中手动执行。
每批最多 50 行、单独提交；共 106 批、4592 条公开实体/关系记录，包含所有 26 张公共资料表的数量清单，空表不生成空 SQL。
不要将所有文件合并成一个长事务。失败后确认失败事务已经回滚，处理该批问题后重试，再继续下一批。

数据 SQL 只有 INSERT，不包含建表、表重置、UPDATE 或 DELETE。
ON CONFLICT (主键) DO NOTHING 保留已有同主键记录，支持重复执行已导入批次。
同 slug 等自然键对应不同 ID 时，唯一约束会报错；需人工确认映射，不猜测合并、不生成新的 ID。
生成列功重比不导入，由数据库计算。保留来源、待核实状态与 NULL；不关闭外键、Trigger 或 RLS。

包中无真实团队/成员/计划数据、团队码、服务端密钥，也不把导入批次历史当作当前环境已经完成的任务导入。
不提供自动数据库执行脚本，不将数据包放入 migrations 或挂到部署任务。
已有正式库数据不必重导；手动导入由维护者根据实际缺口决定。

## 3. 本地再生成

解压数据包以取得 source/catalog_snapshot.json，然后运行：

```bash
python tools/build_aw_manual_data_package.py \
  --source /path/to/source/catalog_snapshot.json \
  --contract data/aw/schema_data_contract.json \
  --output /path/to/AW_catalog_manual_data.zip
```

工具只处理本地文件。公开 JSON 保留在 ZIP 中，便于单车修正与重新打包。
每个数据 SQL 文件的 SHA256、行数和依赖顺序可在包内和仓库里的 manifest 中核对。
固定 ZIP 元数据，同一输入可重复生成相同文件。

## 4. 数据范围与验证状态

本包基于前次公开目录快照，不是本次实时重查。
298 辆车辆、440 个武器配置、782 个弹药配置、1172 个升级项目，包含 ERA、烟幕、步兵、导弹标签、AP 穿深、Token 与科技树关系。
295 辆旧资料仍待游戏内核实，3 辆新车仅公布；完整科技树尚未填齐。
25 辆非 announced 车辆缺弹药、2 辆缺武器、272 辆缺完整核实的车辆解锁路径。未知数值继续留 NULL。
来源、verification_status 和快照时间保留在包内数据，不能把缺记录当成没有该能力。

完成了离线主键/唯一键检查、40 条公共外键关系检查、能力父级循环检查、包内行数和文件校验。
尚未完成独立数据库上的实际建表/导入执行验证；不把此前正式库事务试执行当作隔离验证。
测试只能使用独立数据库和合成数据。手动审查/导入是本交付的使用方式。

公共资料 RLS 只读；团队计划通过团队码 RPC，持码者可修改同团队成员的计划，目前未绑定个人登录身份。

