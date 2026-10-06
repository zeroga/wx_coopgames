# AW 数据维护接口：交给其他 AI 的操作说明

本版接口与 PR #8 一起交付，部署操作见 [管理员与部署说明](catalog-maintenance-admin.md)。代码测试版 `2026.10.06.2`。PR 提交不代表接口已部署。所有示例中的凭证、ID、字段值均须替换；不要原样提交示例事实。

## 数据真源和职责

Supabase 的 26 张 AW 公共表，以及数据库中的 `ammoEvidence` / `presentation` 证据与展示关系，是正式资料真源。Git 保存接口代码、结构契约、生成器和历史归档；随小程序编译的 JS 是离线生成物。维护 AI 不改最终 JS，不读 Git JS 判断线上现状，不直接执行正式表 DML，不使用管理员账号、数据库连接串或 `service_role`。

先读正式数据、判断是否确实需要维护，再提交有来源的最小变更。未知值保留 `null` / `unknown` / 待核实状态；不要根据现实武器、名字、相邻车辆推断游戏事实。稳定 UUID、slug、主键保持不变。游戏版本、来源和核验时间写入变更证据及相应事实字段。

三个业务接口由不同 AI 或同一个 AI 操作：

| 接口 | 方法 | KEY scope | 效果 |
| --- | --- | --- | --- |
| `/aw-catalog-maintenance/changes` | POST | `changes.upload` | 上传不可变变更记录，尚不改正式资料 |
| `/aw-catalog-maintenance/reviews` | POST | `reviews.fetch` | 拉取当前环境全部未处理记录，固定审核清单 |
| `/aw-catalog-maintenance/confirm` | POST | `reviews.confirm` | 确认该清单：合并、校验并原子发布，或明确拒绝 |

另有只读 `GET /aw-catalog-maintenance/introspect` 查看当前 KEY 的权限、到期时间和额度。正式事实通过只读数据库 RPC 查询，无须维护 KEY。

上传成功且没有处理记录，就一直是待审核；拉取不改变这个状态。审核结束只处理本次 `review_id` 中的记录。之后新上传的记录留到下一轮。审核不会因拉取或 KEY 到期而删除数据，也没有自动过期待审核记录的流程。

## 地址和认证

项目地址为 `https://tnprvuglqxugbbmxzjdx.supabase.co`。函数路径前缀 `/functions/v1`；数据库 RPC 路径前缀 `/rest/v1/rpc`。测试其他项目时统一替换域名；环境以部署数据库的 `aw_catalog_state.environment` 为准，KEY 环境须一致。

维护接口请求头：

```http
apikey: <项目 publishable API key>
x-aw-key: <管理员交给你的任务 KEY 原文>
Content-Type: application/json
```

publishable key 仅用于项目公共访问，不授予维护权限。`x-aw-key` 才是任务授权。不要把 publishable key 或任务 KEY 放进 Bearer JWT。KEY 只放请求头，不放 URL、变更证据、截图、Git、对外文档或日志。接口不会回传原文或 hash。

任务 KEY 原文为 32–256 个 ASCII 字符，只允许 `A–Z a–z 0–9 _ -`。应使用随机值。数据库只保存 SHA-256；接口计算 hash 后向内部数据库函数鉴权。AI 没有创建、续期、扩权或撤销 KEY 的接口。

## 先查看 KEY，再读取事实

```bash
curl "$AW_URL/functions/v1/aw-catalog-maintenance/introspect" \
  -H "apikey: $AW_PUBLISHABLE_KEY" -H "x-aw-key: $AW_TASK_KEY"
```

返回 `task_id`、`grant_id`、`environment`、`scopes`、`allowed_tables`、`allowed_sections`、`allowed_operations`、`max_operations`、有效截止时间、每日上传/拉取/发布上限和当日 `usage`。轮换同一 grant 下的 KEY 不重置额度。日期按 UTC；失败事务不消耗额度，成功请求的幂等重试不重复计费。空审核拉取也占一次拉取额度。

获取一次一致的完整正式事实：

```bash
curl -X POST "$AW_URL/rest/v1/rpc/aw_catalog_facts" \
  -H "apikey: $AW_PUBLISHABLE_KEY" -H 'Content-Type: application/json' -d '{}'
```

返回：

```json
{
  "initialized": true,
  "revision": 123,
  "current_version": "aw-2026.10.06.1-e8874cd8a93d",
  "checkedAt": "2026-10-01T15:44:08.40133+00:00",
  "tables": {"vehicles": [], "vehicle_ammo": []},
  "ammoEvidence": {"entries": {}},
  "presentation": {"exclusiveWeaponGroups": []},
  "section_sha256": {"ammoEvidence": "<64 hex>", "presentation": "<64 hex>"}
}
```

示例删减了表和内容；实际返回完整 26 表。RPC 在读取时固定资料 revision，没有逐表分页导致的不一致，也不受 Data API 默认 1000 行分页影响。只包含公共事实，不返回 KEY、上传/审核记录或玩家/车队数据。`initialized=false` 表示管理员尚未完成初始化，停止写入操作并报告。

也可以用只读 Data API 按需查询，如 `/rest/v1/vehicles?select=id,name,slug&slug=eq.<slug>`。逐表全量查询必须分页，不能把第一页当整表，也不能把分次查询当一个一致快照；涉及跨表审核时使用上面的 RPC。

完整表和字段契约见 `miniprogram/data/aw/schema.js` 与 `data/aw/schema_data_contract.json`。公共表为：

```text
ammo_guidance_modes ammo_penetration_samples ammo_trait_links ammo_traits
ammo_upgrade_links capabilities dealers era_coverage tech_tree_branches tokens
unlock_paths unlock_requirements upgrade_prerequisites vehicle_ammo vehicle_armor
vehicle_branch_memberships vehicle_capabilities vehicle_crew_positions vehicle_era
vehicle_infantry vehicle_progression_edges vehicle_token_rewards vehicle_upgrades
vehicle_weapons vehicles weapon_upgrade_links
```

## 1. 上传变更

为每次逻辑上传生成一个 UUID `request_id`，保存请求与响应。重试使用相同 ID、相同内容；改变内容必须使用新 ID。幂等范围为 grant，不是 KEY，因此同一 grant 的轮换 KEY 可继续重试。

示例修改某枚弹药的射程（这里只演示格式，不主张实际数值）：

```json
{
  "request_id": "<新 UUID>",
  "change": {
    "reason": "游戏内详情确认该型号弹药的当前射程",
    "evidence": [{
      "source_type": "ingame",
      "source_url": "<来源链接；游戏内证据可省略 URL>",
      "checked_at": "2026-10-06T12:00:00Z",
      "note": "当前版本、车辆名、弹药型号及证据位置；附件由提交者保留"
    }],
    "operations": [{
      "table": "vehicle_ammo",
      "op": "upsert",
      "key": ["<现有弹药 UUID>"],
      "expected": {"range": 1000},
      "values": {"range": 1200}
    }]
  }
}
```

发送：

```bash
curl -X POST "$AW_URL/functions/v1/aw-catalog-maintenance/changes" \
  -H "apikey: $AW_PUBLISHABLE_KEY" -H "x-aw-key: $AW_TASK_KEY" \
  -H 'Content-Type: application/json' --data-binary @change.json
```

响应包括 `change_id`、服务器 `body_sha256`、`submitted_at`、`processed`。hash 用于绑定不可变记录，不是发布包 hash；不要自己计算或用它校验客户端 package。

操作规则：

- `key` 按 schema 的 `primaryKey` 顺序传元组；UUID 使用小写规范形式。`vehicle_progression_edges` 的主键是 `[id]`，不是起点/终点/类型三元组；`ammo_trait_links` 是 `[ammo_id, trait_code]`。
- 修改现有行：`values` 仅包含要改的字段；`expected` 至少包含这些字段的原值，必须来自正式事实。`expected` 可增加审核前置字段。确认时逐字段精确比较，不做 JSON 数组包含式比较。
- 新增：`expected:null`，主键由提交者生成并放在 `key`；`values` 包含必要业务字段。数据库处理缺省值、UUID 类型、CHECK、唯一键和生成字段；新 UUID 不绕过 slug 或其他唯一约束。
- 不允许在 `values` 中改主键、`created_at`、`updated_at`、`power_to_weight_hp_t`。后者由数据库计算。想变更主键应先重新评估稳定 ID 和已有引用。
- 删除：`op:"delete"`，省略 `values`，`expected` 是非空原值对象。删除主键也是元组。任何玩家/车队或其他非资料表引用都会阻止删除，不级联清理存档。
- 上传只检查结构、授权和额度，不表示事实正确或最终约束可满足；原值、类型、引用、互相冲突及 package 能力在确认发布时完整核对。
- `reason` 为 1–2000 字符，`evidence` 非空数组；每项至少有 `note`、`checked_at`，应注明真实来源。整次 HTTP body 最大 256 KiB，每条记录的操作数受 KEY 的 `max_operations` 限制。

弹药分类和互斥武器关系也由数据库维护。两节在本版采用**整节替换**：从事实 RPC 获取完整内容及该节 `section_sha256`，仅修改必要项，再提交：

```json
{
  "request_id": "<新 UUID>",
  "change": {
    "reason": "修正已确认的弹头分类证据",
    "evidence": [{"source_type":"ingame","checked_at":"2026-10-06T12:00:00Z","note":"证据位置"}],
    "operations": [],
    "sections": {
      "ammoEvidence": {
        "expected_sha256": "<事实 RPC 返回的 section_sha256.ammoEvidence>",
        "content": {"checkedAt":"2026-10-06","sources":{},"entries":{}}
      }
    }
  }
}
```

`content` 必须是保留其他既有条目的完整节；不要按示例清空。`presentation` 同样为 `{expected_sha256,content}`，其内容含完整 `exclusiveWeaponGroups`。节 hash 是数据库定义的摘要，直接使用事实 RPC 返回值，不用客户端 canonical hash 代替。KEY 必须在 `allowed_sections` 中允许对应节。同一节的多个不同替换会产生批次冲突，先整合为一个提交。

## 2. 拉取审核清单

```json
{"request_id":"<本次拉取的新 UUID>"}
```

POST 到 `/reviews`。返回 `review_id`、`list_sha256`、`base_revision`、`base_version`、`fetched_at`、`changes` 和可能存在的 `result`。每项包含 `id`、`body_sha256`、完整 `body`、提交时间、来源任务。

审核 AI 逐项查看原因与证据，并与公开事实核对。不要求再把每个变更 ID 传回：服务器保存该清单，确认只引用 `review_id` 和 `list_sha256`。保存原始响应以便追溯。

拉取覆盖当前环境**全部已提交未处理记录**，不按上传者 task 排除，也不悄悄截取首页。审核 KEY 须有权限覆盖每项记录，缺少权限则整体失败。单次队列最多 1000 条 / 4 MiB，超限明确报错，需要管理员处理任务划分或额度；本版不自动截断队列。

没有待审核数据时返回 `review_id:null,changes:[]`。同一个 `request_id` 再试仍返回同一次空结果，不会偷偷拉入后续上传；下一轮检查使用新的 ID。

不同审核 AI 可以拉到相同记录；最先成功处理者生效，其他清单会收到 `AW_REVIEW_ALREADY_PROCESSED`。新的上传不会改变旧清单或资料 revision。

## 3. 确认并发布，或拒绝

审核通过后 POST `/confirm`：

```json
{
  "review_id":"<拉取返回的 ID>",
  "list_sha256":"<拉取返回的 hash>",
  "decision":"publish"
}
```

确认 KEY 的 `task_id` 与创建审核的 KEY 相同，环境、scope 和资源权限也须匹配；允许同一任务下不同 KEY / 不同 AI 或轮换 KEY 接续操作。发布响应包括 `review_id`、`decision:"publish"`、`version`、`sha256`、`sequence`、处理记录数 `count`。

发布在服务器完成：核对固定清单和 revision → 基于原始行合并不冲突字段 → 数据库试写并回滚，获取实际缺省值/时间戳/计算字段 → 使用与客户端同源的协议生成 full 和直接 patch → 验证 hash、结构、主键、唯一键、外键和 patch 合并结果 → 再次鉴权、核对 revision → 正式写入 → 核对实际 after-image → 在**同一个事务**保存 full/patch、移动发布指针、记录本清单已处理。

正式事务失败则整体回滚，清单继续未处理，不移动发布指针、不扣发布额度。成功之后 `aw-catalog` 自动读新版本，无需为每次资料更新重部署函数。重复确认同一清单会返回已完成结果，不重复发布；改成另一种 decision 会报幂等冲突。

manifest 的 `sourceCheckedAt` 是本次资料批次审核快照的时间，不表示所有历史字段都在该日完成游戏内核验；逐项事实的核验状态、来源和 evidence 时间继续保留。

同一行不同字段可以合并；同一字段写相同值会去重；同一字段写不同值、删除与修改重叠或相同节有不同替换，整个批次失败。外键依赖在有限轮次中重试，仍须满足数据库现有约束；不支持通过暂时禁用约束实现最终有效的循环关系或唯一值交换。

数据库被其他正式发布或手工 SQL 修改时，revision 增长，旧清单不能直接确认。重新读取事实并以新 `request_id` 拉取；原先未处理的变更仍在。若其 `expected` 已过时，需要明确拒绝该旧批次，再重新提交适用的变更，而不是绕过预期值。

审核认定记录不适用、冲突无法解决或证据不足时，明确拒绝该清单：

```json
{
  "review_id":"<清单 ID>",
  "list_sha256":"<清单 hash>",
  "decision":"reject",
  "reason":"指出不通过的记录与原因，后续需要重新提交哪些有效变更"
}
```

拒绝处理本清单的全部记录，保留原始记录与拒绝原因，不修改正式事实，不发布。不能在确认时新增变更、替换内容、传自制 hash/package 或挑选未拉取的记录。本版没有逐项通过接口；需保留的有效数据应重新提交新记录。

## 错误和重试

响应格式 `{ "error": "AW_..." }`。任务 KEY 不会延长、扩大权限或因重试重置额度。

| HTTP / 代码 | 操作 |
| --- | --- |
| 401 `AW_UNAUTHORIZED` / `AW_INVALID_API_KEY` | 检查正确凭证；到期/撤销须管理员发新 KEY |
| 403 `AW_SCOPE_DENIED` / `AW_RESOURCE_DENIED` / `AW_ENVIRONMENT_MISMATCH` | 报告实际所需权限，不自行换管理员凭证绕过 |
| 400 `AW_INVALID_*` / `AW_EXPECTED_REQUIRED` / `AW_READ_ONLY_OR_UNKNOWN_COLUMN` | 修正请求格式、契约或预期字段；内容改变使用新请求 ID |
| 409 `AW_IDEMPOTENCY_CONFLICT` | 同 ID 曾绑定其他内容/decision；新逻辑操作用新 ID |
| 409 `AW_BASE_CHANGED` / `AW_EXPECTED_MISMATCH` | 重读正式事实，重新拉取；不删除或强行覆盖历史 |
| 409 `AW_BATCH_FIELD_CONFLICT` / `AW_FOREIGN_KEY_CONFLICT` | 审核整个批次，解决重叠/引用问题；需要时明确拒绝后重提 |
| 409 `AW_REVIEW_ALREADY_PROCESSED` | 查已处理结果，重新拉取剩余队列 |
| 409 `AW_REVIEW_LIST_MISMATCH` | 使用原拉取返回值，不重新拼清单 |
| 409 `AW_PRIVATE_ARCHIVE_REFERENCE` | 保留实体，采用状态/备注等维护方式，不能清理玩家存档 |
| 409 `AW_ACTUAL_WRITE_DIFFERS_FROM_PREVIEW` | 数据库触发器/结构行为改变，停止发布并报告维护者 |
| 413 `AW_REQUEST_TOO_LARGE` | 拆分上传；同节替换仍须完整，不拆掉既有条目 |
| 422 `AW_PACKAGE_VALIDATION_FAILED` | 引用、结构或客户端契约不兼容，报告校验问题，勿发布手工生成物 |
| 429 `AW_QUOTA_EXCEEDED` | 等 UTC 新一天或由管理员调整原 grant；换 KEY 不重置额度 |
| 503 `AW_NOT_INITIALIZED` / `AW_DATABASE_UNAVAILABLE` / `AW_SERVER_CONFIGURATION` | 报告部署/运行问题；网络恢复后用原逻辑请求重试 |

HTTP 中断或超时不能据此认定上传/发布失败：上传与拉取使用原 `request_id` 重试，确认使用原清单重试，获取服务器最终结果。平台可能独立返回网关限流或超时，采用退避重试；不要高频轮询。

## 小程序如何获得新资料

小程序启动先使用随包 JS 或本地完整缓存，向自有 Supabase `aw-catalog` 请求 manifest。存在从当前版本到目标版本的一跳 patch 时下载、合并、校验；否则下载 full。校验后写非当前缓存槽、回读校验，最后切换指针；正在编辑玩家数据时延迟激活。离线或服务故障继续使用已有完整资料。

它不访问 Git JS，不携带维护 KEY，不查询维护队列或改正式资料。数据库结构内的新车/新关系/新弹药是数据发布，通常不需要微信重审；客户端无法表达的新机制需要代码升级。更新诊断与微信测试见 [线上资料更新](catalog-updates.md) 和 [小程序测试说明](miniprogram-v1-testing.md)。

AI 完成后报告：正式 revision/version、读取方式、实际证据、变更摘要、request_id/change_id/review_id、服务器返回的发布 version/hash 或拒绝原因，以及真实执行的验证。不得宣称未执行的部署或微信上传成功。
