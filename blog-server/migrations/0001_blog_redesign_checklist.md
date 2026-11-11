# 改造前备份、影响清单与标签映射核对表

> 生成时间：2026-11-10（分支 `feat/blog-redesign`）
> 范围：`jianli` 本地库 + 本仓库代码。生产库未连接、未改动。

## 1. 备份与可恢复性验证

| 项 | 结果 |
| --- | --- |
| 备份文件 | `blog-server/backups/2026-11-10-pre-redesign.sql`（123 KB，已 gitignore） |
| 导出参数 | `mysqldump --single-transaction --routines --triggers --add-drop-table` |
| 恢复校验库 | `blog_restore_check`（由备份完整导入） |
| 行数比对 | admins 1/1、users 3/3、articles 12/12、comments 4/4、tags 7/7、notifications 16/16、site_contents 6/6、ai_configs 1/1 |
| 引擎/排序规则 | 全部 InnoDB / utf8mb4_unicode_ci |

结论：备份可恢复，迁移前数据有完整回退路径。

## 2. 将被删除的对象清单

### 2.1 数据表（物理删除）

- `users`（3 行）：普通用户体系整体移除。
- `comments`（4 行）：评论、嵌套回复与评论点赞。
- `notifications`（16 行）：站内通知。
- `ai_configs`（1 行）：AI 接口配置（含加密后的 Key）。

### 2.2 `articles` 列（物理删除）

- `tags`（JSON 数组）→ 拆分为 `primaryTagId` + `subTags` 后删除。
- `likedBy`、`favoritedBy`、`likes`、`favorites` → 点赞/收藏功能移除。
- `authorType`、`authorId`、`authorName` 一并删除（只保留管理员发布，文章不再记录作者）。
- 保留：`id`、`title`、`excerpt`、`content`、`contentHtml`、`cover`、`createdAt`、`updatedAt`。

### 2.3 后端路由（移除后应 404）

- `POST /api/auth/register`
- `GET|POST /api/articles/:id/comments`
- `POST /api/articles/:id/like`
- `POST /api/comments/:id/replies`、`POST /api/comments/:id/like`、`DELETE /api/comments/:id`
- `GET /api/notifications`、`GET /api/notifications/unread-count`、`POST /api/notifications/read`
- `GET /api/users/manage`、`DELETE /api/users/:id`
- `GET|PUT /api/ai/settings`、`POST /api/ai/chat`

### 2.4 后端代码

- 模型：`User`、`Comment`、`Notification`、`AIConfig`
- 服务：`internal/service/comment.go`、`notification.go`、`user.go`、`ai.go`、`crypto.go`
- 处理器：`internal/server/handlers_comment.go`、`internal/server/handlers_ai.go`，以及 `handlers_misc.go` 中的通知/用户部分、`handlers_auth.go` 中的注册与普通用户登录、`handlers_article.go` 中的点赞
- 配置：`AI_CONFIG_ENC_KEY` 及 `App.encKey`、AI 加密相关逻辑
- 中间件：登录后的普通用户分支（`role=user` 的 token 一律拒绝）

### 2.5 前端代码（随后续任务删除）

- 组件目录：`components/ai/`、`components/comment/`、`components/notification/`、`components/auth/`（改为管理员登录后整体移除）
- 视图：`views/admin/{AiSettings,UserManager,UserPanel}.tsx`（`LoginForm` 保留并重写为管理员登录）
- hooks：`useAiStream.ts`、`useCommentQueries`、`useSocialQueries`、通知相关查询
- API 客户端：`auth.register`、`auth.login(role,…)`、`comments.*`、`notifications.*`、`users.*`、`ai.*`、`articles.like`
- 类型：`CommentItem`、`NotificationItem`、`UserManageItem`、`AiSettings`、`AiChatMessage` 等

### 2.6 环境变量与依赖

- 删除环境变量：`AI_CONFIG_ENC_KEY`（`.env.example` 同步移除）。
- 依赖：`golang.org/x/crypto` 继续用于 bcrypt；`goldmark`/`bluemonday` 继续用于 Markdown；不新增依赖。

## 3. 标签映射核对表（本地 jianli，12 篇）

规则：`tags[0]` → 主标签；其余项 → 子标签；主标签不在标签库时自动创建同名主标签；空数组归入自动创建的「未分类」。

| 文章 ID | 标题 | 旧标签 | 主标签 | 子标签 |
| --- | --- | --- | --- | --- |
| 6a6f443b33c7274e46c635f2 | 前端工程化：从 ESLint 到 CI/CD | ["工程化"] | 工程化 | — |
| 6a75e1570ad4d6c0ec98ecb4 | 什么是 HTTP 协议？一文讲清它背后的 IP、URL 与请求过程 | ["HTTP"] | HTTP | — |
| 6a75e1570ad4d6c0ec98ecb7 | 什么是 WebSocket？全双工实时通信详解（附前端代码示例） | ["HTTP"] | HTTP | — |
| 6a75e1580ad4d6c0ec98ecba | 什么是流式传输？边生成边发送的传输方式与应用场景 | ["HTTP"] | HTTP | — |
| 6a75e3f981e9a1ec314c5d4a | React 19 来了：一文读懂新一代 React 的核心新特性 | ["前端"] | 前端 | — |
| 6a75e3f981e9a1ec314c5d4d | JavaScript 核心语法与异步编程：从 ES6 到 async/await | ["前端"] | 前端 | — |
| 6a75e3f981e9a1ec314c5d50 | TypeScript 入门：用类型安全驯服 JavaScript | ["前端"] | 前端 | — |
| 6a75e3f981e9a1ec314c5d53 | 前端常用库盘点：状态、数据、动画与样式（附本项目实践） | ["前端"] | 前端 | — |
| 6a75e3fa81e9a1ec314c5d56 | Node.js 入门：JavaScript 的服务端运行时 | ["后端"] | 后端 | — |
| 6a75e3fa81e9a1ec314c5d59 | Express 入门：中间件与路由驱动的 Web 框架 | ["后端"] | 后端 | — |
| 6a75e3fa81e9a1ec314c5d5c | MongoDB 入门：文档型数据库与 Mongoose 实践 | ["数据库"] | 数据库 | — |
| 6a75e3fa81e9a1ec314c5d5f | MySQL 入门：关系型数据库的核心概念与常用 SQL | ["数据库"] | 数据库 | — |

- 主标签集合：工程化、HTTP、前端、后端、数据库（5 个；标签库中 `CI/CD`、`AIAgent` 未被任何文章使用，保留为可选主标签）。
- 本地没有多标签、空标签或缺失标签的情况；生产库需按同一规则重新生成核对表后再执行。

## 4. 生产执行前置

1. 在生产副本上运行迁移，输出生产版核对表并交由站长确认。
2. 全量备份并验证恢复（同第 1 节流程）。
3. 维护窗口内执行迁移；出现管理员无法登录或文章不可访问时从备份恢复。
4. 禁止 `AutoMigrate`、手工直接删生产表或跳过核对表。

## 5. 本地执行记录（2026-11-10）

- 执行方式：`migrations/0001_blog_redesign.sql` 经 `bin/server.exe migrate` 应用。
- 触发说明：在准备冒烟脚本时，脚本里的环境变量换行被 CRLF 破坏，导致 `MYSQL_DATABASE`
  未生效、迁移实际落在了本地 `jianli`（而非临时库）。该库当时已有
  `backups/2026-11-10-pre-redesign.sql` 全量备份，且迁移结果符合本核对表，故保留。
- 执行结果：`articles` 12 行、`primaryTagId` 悬空 0 条；主标签分布
  前端 4 / HTTP 3 / 后端 2 / 数据库 2 / 工程化 1（`CI/CD`、`AIAgent` 计数 0，保留）；
  剩余表：`admins`、`articles`、`schema_migrations`、`site_contents`、`tags`；
  `site_contents` 6 个 key（含 `plan`）。
- 管理员账号未改动（迁移不触碰 `admins`），原密码仍可登录。
- 回滚：`mysql jianli < backups/2026-11-10-pre-redesign.sql` 可将数据恢复到迁移前状态
  （会同时恢复 comments/users/notifications/ai_configs 与旧 `tags` 列）。
