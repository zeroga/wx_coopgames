# AW 完整本地资料与增量网络更新

代码测试版：`2026.10.06.2`。本次准备的资料版：`aw-2026.10.06.1-e8874cd8a93d`；提交生成物不代表已经部署线上函数或上传微信体验版。原始事实仍为同一批 298 辆车，本次不采集或改变真实车辆资料。

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
- 同一发行的 `publishedAt`、`sourceCheckedAt` 及 descriptor 冻结；原样重新部署可以复用版本，修改发行元数据须新版本。部署确认时间单独记录。`publishedAt` 不参与 payload SHA，但参与 descriptor 绑定。
- `schemaVersion` 控制完整结构解析，`patchFormat` 控制补丁协议，`encoding` 控制规范重建。客户端只用支持的编码/patchFormat 做增量；不支持时记录原因并尝试可解析的 full。改变规范编码/增量语义必须更新相应编码及 patchFormat，结构变化另升 schemaVersion，不能单靠结果 hash 发现不兼容。旧 manifest 无 encoding 的基线可按原始 full 解码；当前增量目标必须为 `stable-key-v1`。
- 合法展示值缺少专门颜色/译名时显示原值或默认样式，不隐藏整辆车。Token 目前只解释已支持的 `dealer_token` + `>=` 机制，未知记账机制明确拒绝并要求客户端能力升级，不能猜测。

## 历史本地发行的完整基准与可独立重建

Git 保存不可变 `data/aw/releases/<精确资料 version>/full.json`，文件内包含 manifest、完整原始 payload 和 hash。每次 build release 保存 from 和 to，目标目录同时保存 `patch.json`。已经存在的 full 内容若有差异立即拒绝，不覆盖。旧基准不从正式数据库当前状态反推，不依赖聊天附件或 AI 上下文。

本次补存上一份已审查基准 `aw-2026.10.04.5-0541184c1191` 并准备新基准 `aw-2026.10.06.1-e8874cd8a93d`。新旧语义事实完全一致，106 字节 patch 仅将旧编码重建成规范编码；实际新车测试使用测试目录中的合成数据，不进入正式包。

归档记录生成且待发布的版本，不自动宣称已上线。`data/aw/deployed.json` 按环境保存已确认部署记录：module、version/hash/sequence、full 路径、Git commit、确认时间和接口地址。初始 production/staging 均为 null，不猜测历史部署。正式 `--from` 必须与该记录及归档完整内容一致；不静默选“最新归档”。无记录时先验证实际线上基线。本地候选可显式 `--draft <原因>`，该标记不产生上线记录，也不能代替部署验收。

C 发布者用以下只读验证命令核对线上 manifest/full/每个 patch，再重复读取 manifest 确认期间未换版；全通过后才原子写本地部署记录并提交，且在 PR Conversation 追加实际结果：

```bash
node tools/verify_aw_catalog_deployment.js --environment production \
  --release supabase/functions/aw-catalog/release.json \
  --full data/aw/releases/<实际 version>/full.json --git-commit <完整 commit>
```

首次核验旧版应提供与其线上内容对应的历史发行文件，不能拿待部署新包充当线上证据。另一个环境显式提供 `--url` 和 `--apikey-env`；脚本不会部署、写数据库或自动选择环境。本次未运行线上确认、未部署，记录保持 null。

## 新维护接口与发布流程

本版改为 Supabase 正式事实 → 上传变更 → 拉取固定审核清单 → AI 确认 → 服务器从数据库生成 full/patch → 事务保存发行并切换指针 → 小程序检查/更新。其他 AI 使用 [接口说明](catalog-maintenance-api.md)，管理员执行 [KEY 与部署说明](catalog-maintenance-admin.md)。上传和拉取不修改正式资料；确认仅处理已拉取的 ID 与内容摘要，迟到上传留到下一轮。

事实、证据/分类、互斥武器关系及完整发行存数据库。`catalog_snapshot.json` 的长期维护暂缓，旧 ZIP 与历史生成器用于一次性初始化和复现，今后线上维护不要求解压/修改/重打 ZIP。Git 的 `catalog.js` / release 文件是历史/随包生成物，不是 AI 判断线上事实的依据，也不是小程序的联网来源。

确认服务沿用客户端同源协议，先试写并回滚取得真实默认值/时间戳/计算字段，再生成、校验并持久化实际 full/patch；正式写入与发布指针在一个事务内完成，失败全部回滚。历史发行不可改。公共服务直接从数据库 current_version 读取，数据发布无需重新部署 Edge Function。旧本地 CLI 和 deployed.json 只用于历史独立重建/只读上线核验，不作为新维护接口的发布授权或数据库当前版本来源。

## 本地更新诊断

`catalog-update.info().lastUpdate` 提供最近一次检查的 base/targetVersion、mode、attemptedPatch、reasonCode、fallbackReason、state、起止时间和错误。诊断只在公共资料专用键保存一个有界记录，写入失败不影响更新，不访问私有存档、不增加服务端上报或普通用户界面的技术信息。

`state` 区分 unchanged、staged、activated、failed。编辑器打开时仅 staged；关闭后成功提交才 activated，提交失败记录 failed，不能把“下载完成”当作生效。原因包括 no_direct_patch、patch_base_mismatch、patch_format_unsupported、patch_encoding_unsupported、patch_descriptor_invalid、cache_invalid、patch_failed；全量/缓存失败另记录最终 error。重启可查最近结果，不保存可重放 patch 链。

没有直接 patch 或老客户端走 full 是正常兼容路径，不可仅凭“所有刷新中的 patch 比例为零”判定故障。若以后增加总体指标，应以适用/实际尝试的 patch 为分母，并单独统计失败原因；本次仅做本地诊断。

## 公共服务与部署

`supabase/functions/aw-catalog/index.ts` 保留原 GET 路径和响应契约，改用 anon 调用只读数据库 RPC：无参数读 manifest；`?bundle=1&version=<version>` 读当前 full；`?patch=1&baseVersion=<base>&version=<target>` 读当前发行的一跳 patch。version 绑定失败返回 409，缺少一跳 patch 返回 404，数据库不可用返回 503，客户端继续用原完整资料。该 handler 不携带维护 KEY、不使用 service role。

保留 publishable `apikey` 验证和 `verify_jwt=false`，不发送 publishable Bearer token；域名仍使用原 Supabase 地址。维护接口是独立函数，需要任务 KEY。部署按新迁移 → 审查并执行初始化 → 公共函数 → 维护函数 → 验证的顺序操作，详见 [管理员说明](catalog-maintenance-admin.md)。

本次交付代码测试版 `2026.10.06.2`，上传可用 `0.1.0-test.20261006.2`。客户端带有完整离线基线与更新诊断，首次上传后，现有 schema 的新车/新关系只需数据库资料发布。PR 提交不等于微信已上传、Supabase 已部署或正式数据已改。
