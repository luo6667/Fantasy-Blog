# 发布与回滚清单（Go 后端）

> 适用于「Next.js + Go 后端」的 Linux 单机部署。
> 迁移 SQL 与数据核对见 `migrations/0001_blog_redesign_checklist.md`。

## 0. 发布前

- [ ] 目标提交在 `feat/blog-redesign`（或已合并的 main），CI/本地 `bash scripts/check.sh` 通过。
- [ ] 生产库全量备份并验证恢复：
      `mysqldump --single-transaction --routines --triggers --add-drop-table <db> > backup-$(date +%s).sql`
- [ ] 在生产**副本**上执行 `migrate-tags export` → 人工核对并填写 `approvedBy/approvedAt` → `migrate-tags verify` → `migrate-tags apply`，再执行 `./bin/server migrate`。
- [ ] 导出迁移后的标签/文章核对表并确认。
- [ ] 确认 `shared/backend.env`：`MYSQL_*`、`JWT_SECRET`、`UPLOAD_DIR`、`NEXT_REVALIDATE_URL`、`REVALIDATE_SECRET`。
- [ ] 维护窗口内暂停写入；记录当前版本目录（用于回滚）。

## 1. 构建与上传

```bash
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o bin/server ./cmd/server
# 上传到 releases/<UTC时间戳>-<sha7>/blog-server/
```

前端仍由 `next build` 产物提供；`/api` 与 `/uploads` 由 Next rewrites 转到 Go（:4000）。

## 2. 切换

- [ ] 备份并迁移生产库（仅在核对表确认后执行）：`migrate-tags apply --file tagmap.json` → `./bin/server migrate`；禁止 AutoMigrate。
- [ ] 切换 `current` 软链到新 release。
- [ ] `systemctl restart blog-server`（首次：`systemctl enable --now blog-server`）。
- [ ] `curl -fsS http://127.0.0.1:4000/api/health` 返回 `status: up`。

## 3. 验收（逐项勾选）

- [ ] 管理员登录 `/admin/login`，`/api/auth/me` 返回 `role: admin`。
- [ ] 首页 / 博客 / 规划 / 简历 / 关于 正常渲染；博客卡片显示主标签 + 子标签。
- [ ] 博客列表按主标签筛选正常；`/api/tags` 计数与文章一致。
- [ ] 新建 / 编辑文章：主标签必选、子标签可增删并自动去重。
- [ ] 主标签改名后文章同步；删除被引用标签返回 409；删除未引用标签成功。
- [ ] 上传图片成功，`/uploads/<file>` 可访问且带 immutable 缓存头。
- [ ] 站点内容六块（含 plan）读取/保存正常，保存后 Next 页面刷新。
- [ ] 已删除接口返回 404：`/api/notifications`、`/api/comments`、`/api/users/manage`、`/api/ai/*`。
- [ ] 旧发布物仍可回滚（上一版目录 + 备份 SQL 均在）。

## 4. 回滚

1. `current` 软链切回上一版，`systemctl restart blog-server`。
2. 数据库按备份恢复；确认 `articles`、`tags`、`admins` 行数与备份一致。
3. 冒烟：`/api/health`、管理员登录、文章列表、上传。

## 5. 观察

- `journalctl -u blog-server -f`：关注迁移失败、502、revalidate 超时。
- 刷新失败不回滚已提交的数据；修复 Next 端后重试即可。
