# AW 完整本地资料与增量网络更新

代码测试版：`2026.10.06.1`。本次准备的资料版：`aw-2026.10.06.1-e8874cd8a93d`；提交生成物不代表已经部署线上函数或上传微信体验版。原始事实仍为同一批 298 辆车，本次不采集或改变真实车辆资料。

**AW 后续新增车辆、武器、弹药、科技树和获取关系，在现有 schema 可表达的情况下，都应通过资料版本发布，无需重新审核小程序。**只有当前 schema / 通用界面不能表达的新结构、复杂关系或业务机制才要求客户端升级；车辆 ID 是否出现在旧源码中不构成升级理由。

## 从全量下载改为增量合并

原流程：读取随包/缓存完整 catalog → 获取 manifest → 每次下载完整 bundle → 校验 → 缓存切换。

新流程：读取本地完整 catalog → 获取 manifest → 选择当前版本到目标版本的一个直接 patch → 校验 patch → 在内存副本中按稳定键合并 → 确定性编码为完整 catalog → 校验 `resultSha256`、结构、数量、主键、唯一键及全部单列/复合外键 → 写入非当前槽 → 回读校验 → 最后提交当前槽指针。

运行时只读取已经合并的完整 catalog。两个槽位均保存完整结果，不保存供运行时叠加的 patch 链；重启只校验并读取当前完整槽位。按 64,000 字符分块，写入中断/配额不足/静默损坏均不提交指针。编辑层打开时只构建并校验候选槽，关闭最后一个编辑层后才提交指针和内存版本，避免草稿期间出现部分换版。

自动检查保持原有 15 分钟间隔和重复请求合并。资料更新只访问公共 GET 接口，不访问/写入 AW-M、AW-T、玩家计划、自定义前置、Token 记录、职责、备注或存档 RPC。资料换版仅触发已有的内存衍生关系重算；新增车辆没有旧存档记录时自然视为尚未登记。

## 完整包、manifest 与 patch 格式

完整 bundle 保留 `{manifest, payload}`；`payload` 是 JSON 字符串，内容仍只有 `{catalog, ammoEvidence, presentation}`。`catalog` 仍为列数组与字符串字典。新发布编码 `stable-key-v1` 对对象键、表、稳定主键和字符串字典排序；嵌套 JSON 对象排序，数组保留语义顺序。`sha256` 对最终 UTF-8 payload 的准确字节计算，客户端与生成端使用同一实现。旧正式完整包原始字节及旧 hash 不重写。

manifest 示例（hash/counts 缩写仅用于说明）：

```json
{
  "schemaVersion": 1,
  "module": "aw",
  "encoding": "stable-key-v1",
  "version": "aw-2026.10.06.1-e8874cd8a93d",
  "sequence": 202610060001,
  "publishedAt": "2026-10-06T08:30:00Z",
  "sourceCheckedAt": "2026-10-01T15:44:08.40133+00:00",
  "sha256": "<完整 payload SHA-256>",
  "counts": { "vehicles": 298, "<其余全部公共表>": 0 },
  "patches": [{
    "schemaVersion": 1, "module": "aw", "patchFormat": 1,
    "baseVersion": "aw-2026.10.04.5-0541184c1191",
    "baseSha256": "<旧完整 payload SHA-256>",
    "targetVersion": "aw-2026.10.06.1-e8874cd8a93d",
    "publishedAt": "2026-10-06T08:30:00Z",
    "sourceCheckedAt": "2026-10-01T15:44:08.40133+00:00",
    "patchSha256": "<patch payload SHA-256>",
    "resultSha256": "<与 manifest.sha256 相同>"
  }]
}
```

patch envelope：`{descriptor, payload}`。descriptor 与 manifest 中对应项完全一致；patch payload 是确定性 JSON 字符串，例如：

```json
{
  "generator": "stable-key-diff-v1",
  "checkedAt": "2026-10-01T15:44:08.40133+00:00",
  "upserts": { "vehicles": [{ "id": "<稳定 ID>", "<全部表字段>": null }] },
  "deletes": { "ammo_trait_links": [["<ammo_id>", "<trait_code>"]] }
}
```

upsert 为解码后的完整记录，允许新增实体、修改实体、增加/修改关系。delete 为主键字段顺序的元组，单键也是单元素数组；不使用数组位置或字符串索引定位。键由 `data/aw/schema_data_contract.json` 的公共表主键生成到 `miniprogram/data/aw/schema.js`，覆盖无 `id` 的 `code` 表和复合键关系。这里使用客户端传输 schema 的字段类型、必填、主键、唯一键与引用约束；展示分类值保留字符串并允许通用显示，Tier 不依赖固定 UI 数量。不会修改或放宽正式数据库的枚举/range CHECK，数据库导入仍需遵守原契约；合成测试的未来分类/Tier 仅验证客户端能力，不作为数据库可导入事实。所有当前 26 张公共表均支持，原本空的穿深样本、ERA 覆盖、配件前置表也可直接增行。

证据或互斥武器关系发生变化时，payload 额外携带相应完整 `ammoEvidence` / `presentation` 小节；没有变化则省略。它们参与最终完整 hash 校验。日常维护不手写 upsert/delete。特殊人工 patch 只能使用 `generator: "manual"`，必须提供非空 `reason`，使用同一校验命令验证精确目标字节，并在发布记录解释原因。

## fallback 与兼容

- 首次运行具有完整随包基线；其版本/hash 精确匹配可用 patch 时可增量更新。缺少适用基线/直接 patch、旧版本跨越多个发行版本、patch 404/409/下载失败、patch hash/合并/result hash 校验失败时，下载最新完整包。最多一个 patch 加一个 full，不遍历历史版本链。
- 当前缓存损坏时先恢复随包完整资料，再强制线上 full 恢复；即使线上版本等于随包版本也重新验证/缓存 full。
- 目标 `schemaVersion` 不支持时不应用 patch 或 full，保留可用旧目录并提示升级。支持的目标 schema 与本地缓存不兼容时使用随包基线并走 full；全量不能让旧客户端理解新结构。
- full 下载或完整校验失败、槽位写入/回读失败、最后指针提交失败，保留当前旧完整目录。在线换版导致 version 不一致时保留旧版，下次刷新重新获取 manifest。
- 发布序号必须递增；旧序号不会覆盖新缓存；同序号不同 version 拒绝。发布时间与来源核对时间独立，不能把新发行解释成重新实测所有字段。
- 合法展示值缺少专门颜色/译名时显示原值或默认样式，不隐藏整辆车。Token 目前只解释已支持的 `dealer_token` + `>=` 机制，未知记账机制明确拒绝并要求客户端能力升级，不能猜测。

## 正式完整基准与可独立重建

Git 保存不可变 `data/aw/releases/<精确资料 version>/full.json`，文件内包含 manifest、完整原始 payload 和 hash。每次 build release 保存 from 和 to，目标目录同时保存 `patch.json`。已经存在的 full 内容若有差异立即拒绝，不覆盖。旧基准不从正式数据库当前状态反推，不依赖聊天附件或 AI 上下文。

本次补存上一份已审查基准 `aw-2026.10.04.5-0541184c1191` 并准备新基准 `aw-2026.10.06.1-e8874cd8a93d`。新旧语义事实完全一致，106 字节 patch 仅将旧编码重建成规范编码；实际新车测试使用测试目录中的合成数据，不进入正式包。

归档记录生成且待发布的版本，不自动宣称已上线。C 发布者必须在 PR Conversation 追加部署结果、实际 version/hash、部署时间与基准 Git commit。下一次 `--from` 必须取该线上已确认正式版本的 full，不能把未部署草稿当成正式上一版。此任务未部署，两份基准的上线状态仍由已有/后续部署记录确认。

## A / B / C 交接与操作

**数据源维护、增量包生成和资料发布是三个可以由不同主体完成的步骤。**A 可为人工、ChatGPT、Codex 或采集工具；B 可为另一个 AI、人工或 CI；C 可为发布人员或工具。“自动生成”指差异由工具计算，不要求执行动作自动化。

A 维护源数据与证据，允许只改一辆车或一个关系，保持现有 ID。需改变基础源时解出 `AW_catalog_manual_data.zip` 中 `source/catalog_snapshot.json`，编辑工作副本并用原有工具重建 ZIP。截图覆盖层与弹头证据仍分开维护。然后：

```bash
python tools/build_aw_miniprogram_catalog.py
node tools/build_aw_catalog_schema.js
node tools/build_aw_catalog_package.js full \
  --version 2026.10.08.1 --published-at 2026-10-08T00:00:00Z \
  --output work/new-full.json
```

A 给 B：上游 Git commit、变更实体/关系及稳定 ID、来源及核对时间、未核实项、目标完整文件/version/hash、现有 schemaVersion，以及 C 确认的上一正式完整文件/version/hash。

B 人工执行：

```bash
node tools/build_aw_catalog_package.js patch \
  --from data/aw/releases/<上一正式 version>/full.json \
  --to work/new-full.json --output work/new-patch.json
node tools/build_aw_catalog_package.js validate \
  --from data/aw/releases/<上一正式 version>/full.json \
  --to work/new-full.json --patch work/new-patch.json
node tools/build_aw_catalog_release.js 2026.10.08.1 2026-10-08T00:00:00Z \
  --from data/aw/releases/<上一正式 version>/full.json --to work/new-full.json
node --test tests/aw-*.test.js
python tools/check_aw_miniprogram.py
```

另一个 AI 独立执行相同步骤：先阅读本文件及项目维护规范，从 Git 取得精确 old/new 完整包，核对 version/hash，再运行 patch / validate / release；不需要上一个 AI 的聊天记录，也不手工推断差异。全量初次发布或有理由的能力/schema 切换可显式用 `--full-only <原因>`，日常发行必须有 `--from`。

release 命令机器验证 patch 应用结果与 new full **逐字节一致**，同时生成线上 `release.json`、客户端基线元数据、历史 full 和 patch。默认不会访问网络或数据库；可用 `--output <临时 release.json> --archive <临时目录>`做隔离预检，不更新随包 release.js。

B 给 C：old/new 精确 version/hash、schemaVersion、基准 Git commit、full/patch/manifest 路径、命令、校验/测试结果、实体与关系增删改摘要、人工 patch 原因（若有）。C 审查后把同一个 release 的 manifest + patch + full 一起部署，线上验证后追加发布记录；不能只替换 manifest。

## 公共服务与部署

`supabase/functions/aw-catalog/` 仍为只读 Edge Function：

- `GET /functions/v1/aw-catalog`：latest manifest。
- `GET ?bundle=1&version=<目标 version>`：最新 `{manifest,payload}` full，不夹带 patch。
- `GET ?patch=1&baseVersion=<当前 version>&version=<目标 version>`：直接 patch envelope；没有该基准返回 404，目标不再是当前发行版返回 409。

保留 publishable `apikey` 验证、GET/OPTIONS、`verify_jwt=false`，不发送 publishable Bearer token，不使用 service role、不连接数据库。合法 request 域名沿用现有 Supabase 域名。部署后须检查 manifest/full/patch hash 与错误路径。

本次修改了客户端更新代码和通用数据展示，需要重新编译、上传一次微信体验版才能验证新机制；建议代码版本 `0.1.0-test.20261006.1`。采用新机制以后，现有 schema 的新车/新关系只需发布资料和刷新，无需再次上传或审核小程序。本次未上传、未部署，不修改数据库结构或正式数据。
