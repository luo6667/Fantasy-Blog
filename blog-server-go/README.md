# blog-server-go

博客后端（B 端）的 Go 实现，作为 `blog-server/`（Express 5 + Sequelize）的等价替代。

目标是**对外行为完全兼容**：API 路径、请求/响应 JSON、状态码、错误文案、分页、
鉴权（含旧 JWT）、上传地址与 AI SSE 都与旧实现一致，前端零改动即可切换。

## 技术栈

- Go 1.27 + [Gin](https://github.com/gin-gonic/gin) + [GORM](https://gorm.io/) + MySQL 8
- `golang-jwt/jwt/v5`（HS256，与旧 Node 同密钥可直接复用 token）
- `golang.org/x/crypto/bcrypt`（cost 10，兼容 `$2b$` 哈希）
- `goldmark` + `bluemonday`（Markdown → 净化 HTML）
- AES-256-GCM 加密 AI Key

## 目录

```
cmd/server/           入口（HTTP / migrate / migrate-ai-keys）
internal/
  config/             环境变量加载与校验（与 env.ts 同名同默认值）
  database/           GORM 连接与建库
  model/              8 张表的显式映射（表名、列名、索引、JSON 列）
  httpx/              响应信封、错误类型、时间格式
  auth/               JWT 签发/解析
  middleware/         鉴权、限流、CORS、JSON body 校验、panic 恢复
  service/            业务逻辑（文章/评论/标签/通知/用户/站点内容/AI/加密）
  server/             路由装配与 handler
  migrate/            版本化 SQL 迁移执行器
migrations/           嵌入式 SQL（0000_legacy_schema 为旧库基线）
tests/contract/       Node 基线 golden + 回放比对
tests/smoke/          前端联调冒烟
```

## 环境变量

与旧 Node 服务**同名、同默认值、同 fail-fast 行为**：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | `development` | 日志模式 |
| `PORT` | `4000` | HTTP 端口 |
| `MYSQL_HOST` / `MYSQL_PORT` | `127.0.0.1` / `3306` | 数据库地址 |
| `MYSQL_USER` / `MYSQL_PASSWORD` | `root` / 空 | 数据库账号（密码缺省时为空串） |
| `MYSQL_DATABASE` | `jianli` | 库名 |
| `JWT_SECRET` | 必填，≥16 字符 | 与旧服务一致才能复用登录态 |
| `JWT_EXPIRES_IN` | `7d` | 支持 `7d` / `12h` / `30m` |
| `CORS_ORIGIN` | `http://localhost:3000` | 逗号分割白名单 |
| `UPLOAD_DIR` | `uploads` | 上传落盘目录 |
| `UPLOAD_MAX_SIZE` | `5242880` | 单文件上限（字节） |
| `ADMIN_INITIAL_PASSWORD` | 空 | 可选：启动时创建/重置管理员 |
| `NEXT_REVALIDATE_URL` | 空 | Next 站点地址；缺省则跳过按需刷新 |
| `REVALIDATE_SECRET` | 空 | 与 Next 共享的刷新密钥 |
| `AI_CONFIG_ENC_KEY` | 空 | base64 的 32 字节主密钥；设置后 AI Key 以密文存取 |

## 启动与 `.env`

Go 版本内置了与旧服务一致的 dotenv 加载（不依赖第三方库），查找顺序：

1. `ENV_FILE` 指定的文件（显式指定，缺失即报错）；
2. 当前工作目录的 `.env`；
3. 可执行文件所在模块根的 `.env`（`bin/server.exe` → 模块根）；
4. 开发期兄弟目录 `../blog-server/.env`（与旧 Node 服务共用一份配置）。

已存在的真实环境变量优先，`.env` 不会覆盖它们；生产建议用 systemd `EnvironmentFile` 注入。

```bash
# 方式一：开发脚本（自动加载 .env，参数透传）
bash scripts/dev.sh            # 启动 HTTP 服务
bash scripts/dev.sh migrate    # 执行迁移

# 方式二：手动
cp .env.example .env
go build -o bin/server.exe ./cmd/server
./bin/server.exe
```

## 常用命令

```bash
# 构建 / 运行
go build -o bin/server.exe ./cmd/server
./bin/server.exe

# 版本化迁移（空库建 8 张表；既有库只登记基线，不重建数据）
./bin/server.exe migrate

# 把库里明文 AI Key 加密（需 AI_CONFIG_ENC_KEY）
./bin/server.exe migrate-ai-keys

# 一键门禁：gofmt + go vet + go test + build
bash scripts/check.sh

# 契约回放：重置副本库 → 用 golden 采集 → 归一化比对
bash tests/contract/replay.sh

# 前端联调冒烟：起 Go 与 Next dev，校验页面与代理接口
bash tests/smoke/frontend.sh
```

> 本机沙箱下需先 `source goenv.sh`（GOPATH / GOMODCACHE / GOCACHE 落在仓库内）。

## 数据库与迁移

- 表名、列名、索引、JSON 列与旧 Sequelize 定义完全一致（见 `internal/model/model.go`）。
- **生产禁止 AutoMigrate**：结构变更只走 `migrations/*.sql`，由 `migrate` 子命令按文件名顺序执行，
  成功后写入 `schema_migrations`。
- `0000_legacy_schema.sql` 是旧库基线：目标库已有业务表时只登记版本、不执行建表，
  因此对线上库执行 `migrate` 是安全的。
- 时间语义沿用旧服务：DSN `parseTime=true&loc=Asia/Shanghai`，写入与读取都按 +08 处理，
  输出统一为 UTC ISO（`...Z`）。

## AI 密钥加密

- 格式：`enc:v1:<base64(nonce||ciphertext)>`（AES-256-GCM）。
- 主密钥只从环境变量 `AI_CONFIG_ENC_KEY` 读取，不落库、不进日志。
- 读取时遇到明文会自动加密回写；`migrate-ai-keys` 用于一次性批量迁移。
- 未配置主密钥时保持旧行为（明文存取）并在日志中告警。
- 回滚：恢复数据库备份即可恢复明文配置。

## 契约回放

`tests/contract/golden/` 保存了 101 个旧 Node 服务的真实响应；`replay.sh` 在重置后的副本库
`blog_golden` 上用同一份请求脚本回放 Go 实现，并由 `compare.mjs` 归一化（ID/JWT/时间/文件名/限流头）
后逐用例比较。当前结果：**101 个用例全部一致**。

已知书写豁免（非缺陷，理由见 `tests/contract/README.md`）：

- `ai_settings_empty` / `ai_chat_unconfigured`：golden 录制时库中已有生产 AI 配置，无法在空配置库确定性复现；
- 通知/评论同一秒内创建时的并列顺序：比较前做组内排序，跨秒的真实顺序差异仍会被发现。

## 前端联调

`tests/smoke/frontend.sh` 以 `API_TARGET` 指向 Go 服务启动 Next dev，验证：

- 页面：`/`、`/blog`、`/plan`、`/resume`、`/about` 均 200 且含关键内容；
- 经 Next rewrites 的接口：管理员登录、`/api/auth/me`、文章列表、站点内容 `plan`。

## 尚未包含

- 任务 11/12 的 systemd 发布与生产切换脚本（按当前决定暂缓，切换时再补）；
- 旧 Node 源码归档（待 Go 版本验收后执行）。

## 与旧实现的关系

`blog-server/` 仍保留原 Node 实现，可随时回退或对照。两者共用同一 MySQL 库结构、
同一 `uploads/` 目录与同一套 env 变量，可在维护窗口内直接替换进程。
