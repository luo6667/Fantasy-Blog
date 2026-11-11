# 仓库瘦身与代码审查报告

> 依据 `CODEBASE_SIMPLIFICATION_TASK_BOOK.md` 完成。全部改动在 `main` 分支，按任务独立提交。
> 验证环境：Windows + MSYS，MySQL 8.0（`blog_smoke` 副本库），Node 24 / Next 16.3.2，Go 1.27。

## 总览

| 任务 | 内容 | 提交 | 结果 |
| --- | --- | --- | --- |
| 1 | 站点内容保存后按 key 触发 Next revalidate | `68744185` | 已修复，含映射单测 |
| 2 | 登录移除 `role`，后端严格拒绝未知字段 | `86ad31bd` | 已修复，含集成测试 |
| 3 | 标签映射审批工具链 + 子标签去重 + 0002 补救 | 本文件同批 | 已实现，含迁移测试 |
| 4 | 后台页面 metadata 与 noindex | `939cec01` | 已补齐 |
| 5 | 删除无引用组件与默认导出 | `463c5ad8` | 已删除并验证无引用 |
| 6 | 部署脚本改为 Go/systemd + Next/PM2 | `d9cd6981` | 已更新 |
| 7 | 停止跟踪 `.idea/` 与备份 SQL | `431d486d` | 已取消跟踪 |

## 任务 1：站点内容保存后刷新公开页

**问题**：`UpdateSiteContent` 只写库，不通知 Next，ISR 页面最长 1 小时看不到更新。

**修复**：`internal/service/sitecontent.go` 新增 `SiteContentRevalidatePaths(key)`：

| key | 刷新路径 |
| --- | --- |
| `plan` | `/plan` |
| `education` / `skills` / `resumeProjects` / `evaluation` | `/resume` |
| `homeProjects` | `/home` |

保存成功后异步 `triggerRevalidate(paths)`；失败只记 warn，不回滚数据库。单测覆盖逐 key 映射、每个合法 key 都有路径、不同页面互不串扰。

## 任务 2：登录契约与严格 JSON

**问题**：前端登录仍发送 `role: 'admin'`，后端静默忽略未知字段，契约漂移无法被发现。

**修复**：

- `blog-fronted/src/lib/api.ts` 登录 body 只发 `{ username, password }`。
- `internal/httpx/httpx.go` 的 `DecodeJSON` 全局启用 `DisallowUnknownFields()`，未知字段返回 400 `请求体包含未知字段：<field>`。
- 集成测试：登录携带 `role`（user/admin）或任意未知字段均 400；正常登录、`/api/auth/me` 可用；`/api/auth/register` 仍 404。

## 任务 3：标签迁移可审批、可修正

**问题**：旧 `tags` 数组转主/子标签时未去重；核对表只存在于本地文档，无法证明生产执行前被人工批准。

**修复**：

1. `migrations/0001_blog_redesign.sql`：子标签回填时 trim、去空、按首次出现顺序去重；`tmp_tag_map` 支持审批结果优先（`INSERT IGNORE`）。
2. 新增 `migrations/0002_normalize_subtags.sql`：对已执行 0001 的库做幂等归一化（含重复/空白子标签），可重复执行。
3. 新增审批工具链（`internal/migrate/tagmap.go` + `cmd/server` 子命令）：

```bash
migrate-tags export --out tagmap.json     # 导出逐篇映射 + sourceDigest
migrate-tags verify --file tagmap.json    # 覆盖/一致性/审批字段校验
migrate-tags apply  --file tagmap.json --approve-by <审批人>
migrate                       # 审批记录存在且摘要一致才执行 0001
```

审批记录写入 `migration_approvals`（version / approvedBy / approvedAt / sourceDigest / checksum）。旧 `tags` 列存在且文章数 > 0 时，缺少审批记录或摘要不一致会拒绝迁移。

**测试**：`TestTagMapApprovalGate`（未审批拒绝 → 导出 → 审批 → 应用 → 迁移 → 子标签去重）、`TestNormalizeSubtagsMigrationIsIdempotent`（脏数据归一且二次执行无变化）。

## 任务 4：后台 metadata

`/admin`、`/admin/articles`、`/admin/plan`、`/admin/resume`、`/admin/new`、`/admin/edit/[id]` 均补齐 `metadata`（标题 + `robots: { index: false, follow: false }`）。new/edit 改为服务端页面渲染客户端编辑器，避免整页 `'use client'` 导致 metadata 丢失。

## 任务 5：删除死代码

经 `rg` 确认无运行时引用后删除：

- `components/common/ErrorBoundary/`（路由错误由 `app/error.tsx` 处理）
- `components/common/PageSuspense/`（无使用方）
- `views/admin/content/index.tsx` 中未使用的默认 `SiteContentManager` 导出（`PlanContentManager` / `ResumeContentManager` 保留）

## 任务 6：部署链改为 Go + systemd

- `deploy/deploy.sh`：后端 `go build` → `systemctl restart <unit>`；无 Go 工具链时要求预编译 `bin/server`；状态检查用 `systemctl is-active`；PM2 只管理 `blog-web`。
- `deploy/ecosystem.config.cjs` 仅保留 `blog-web`，注释说明后端由 systemd 管理。
- `.github/workflows/deploy.yml` 使用 `setup-go` 执行 gofmt/vet/test/build，不再安装后端 npm 依赖。
- `DEPLOYMENT.md` 更新 Go 编译、`migrate`、`seed-admin`、systemd 单元与验收步骤。

## 任务 7：Git 卫生

- 备份 SQL 移至仓库外：`E:\qdzl\personal\zhuye\Personal Page-backups\2026-11-10-pre-redesign.sql`（126,214 字节）。
- `git rm --cached` 停止跟踪 `.idea/` 与 `blog-server/backups/2026-11-10-pre-redesign.sql`；`.gitignore` 增加 `blog-server/backups/`。
- **历史未重写**：`.idea` 与备份仍存在于旧提交中。需要彻底清除时由管理员执行（不可逆，需协调所有协作者）：

```bash
git filter-repo --path .idea --invert-paths
git filter-repo --path blog-server/backups/2026-11-10-pre-redesign.sql --invert-paths
git remote add origin <url>            # filter-repo 会移除 remote
git push --force-with-lease origin main
```

密钥轮换清单：若备份曾被推送到公共远端，视同泄露——轮换 MySQL 账号、`JWT_SECRET`、`REVALIDATE_SECRET`，并重置管理员密码（`./bin/server seed-admin`）。

## 验证结果

| 项 | 命令 | 结果 |
| --- | --- | --- |
| Go 格式 | `gofmt -l cmd internal migrations` | 无输出 |
| Go 静态检查 | `go vet ./...` | 通过 |
| Go 测试 | `go test ./...` | 全部通过（auth/config/migrate/server/service） |
| 前端类型 | `npx tsc --noEmit` | 通过 |
| 前端 lint | `npx eslint .` | 通过 |
| 前端构建 | `npm run build` | 通过（带后端运行，`/blog` 预渲染 12 篇） |
| 前端冒烟 | `bash blog-server/tests/smoke/frontend.sh` | 通过（6 页面 + 代理接口 + 已删路由 404） |

`tests/smoke/frontend.sh` 已适配审批门禁：fixture 导入后自动 `migrate-tags export`，以 `smoke-fixture` 作为审批人 `apply`，再执行 `migrate`；当开发目录已有 `next dev` 时自动复制临时前端目录并用 junction 复用 `node_modules`。

## 未做与理由

- **不重写 Git 历史**：影响所有协作者且不可逆，按决策交由管理员执行（命令见上）。
- **不引入新依赖/状态库**：任务书范围外。
- **不删除性能测量脚本与 CursorGlow/TiltCard 等**：仍在使用或用于回归。
- 生产迁移未执行：标签审批文件需站长按核对表确认后生成。
