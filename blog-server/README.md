# blog-server

个人博客后端：**Go 1.27 + Gin + GORM + MySQL 8**。

当前形态是「管理员内容后台 + GitHub 评论身份」：管理员只负责内容管理；
读者只能通过 GitHub 授权参与文章评论与表情互动。文章按 **1 个主标签 + 多个
自由子标签**归类，普通用户密码登录、通知与 AI 对话不再提供。

## 功能范围

| 模块 | 说明 |
| --- | --- |
| 认证 | `POST /api/auth/login` 仅查 `admins` 表；`GET /api/auth/me`；JWT HS256，7 天 |
| GitHub 互动 | OAuth 登录后可单层评论、删除自己的评论、每篇文章选择一个表情；管理员可删除任意评论 |
| 文章 | 列表（分页 / 主标签筛选 / 搜索）、详情、创建、更新、删除（管理员） |
| 主标签 | 列表（含文章数）、创建、改名、删除（仍被文章引用时 409） |
| 子标签 | 文章内的自由字符串数组：自动 trim、去空、去重，不建表、不单独管理 |
| 站点内容 | `site-content/{key}` 六块 JSON：education/skills/resumeProjects/evaluation/homeProjects/plan |
| 上传 | 单图 ≤5MB，JPEG/PNG/WebP/GIF 魔数校验，落盘 `UPLOAD_DIR`，URL `/uploads/<file>` |
| 按需刷新 | 文章 / 标签 / 站点内容变更后请求 Next.js `/api/revalidate`（失败只记日志） |

已删除、且**不应重新出现**的接口（均返回 404）：`auth/register`、`articles/:id/like`、
`comments/:id/replies`、`notifications/*`、`users/*`、`ai/*`。

## 目录

```
cmd/server/           入口（HTTP / migrate / seed-admin）
internal/
  config/             环境变量、.env 加载与校验
  database/           GORM 连接与建库
  model/              显式映射：admins / articles / tags / site_contents
  httpx/              响应信封 {code,msg,data}、错误类型、ISO 时间
  auth/               JWT 签发与解析
  middleware/         鉴权（仅 admin）、限流、CORS、JSON body 校验、panic 恢复
  service/            业务逻辑（auth/article/tag/sitecontent/markdown/revalidate）
  server/             路由装配与 handler
  migrate/            版本化 SQL 迁移执行器
migrations/           嵌入式 SQL：0000 旧库基线、0001 博客改造 + 核对表
tests/fixtures/       旧版数据快照（迁移演练 / 冒烟用）
tests/smoke/          前端联调冒烟脚本
deploy/               systemd unit 示例与发布清单
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | `development` | 运行环境标识 |
| `PORT` | `4000` | HTTP 端口 |
| `MYSQL_HOST` / `MYSQL_PORT` | `127.0.0.1` / `3306` | 数据库地址 |
| `MYSQL_USER` / `MYSQL_PASSWORD` | `root` / `1234` | 数据库账号 |
| `MYSQL_DATABASE` | `jianli` | 库名 |
| `JWT_SECRET` | 必填，≥16 字符 | 签发密钥；改动会使旧登录态失效 |
| `JWT_EXPIRES_IN` | `7d` | 支持 `7d` / `12h` / `30m` |
| `CORS_ORIGIN` | `http://localhost:3000` | 逗号分割白名单 |
| `UPLOAD_DIR` | `uploads` | 上传落盘目录 |
| `UPLOAD_MAX_SIZE` | `5242880` | 单文件上限（字节） |
| `ADMIN_INITIAL_PASSWORD` | 空 | `seed-admin` 子命令使用的管理员密码（≥8 位） |
| `NEXT_REVALIDATE_URL` | 空 | Next 站点地址；缺省则跳过按需刷新 |
| `REVALIDATE_SECRET` | 空 | 与 Next 共享的刷新密钥 |
| `GITHUB_OAUTH_CLIENT_ID` | 空 | GitHub OAuth App Client ID；评论登录启用时必填 |
| `GITHUB_OAUTH_CLIENT_SECRET` | 空 | GitHub OAuth App Client secret；评论登录启用时必填 |
| `GITHUB_OAUTH_REDIRECT_URL` | 空 | GitHub 回调绝对地址，如 `https://example.com/api/auth/github/callback` |
| `COMMENT_SESSION_SECRET` | 空 | 评论会话签名密钥，≥16 字符；评论登录启用时必填 |
| `COMMENT_SESSION_EXPIRES_IN` | `30d` | GitHub 评论会话有效期 |

`.env` 查找顺序：`ENV_FILE` → 当前目录 `.env` → 可执行文件所在模块根目录 `.env`。
真实环境变量优先，不会被 `.env` 覆盖。

## 启动

```bash
cp .env.example .env      # 填写数据库与 JWT_SECRET
./scripts/dev.sh          # 编译到 bin/ 后启动，参数透传
# 或
go run ./cmd/server
```

子命令：

```bash
./bin/server.exe migrate     # 应用 migrations/*.sql
./bin/server.exe seed-admin  # 创建/重置管理员，用户名取 ADMIN_USERNAME（默认 admin）
```

## 数据库迁移

- `0000_legacy_schema.sql`：旧库基线；在已有库上只登记、不执行，避免误 DROP。
- `0001_blog_redesign.sql`：新增 `primaryTagId` / `subTags`，旧 `tags[0]` 迁为主标签、
  余项迁为子标签（自动补建同名主标签，空标签归「未分类」），删除旧列与
  `users/comments/notifications/ai_configs`。
- `0005_github_comments.sql`：新增 GitHub 评论者、单层评论和单选文章表情表；文章删除时级联清理互动数据。
- 执行前先备份并核对 `migrations/0001_blog_redesign_checklist.md`；生产禁止 AutoMigrate。
- 回滚：`mysql <db> < backups/<timestamp>-pre-redesign.sql`（备份已在 `.gitignore`）。

## 测试

```bash
# 单元测试 + 集成测试（集成测试会重建 blog_redesign_test，需要本机 MySQL）
go test ./...

# gofmt / vet / test / build 一键检查
bash scripts/check.sh

# 前端联调冒烟（需要 MySQL 与 Next dev；沙箱下 Next dev 需完整权限）
bash tests/smoke/frontend.sh
```

集成测试覆盖：管理员登录、已删除路由 404、主标签 CRUD 与引用保护、
文章单主标签校验、子标签去重、按主标签筛选、站点内容读取。
`tests/smoke/frontend.sh` 用旧版快照重建临时库、跑 `0001` 迁移，再验证
首页 / 博客 / 规划 / 简历 / 关于 / 管理员登录页与代理接口。

## 部署

系统要求：Linux + MySQL 8 + systemd。示例 unit 见
[`deploy/systemd/blog-server.service`](./deploy/systemd/blog-server.service)，
发布与回滚步骤见 [`deploy/RELEASE_CHECKLIST.md`](./deploy/RELEASE_CHECKLIST.md)。
构建：

```bash
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o bin/server ./cmd/server
```

生产环境变量放在 `shared/backend.env`，由 systemd `EnvironmentFile` 注入；
上传目录指向 `shared/uploads`，由 Nginx/Next 继续以 `/uploads` 提供。
