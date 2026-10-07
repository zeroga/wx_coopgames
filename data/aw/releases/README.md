# AW 不可变完整发行基准

每个资料版本保留 `<version>/full.json`，内含 manifest、完整 payload 与 SHA-256。目标目录还保留 `patch.json`。用版本号和完整 hash 核对，不从实时数据库或聊天附件反推。工具遇到已存在且不同的 full 即拒绝覆盖。

| 资料版本 | 完整 payload SHA-256 | 保存依据 / 状态 |
| --- | --- | --- |
| aw-2026.10.04.5-0541184c1191 | 0541184c1191b28953dd379102f29e4ab6cc6a97f4b43c31904d3a88b181927e | 从 PR #8 原 head `269d6b9fc0a53296acef94adbebaf33747ef572b` 的 release.json 原样补存；既有审查发行基准，线上状态以部署记录为准 |
| aw-2026.10.06.1-e8874cd8a93d | e8874cd8a93d6edf3193bb0a7efd0f28c05314532a8f1fe7a72582d79fa25b15 | 本次生成、待部署；事实仍为原298辆车，规范编码后 hash 改变 |

生成基准并不表示发布成功。发布者在 PR Conversation 追加线上 version/hash、部署时间与基准 Git commit；下一次生成必须以该记录确认的正式版本作为 `--from`。发布后不修改本版本内容；任何事实变更都生成更高资料版本。

机器可读部署证据保存于 `../deployed.json`，按环境确认，不自动以最新归档填充。正式生成器校验 `--from` 与该记录及完整归档一致；本地草稿显式用 `--draft <原因>`。旧版本只能取此处原始 full，不能由当前数据库反推。本版新增数据库维护接口后，新发行真源与完整基准在 Supabase release 表；此 ledger 及本目录保留历史 CLI 复现用途，不代表新接口的当前指针。

完整协议、生成命令、人工/其他 AI 交接与发布步骤见 [catalog-updates.md](../../../docs/aw/catalog-updates.md)。
