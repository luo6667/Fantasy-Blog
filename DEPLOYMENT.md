# 上线部署说明（JasonLuo Blog · 宝塔面板版）

> 本文档面向 **宝塔面板（Linux）** 部署。
> 架构：前端 `blog-fronted`（Next.js 16 App Router）＋后端 `blog-server`（Go 1.27 + Gin + GORM + MySQL 8）。
>
> 进程管理边界：**Go 后端由 systemd 单元 `blog-server.service` 托管**（unit 示例见
> [`blog-server/deploy/systemd/blog-server.service`](./blog-server/deploy/systemd/blog-server.service)）；
> **Next 前端由 PM2 的 `blog-web` 托管**。旧的 `pm2 start dist/index.js` 方式已废弃。

> 📌 **现在走自动化部署了**：`git push origin main` 即上线，支持一键回滚、失败自动退回上一版。
> 流水线用法见 **[DEPLOY-CICD.md](./DEPLOY-CICD.md)**（目录结构、GitHub Secrets、bootstrap、回滚、老服务器数据迁移都在那里）。
> 本文保留为**首次环境准备 / 没有 CI 时的手工流程**参考——两者不冲突：CICD 只是把下面第二节的手工步骤固化成了脚本。

## 〇、架构总览（先读这段，避免照旧文档部署翻车）

```
                用户浏览器
                    │  HTTPS (443)
                    ▼
   ┌─────────────────────────────────────┐
   │  宝塔 Nginx（SSL 证书 + 入口）        │   ← 唯一对外开放的进程
   │  全部请求反代到 Next.js              │
   └─────────────────────────────────────┘
                    │  127.0.0.1:3000
                    ▼
   ┌─────────────────────────────────────┐
   │  blog-fronted：Next.js 16 (next start)│  ← SSG/ISR 静态页 + /api/revalidate
   │  rewrites 自动把 /api、/uploads 转发   │
   └─────────────────────────────────────┘
              │ 127.0.0.1:4000   │
              ▼                  ▼
   ┌────────────────────┐   ┌──────────────┐
   │  blog-server        │──▶│ MySQL 8      │
   │  Express 5 API      │   └──────────────┘
   └────────────────────┘
```

关键事实（与旧文档不同，务必注意）：

1. **前端不是 Vite SPA**，没有 `dist/index.html`。它是 Next.js 16，用 `next start` 以 Node 进程方式运行（端口 3000），不能用 Nginx `try_files` 托管静态产物。
2. **`/api` 与 `/uploads` 由 Next.js 内部 rewrites 转发到 Express**（见 `next.config.ts`，生产环境同样生效，不依赖 Nginx 分路径）。所以 Nginx 只需**整站反代到 Next 的 3000 端口**即可。
3. **`trust proxy` 已经内置**（`blog-server/src/app.ts` 有 `app.set('trust proxy', 1)`），旧文档第四节"部署在反代之后必须改的代码点"**已不需要手动操作**；只需保证 Nginx 正确设置 `X-Forwarded-For`（见下文 Nginx 配置）。
4. 私信 / Socket.IO / 用户搜索 / MongoDB 迁移脚本 **已下线**，相关配置项不存在，无需处理。
5. 文章详情页是 **SSG**（构建时预渲染全部文章）＋ ISR 兜底 ＋ 发布时后端调 `/api/revalidate` 即时重建。想让"发布即更新"生效，必须配 `NEXT_REVALIDATE_URL` + `REVALIDATE_SECRET`（两端同值），否则内容更新要等 ISR 周期（1 小时）或重新构建。

---

## 一、上线前必须配齐的环境变量

### 1. 后端：`blog-server/.env`（绝不提交 git，已 gitignore）

```bash
NODE_ENV=production
PORT=4000

# ── 数据库（宝塔里新建的库和账号，不要用 root / 默认密码）──
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=blog_app
MYSQL_PASSWORD=<建库时设的强密码>
MYSQL_DATABASE=jianli          # 库不存在时启动会自动创建

# ── JWT：必须换成随机值（在服务器执行 openssl rand -hex 32）──
# 泄露后所有登录 token 可被伪造。长度要求 ≥16。
JWT_SECRET=<openssl rand -hex 32 的结果>
JWT_EXPIRES_IN=3d

# ── CORS：改成你的真实前端域名（必改！不改 = 前端所有请求被拒）──
# 浏览器实际访问的地址，含协议，多个用英文逗号分隔
CORS_ORIGIN=https://blog.example.com

# ── 静态页即时刷新：让「发文章 / 改简历立即生效」──
# NEXT_REVALIDATE_URL = 前端对外访问地址（要能被后端服务器访问到）；
# REVALIDATE_SECRET 必须与前端 .env.local 里的同值（见下方）。
NEXT_REVALIDATE_URL=https://blog.example.com
REVALIDATE_SECRET=<openssl rand -hex 32 的结果>

# ── 以下有合理默认值，一般不用动 ──
# UPLOAD_DIR=uploads            # 上传目录（自动创建，需运行用户可写）
# UPLOAD_MAX_SIZE=5242880       # 单文件上限 5MB

# ── 只建管理员时用一次，用完务必清空（见步骤 4）──
ADMIN_INITIAL_PASSWORD=
```

### 2. 前端：`blog-fronted/.env.local`（已被 gitignore，不会提交）

Next.js 运行时（`next start`）会自动加载 `.env.local`，只需放与后端**同值**的 revalidate 密钥：

```bash
REVALIDATE_SECRET=<与后端 .env 里相同的值>
```

> ⚠️ 前端没有其他必须的 `NEXT_PUBLIC_*`。浏览器请求走同源 `/api`（rewrites 代理），页面代码里看不到后端地址。

### 3. 必配项一览（照这个表自查）

| 配置 | 在哪 | 不配会怎样 |
|---|---|---|
| `CORS_ORIGIN` | 后端 `.env` | 登录/评论/所有接口 CORS 403，前端全挂 |
| `JWT_SECRET` | 后端 `.env` | 用默认值 = token 可被伪造 |
| `MYSQL_PASSWORD` | 后端 `.env` | root/弱口令 = 数据库裸奔 |
| `NEXT_REVALIDATE_URL` + `REVALIDATE_SECRET` | 后端 `.env` + 前端 `.env.local` | 发文章不即时刷新（要等 1h ISR 或重新构建） |
| 管理员密码 | 步骤 4 seed | 本地测试是弱口令 `123456`，线上继续用 = 后台裸奔 |

---

## 二、宝塔实操步骤

> 前置：一台有公网 IP 的服务器；宝塔已装 **Nginx**、**MySQL 8**；前端需要 **Node ≥20** 与 **PM2 管理器**；后端是 Go，需要 **Go 1.27+**（或由 CI 交叉编译好 `bin/server` 后上传）。

### 1. MySQL 建库建号（最小权限账号）

宝塔 → 数据库 → 添加数据库：库名 `jianli`，用户名建议 `blog_app`，密码用随机强密码（宝塔可生成），权限默认"本地"。

> 不需要手动建表——后端启动时自动 `CREATE DATABASE IF NOT EXISTS` + 建表（只建不动的语义，不会碰已有数据）。

### 2. 上传代码

> 走 CICD 时这一步由流水线自动完成（`rsync` 到 `releases/<时间戳>-<sha>/`，目录结构不同，见 [DEPLOY-CICD.md](./DEPLOY-CICD.md)）。下面是纯手工部署的路径。

把项目里 **`blog-server/` 与 `blog-fronted/` 两个目录**（连同 `package.json`、`src/` 等，不含 `node_modules`、`.next`、`uploads`）上传到服务器，例如：

```
/www/wwwroot/personal-blog/blog-server
/www/wwwroot/personal-blog/blog-fronted
```

### 3. 后端：配置 → 构建 → 起服务

```bash
cd /www/wwwroot/personal-blog/blog-server

# 3.1 写 .env（按上文第一节模板；JWT_SECRET / REVALIDATE_SECRET 先生成好）
#     openssl rand -hex 32  ← 生成随机串

# 3.2 编译（服务器装有 Go 时；否则由 CI 预编译 bin/server 后上传）
mkdir -p bin
CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o bin/server ./cmd/server

# 3.3 应用版本化迁移（生产禁止 AutoMigrate；先在副本库演练）
./bin/server migrate
```

### 4. 建管理员账号（先做，只在首次部署做）

```bash
# 4.1 用环境变量传入初始密码（不写进文件；至少 8 位）
ADMIN_INITIAL_PASSWORD='<强密码>' ./bin/server seed-admin

# 4.2 admin 已存在时该命令会重置密码；命令成功后环境变量即失效，
#     不要把密码留在 shell 历史或 .env 里。
```

> 警告：`seed-admin` 每次执行都会把该管理员密码重置为传入值；只在需要重置时执行，不要把它写进脚本或 CI。

### 5. 用 systemd 托管后端（崩溃自动重启 + 开机自启）

```bash
# 5.1 安装 unit（按实际路径修改 WorkingDirectory / EnvironmentFile / ExecStart / ReadWritePaths）
sudo cp blog-server/deploy/systemd/blog-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now blog-server

# 5.2 查看状态与日志
systemctl status blog-server
journalctl -u blog-server -f
```

验证：`curl http://127.0.0.1:4000/api/health` 应返回存活信息。此时不要对公网开放 4000 端口（见步骤 8）。

> 前端仍由 PM2 托管（见 6.3）；**不要**再用 PM2 启动 Go 后端，避免两个进程抢同一端口。

### 6. 前端：构建 → 起服务（**先确保后端已启动**）

```bash
cd /www/wwwroot/personal-blog/blog-fronted

# 6.1 写 .env.local（revalidate 密钥，与后端 .env 同值）
#     REVALIDATE_SECRET=<与后端相同的值>

# 6.2 安装依赖并构建
npm ci
npm run build
```

> 构建时会调用后端把全部文章预渲染成静态页（`generateStaticParams`）。后端没起也能构建成功（自动降级为空列表），但最好先起后端，详情页才能全量 SSG。`API_TARGET` 默认 `http://localhost:4000`，前后端同机时无需配置。

```bash
# 6.3 PM2 托管（端口 3000）
pm2 start npm --name blog-web -- run start -- -p 3000
pm2 save
```

验证：`curl -I http://127.0.0.1:3000` 应返回 200。

### 7. Nginx 站点（宝塔图形界面）

1. 网站 → 添加站点：域名填你的域名，纯静态即可（不选 PHP）。
2. 网站 → SSL → Let's Encrypt 申请证书（或上传已有证书），开启「强制 HTTPS」。
3. 网站 → 反向代理 → 添加：目标 URL `http://127.0.0.1:3000`，发送域名 `$host`。
4. 保存后打开「配置文件」，把宝塔自动生成的反向代理 `location / { ... }` 整段**替换**为下方内容（SSE 流式对话需要关缓冲；上传 5MB 需要放宽 body 上限）：

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # AI 流式对话（SSE）不能被 Nginx 缓冲，否则打字机效果失效/卡住
    proxy_buffering off;
    proxy_read_timeout 120s;
}

# 文章上传图片 5MB，放宽请求体上限
client_max_body_size 10m;
```

> 反代整站即可——`/api` 与 `/uploads` 由 Next.js 内部 rewrites 转发到后端，Nginx 不需要按路径分发给 4000。

### 8. 防火墙：只放行必要端口

- 宝塔「安全」放行：`22`、`80`、`443`（`8888` 为面板端口，建议改默认或加访问白名单）。
- **不要**放行 `3000`、`4000`，它们只允许本机（127.0.0.1）访问。
- 如果服务器在云厂商（阿里云/腾讯云等），**云控制台的安全组同样只放行 22/80/443**。

---

## 三、上线核对清单（改完跑一遍再对外）

- [ ] `curl https://你的域名/api/health` 返回存活；页面能打开、样式正常
- [ ] 浏览器无痕窗口能打开首页/简历页；控制台无 CORS 报错（说明 `CORS_ORIGIN` 已生效）
- [ ] 用 admin 登录 → 发一篇测试文章 → 前端**立即**能搜到并打开（说明 revalidate 通了；若不通查两端 `REVALIDATE_SECRET` 是否同值）
- [ ] 普通用户注册 → 评论 → 管理员收到通知；上传一张 >1MB 的图片到文章里能正常显示
- [ ] 登录后 30 秒刷新页面仍保持登录（JWT 正常）；把系统时间往前调验证过期（可选）
- [ ] `ADMIN_INITIAL_PASSWORD` 已清空；admin 密码不是 `123456`
- [ ] `systemctl is-active blog-server` 为 `active`；`pm2 ls` 中 `blog-web` 在线且 `pm2 save` 已执行
- [ ] 数据库做了备份（cron + mysqldump 或宝塔「计划任务」每日备份 `jianli` 库 + `blog-server/uploads/` 目录）

## 四、常见坑（FAQ）

**Q：访问全是 403/CORS 错误？**
几乎都是后端 `.env` 里 `CORS_ORIGIN` 还是 `http://localhost:3000`。改成真实域名后**重启后端**（改 .env 不重启不生效）。

**Q：发布文章后页面不变？**
看两端是否都配了同值 `REVALIDATE_SECRET`：后端 `.env` ＋ 前端 `.env.local`（前端改后要重启 blog-web 进程）。都没有配 = 静默降级，等 1 小时 ISR 或手动重新构建。

**Q：AI 对话流式输出卡住/一次性输出？**
Nginx 那层 `proxy_buffering off` 没加，或加了没重载配置。检查站点配置文件。

**Q：上传图片 413？**
`client_max_body_size` 没放开，或 `UPLOAD_MAX_SIZE`（默认 5MB）确实小于图片。

**Q：登录偶尔提示"请求过于频繁"？**
`trust proxy` 已内置，正常情况下按真实用户 IP 计数。若 Nginx 未设置 `X-Forwarded-For`（见步骤 7 配置），所有人都会按代理 IP 计数导致误伤——检查反代配置是否完整。

**Q：重启服务器后服务没了？**
需要 `pm2 startup` 且执行过 `pm2 save`；宝塔 PM2 管理器勾选「开机启动」同理。

**Q：seed 报找不到 tsx？**
`npm ci` 时用了 `--omit=dev` 会把 seed 依赖（tsx）裁掉。重新 `npm ci`（不带 omit）即可。
