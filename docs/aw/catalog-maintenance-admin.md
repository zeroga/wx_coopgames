# AW 维护接口：管理员、KEY 和部署

接口使用说明交给其他 AI：[AW 数据维护接口](catalog-maintenance-api.md)。本文件供项目维护者操作。PR #8 包含源码和本地验证，不自动部署 Supabase，也不自动上传微信。

## 交付与部署顺序

1. 拉取 `feat/aw-catalog-fleet-v1`，微信开发者工具打开 `miniprogram/`。代码测试版 `2026.10.06.2`，上传版本号可用 `0.1.0-test.20261006.2`。按 [小程序测试说明](miniprogram-v1-testing.md) 测试后人工提交审核；新后端未上线时客户端仍可用随包/缓存资料。
2. 核对目标 Supabase 项目 `tnprvuglqxugbbmxzjdx` 与现有 AW 结构，不对空库执行只含后续变更的迁移。既有基础脚本、AW 成员/车队结构与实际迁移历史的关系见仓库原说明。本次新增迁移为 `supabase/migrations/20261006103635_aw_catalog_maintenance.sql`，只新增维护结构、RPC、权限和资料 revision 触发器，不导入事实，也不改变玩家/车队结构。
3. 在 SQL Editor 执行这份新迁移，或经核对迁移历史后用 Supabase CLI 部署。不要在已有手工建库的项目上不经检查就 `db reset` 或把全目录历史重新 apply。迁移是一次性，不要重复直接粘贴运行；需要查询 `private.aw_catalog_state` 判断是否已部署。
4. 生成并审查一次性初始化 SQL，导入旧发布已有的证据与修正，然后初始化数据库发布指针。它会检查现有数据库每张表符合仓库旧来源或已核验目标；遇到任何未预期的真实变更整体拒绝，不覆盖新事实。
5. 部署 `aw-catalog`，只读验证 manifest/full/patch；再部署 `aw-catalog-maintenance`，手工签发受限 KEY 验证接口。KEY 不用于微信客户端。
6. 先在独立测试项目验证真实 API，正式项目验证采用明确有证据的维护记录；不要把本文件的合成示例写成真实游戏数据。没有事实变化时，可以拉取空清单并验证只读/认证/拒绝路径。

CLI 使用前检查本机 `supabase --help` 和具体子命令 `--help`。函数部署示例（项目已登录、选定且核对目标后执行）：

```bash
supabase functions deploy aw-catalog --project-ref tnprvuglqxugbbmxzjdx
supabase functions deploy aw-catalog-maintenance --project-ref tnprvuglqxugbbmxzjdx
```

`supabase/config.toml` 两个函数均 `verify_jwt=false`，由 handler 检查 publishable `apikey`；维护函数再检查任务 KEY。默认 JWT 网关不识别任务 KEY，不能开启后把 KEY 当 Bearer JWT 使用。

函数使用平台提供的 `SUPABASE_URL`、`SUPABASE_ANON_KEY`；维护函数另用仅服务端的 `SUPABASE_SERVICE_ROLE_KEY` 调用 service-only RPC。公共 handler 使用 anon 调用只读 RPC，不使用 service role。publishable 认证支持 `SUPABASE_PUBLISHABLE_KEYS`、`SUPABASE_PUBLISHABLE_KEY` 及兼容 `SUPABASE_ANON_KEY`。缺少运行配置返回 503，不能把 service role 填进小程序或给维护 AI。

每次后续数据发布只产生数据库 release，`aw-catalog` 直接读取原子指针，**无需重新部署函数或重新编译小程序**。新接口代码/结构变更才需要再次部署。部署失败或数据库不可用时函数明确报错，客户端保留旧资料；不静默回退 Git 旧 release 冒充最新线上版本。

## 一次性初始化与数据库真源

现有公共数据库是旧原始事实；当前已核验发布另有 158 条科技树边修正和 1 条解锁条件修正，弹药分类/证据与展示关系原先只在随包模块中。迁移不悄悄执行这些事实改动。初始化工具读取仓库已有 ZIP 和当前已核验 release，生成可审查 SQL：

```bash
node tools/build_aw_edge_protocol.js --check
node tools/build_aw_catalog_bootstrap.js work/aw-bootstrap.sql
```

该命令无网络、无数据库写入；需要 Node 和 Python 3。输出约 11 MB，包含明确的原始/核验值、159 条修正、完整证据和已有发行内容。大文件可以在 SQL Editor 打开，或由管理员使用 `psql --file work/aw-bootstrap.sql` 对选定数据库执行；不要把连接串、SQL 历史中的原始 KEY 或生成文件上传 Git。

SQL 加锁核对所有公共记录，保留稳定 ID；意外差异、缺失/新增记录或已初始化都会中止。检查后导入修正和两节内容，核对实际结果，再保存已有已校验 full/patch 并初始化 `current_version`。事务失败全部回滚。若提示 `AW_BOOTSTRAP_DATABASE_DIVERGED`，先审查真实库的新增事实，更新初始化策略，不去改正式事实让检查通过。初始化只用于过渡，不作为今后维护方式。

```sql
select environment, initialized, revision, current_version
from private.aw_catalog_state;
select version, sequence, revision, published_at
from private.aw_catalog_releases order by sequence desc;
select public.aw_catalog_facts();
```

首次 current_version 为 `aw-2026.10.06.1-e8874cd8a93d`。数据库初始化不等于线上函数已采用它，须部署新公共函数后查询线上接口核对。旧 Git 的 `data/aw/deployed.json` 与本地 CLI 发布记录仍可用于历史版本独立核验，不充当新数据库发布指针。

之后正式事实、证据、修改来源、审核清单和完整 release 都存 Supabase。`catalog_snapshot.json` / ZIP 的长期维护方式本次不改：旧 ZIP 留作初始化与历史复现，不要求每次在线维护重新打 ZIP，不把它当新接口的事实真源。

## 手工创建 KEY：在 Supabase SQL Editor 操作

不需要独立 UI。控制数据表在 `private` schema，不公开 Data API；配置写入由你使用 SQL Editor 的管理员身份完成。内部 API 表的 RLS 开启，anon/authenticated/service_role 都不能直接写 KEY 或 grant。

先准备一个随机 KEY 原文，例如在本机终端：

```bash
node -e "console.log('aw_'+require('node:crypto').randomBytes(32).toString('hex'))"
```

你也可以自己定义符合长度和字符限制的随机 KEY。以下 SQL 直接计算 SHA-256，**不需要外部 hash 计算器**；准确计算原文 UTF-8 字节，不 trim、不自动增加换行。

```sql
select encode(sha256(convert_to('在这里替换成你的KEY原文','UTF8')),'hex') as token_sha256;
```

建议通过 SQL 直接完成签发，避免复制 hash 出错。把下面原文占位符换成随机 KEY；本例只给上传者车辆/武器/弹药的 upsert 权限，24 小时有效，不允许删除、拉取或发布：

```sql
with new_grant as (
  insert into private.aw_catalog_grants (
    label, task_id, environment, scopes,
    allowed_tables, allowed_sections, allowed_operations,
    max_operations, max_uploads_per_day, max_reviews_per_day,
    max_publishes_per_day, expires_at
  ) values (
    'AW资料收集AI-20261006', 'aw-maintenance-20261006', 'production',
    array['changes.upload'],
    array['vehicles','vehicle_weapons','vehicle_ammo'],
    array[]::text[], array['upsert'],
    100, 20, 20, 5, now()+interval '24 hours'
  ) returning id, expires_at
)
insert into private.aw_catalog_keys(grant_id,label,token_sha256,expires_at)
select id, '收集AI第1把KEY',
       encode(sha256(convert_to('替换为32到256字符随机KEY原文','UTF8')),'hex'),
       expires_at
from new_grant
returning id as key_id, grant_id, label, issued_at, expires_at;
```

交给 AI 的只有：项目域名、publishable key、任务 KEY 原文和 [接口文档](catalog-maintenance-api.md)。保留返回的 `grant_id` / `key_id` 用于查询、轮换和撤销。SQL Editor 历史会包含你粘贴的原文；表只存 hash 不等于管理员 SQL 历史也没有原文，不把历史截图或 SQL 带进公开仓库。

如果希望分配给不同 AI，创建独立 grant：上传者用 `changes.upload`，拉取者用 `reviews.fetch`，审核发布者用 `reviews.confirm`。拉取和确认的 grant 使用**相同 `task_id` 和环境**，即可交接同一个 review。若同一个 AI 全部处理，可在一个 grant 中给三个 scope。

审核 KEY 要覆盖当前环境所有待处理记录的表/操作/节。全库审核 grant 示例：

```sql
with new_grant as (
  insert into private.aw_catalog_grants (
    label,task_id,environment,scopes,allowed_tables,allowed_sections,
    allowed_operations,max_operations,max_uploads_per_day,
    max_reviews_per_day,max_publishes_per_day,expires_at
  ) values (
    'AW审核发布AI-20261006','aw-review-20261006','production',
    array['reviews.fetch','reviews.confirm'],
    array(select name from private.aw_catalog_contract order by name),
    array['ammoEvidence','presentation'],array['upsert','delete'],
    1000,20,20,5,now()+interval '24 hours'
  ) returning id,expires_at
)
insert into private.aw_catalog_keys(grant_id,label,token_sha256,expires_at)
select id,'审核AI第1把KEY',
       encode(sha256(convert_to('替换为另一把随机KEY原文','UTF8')),'hex'),expires_at
from new_grant
returning id as key_id,grant_id,label,issued_at,expires_at;
```

需要分别拉取与确认时，复制该模板，各自仅授予对应 scope，两个 `task_id` 都填写 `aw-review-20261006`。任务标签用于审计和 review 交接；拉取范围仍是该环境全部未处理记录，不会漏掉其他上传任务。

## 查询、到期、撤销、轮换

KEY 生命周期：管理员定义任务/环境/资源/额度 → 创建 grant 与 hash KEY → 原文交给特定 AI → 每次调用检查 KEY 和 grant 的签发时间/到期/撤销状态 → 成功操作记入 grant 每日用量 → 到期或手工撤销立即拒绝新的操作 → 需要继续工作由你签发新 KEY。

查看状态，不公开 hash：

```sql
select k.id as key_id,k.label,k.grant_id,g.task_id,g.environment,g.scopes,
       g.allowed_tables,g.allowed_sections,g.allowed_operations,
       least(k.expires_at,g.expires_at) as effective_expires_at,
       k.revoked_at as key_revoked_at,g.revoked_at as grant_revoked_at,
       case
         when k.revoked_at is not null or g.revoked_at is not null then 'revoked'
         when k.issued_at>now() or g.issued_at>now() then 'not_yet_valid'
         when least(k.expires_at,g.expires_at)<=now() then 'expired'
         else 'active'
       end as status
from private.aw_catalog_keys k join private.aw_catalog_grants g on g.id=k.grant_id
order by k.issued_at desc;

select grant_id,day,uploads,reviews,publishes,last_used_at
from private.aw_catalog_usage order by day desc;
```

撤销一把 KEY 或整个任务授权：

```sql
update private.aw_catalog_keys set revoked_at=now()
where id='<key_id>'::uuid and revoked_at is null;

update private.aw_catalog_grants set revoked_at=now()
where id='<grant_id>'::uuid and revoked_at is null;
```

确认会在最终写入边界再次检查有效时间；锁保证撤销与在途事务串行。如果撤销等待一个已经持锁的发布，先完成的事务可能成功；撤销不反转已经完成的正式发布。到期不会自动删除任何已提交记录、审核清单、历史 release 或使用计数。

轮换：保留原 grant，不新建 grant 清零额度。先用原 grant 生成第二把 KEY，确认可 introspect，再撤销旧 KEY：

```sql
insert into private.aw_catalog_keys(grant_id,label,token_sha256,expires_at)
select id,'轮换后的第2把KEY',
       encode(sha256(convert_to('替换为新的随机KEY原文','UTF8')),'hex'),
       least(expires_at,now()+interval '24 hours')
from private.aw_catalog_grants
where id='<原grant_id>'::uuid and revoked_at is null and expires_at>now()
returning id as key_id,grant_id,expires_at;

-- 新 KEY 验证成功后：
update private.aw_catalog_keys set revoked_at=now()
where id='<旧key_id>'::uuid and revoked_at is null;
```

原 grant 已到期时，由你重新评估任务：可以在原 grant 上明确延长 `expires_at`，再签发新 KEY。它不会重置当日用量。不要把已撤销的旧 KEY 重新置为可用，也不要靠删除历史来恢复额度。新授权如使用新 grant，需要保留旧审计并确认新 grant 的 task、环境和资源能够接续已有 review。

调整权限/额度也由你通过 SQL Editor 修改原 grant。修改后每次 API 重新核对，不需要等缓存失效。原文丢失不能从 hash 还原；新签发替代，不建立回显 KEY 的接口。保留撤销记录而不是物理删 KEY，以免破坏上传/审核审计外键。

## 读写权限边界

26 张公共事实表对 anon/authenticated 只读；迁移撤销 anon/authenticated/service_role 的直接 DML。`aw_catalog_facts` 仅返回这些表与两节内容。KEY、授权、使用计数、变更队列和审核内容均在 private 表，启用 RLS，未授予公共或 service_role 直接表权限。

写入通过 service_role 可执行的 `public.aw_catalog_admin` wrapper：函数固定空 `search_path`，校验任务 hash / scope / 环境 / 资源 / 到期 / 配额，动态 SQL 只选择固定 26 表契约，表名和字段名使用标识符引用，不接受任意 SQL。private helpers 的 PUBLIC/anon/authenticated/service_role EXECUTE 均撤销；公开只读 RPC 显式授权。函数使用管理员所有者执行受限维护职责，service-role secret 必须仅保存在服务端。

这不是“所有管理员只能在浏览器写”的强制隔离。相同管理员身份通过 SQL Editor、MCP 或 psql 拥有同类权限，数据库无法区分哪个 UI。遵循本次约定：普通业务 AI 只读事实、通过三个接口维护，不拿管理凭证或直接执行正式表 DML；维护者手工管理授权。若现有 AI 连接使用你的管理员凭证，其行为边界仍靠授权约定，不能宣称 RLS 已阻止 owner 写入。

service_role 直接表权限被撤销仍不代表它是可给 AI 的受限 KEY：它可以调用 privileged wrapper，必须视作后台密钥。数据库 owner 能修改函数、授权或正式表，不能把 hash 机制描述成抵御 owner 的隔离。

## 审计、恢复和验证

查看未处理数量与审核历史（仅管理员）：

```sql
select count(*) as unprocessed
from private.aw_catalog_changes c
where not exists(select 1 from private.aw_catalog_processed p where p.change_id=c.id);

select id,task_id,base_revision,base_version,list_sha256,fetched_at,result
from private.aw_catalog_reviews order by fetched_at desc;

select p.change_id,p.review_id,p.decision,p.processed_at,p.reason
from private.aw_catalog_processed p order by processed_at desc;
```

回退事实采用新的有证据变更和新发行，保持 sequence 前进；不要直接改旧 release 的 payload 或指针。数据库备份需覆盖完整正式表、sections、release 和维护审计。新系统不依赖 Git 中最新 archive 推测数据库历史；release 表保留完整 payload 与一跳 patch。恢复完整备份后核对 version/hash/revision，不重建既有 UUID。

本地生成协议由客户端协议和 Node publisher 源码自动包装，避免 Edge 重写编码算法：

```bash
node tools/build_aw_edge_protocol.js --check
node tests/aw-catalog-service.test.js
```

事务集成测试使用 PostgreSQL 17 隔离容器，代码通过真实迁移/旧事实/初始化运行，同时调用实际 Edge handler。有 Docker、Node 和 Python 3 的开发环境可以完整复现：

```bash
bash tools/test_aw_catalog_maintenance.sh
```

脚本创建无网络、没有生产凭证的 disposable container，执行基础结构、新迁移、旧事实 fixture、初始化和事务测试，结束后删除容器；日志保留在忽略的 `work/`。使用固定 PostgreSQL image digest，不启动/重置任何 Supabase 项目。已有隔离容器时也可以设置 `AW_TEST_CONTAINER`、`AW_TEST_DATABASE=aw_catalog_test` 单独执行 `node tests/aw-catalog-maintenance.test.js`。

未设置容器时事务测试明确 skip，不应把 skip 算作通过；不要对正式项目跑合成测试。覆盖固定清单、迟到上传、跨 KEY 幂等与额度、字段冲突、无 updated_at 表的 revision、KEY 到期/撤销/轮换、默认时间戳/计算字段、新车增删、直接 patch 还原、约束/package 失败、实际试写偏差回滚、竞争清单与私有存档删除保护。

线上验证需使用项目 publishable key 和专门短期测试 KEY，确认未授权、scope、空队列、幂等和撤销均按文档响应。上线后的微信端验证缓存激活、离线、无 patch 时 full 回退和编辑期间延迟激活；代码编译通过不等于已通过真实设备或微信审核。

## 本次本地验证记录

PR 更新前完成 123 项 AW 客户端/发布工具回归、17 项 PostgreSQL-backed 测试（16 个业务/安全场景及总测试），全部通过，无 skip。新增迁移在新建隔离 PostgreSQL 17 数据库从头执行，旧事实 fixture 与 guarded 初始化通过；KEY 配置权限、公开只读与私有存档删除保护在真实数据库验证。Edge TypeScript 严格检查、共享协议生成一致性检查、小程序 JS/WXML/路由/样式与资料重建检查通过，微信原生 wcc/wcsc 编译通过；小程序源码约 1.34 MB。

未执行正式 Supabase DDL/事实写入、Edge 部署、真实设备验证或微信上传。部署时仍需按本文件顺序完成真实 API 验收。
