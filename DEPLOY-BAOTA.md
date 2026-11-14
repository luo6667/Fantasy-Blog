# 宝塔面板部署指南（fantasynote.cloud）

> 目标：在宝塔面板（Linux）上用 **Nginx + systemd(Go) + PM2(Next.js) + MySQL 8** 上线本站，启用 HTTPS。
> 不使用 Docker。

---

## 0. 先看架构

```
浏览器
  │  https://fantasynote.cloud
  ▼
Nginx（宝塔，443/80）
  │  整站反代到 127.0.0.1:3000
  ▼
Next.js（PM2 进程 blog-web，3000，只监听本机）
  │  同源 /api、/uploads 由 next.config.ts 的 rewrites 转发
  ▼
Go API（systemd 服务 blog-server，4000，只监听本机）
  ▼
MySQL 8（127.0.0.1:3306）
```

目录约定（`deploy/deploy.sh` 使用）：

```
/www/wwwroot/personal-blog/
├── releases/<时间戳>/      每次发布一份完整代码（含 node_modules、.next）
├── current -> releases/...  当前线上版本（软链）
├── shared/
│   ├── backend.env          Go 环境变量（软链为 blog-server/.env）
│   ├── frontend.env.local   Next 环境变量（软链为 blog-fronted/.env.local）
│   └── uploads/             上传图片（软链/UPLOAD_DIR 指向这里）
└── logs/                    PM2 日志
```

---

## 1. 部署前准备

- [ ] 域名 `fantasynote.cloud` 的 **A 记录**指向服务器公网 IP（要用 www 就再加一条 `www`）。
- [ ] 服务器在**中国大陆**时，域名必须先完成 **ICP 备案**，否则 80/443 会被云厂商拦截。
- [ ] 云服务器安全组 / 宝塔防火墙只放行 **22、80、443**；**3000、4000、3306 不要对外开放**。
- [ ] 宝塔面板已安装，并改掉默认端口/弱密码，开启面板 SSL（可选加 IP 白名单）。

宝塔「软件商店」安装：

| 软件 | 版本要求 |
| --- | --- |
| Nginx | 1.20+ |
| MySQL | 8.0 |
| Node.js 版本管理器 | 安装 **Node 22 LTS**（Next 16 要求 ≥ 20.9） |
| PM2 | `npm i -g pm2` |
| Git | 可选（用上传压缩包也行） |

> Go **不需要**在服务器安装：在本地交叉编译 Linux 二进制上传即可（见第 5 步）。

---

## 2. 宝塔建站 + HTTPS

1. 「网站 → 添加站点」：域名填 `fantasynote.cloud` 和 `www.fantasynote.cloud`，PHP 选「纯静态」。
2. 进站点「设置 → SSL → Let's Encrypt」，申请证书，开启「强制 HTTPS」。
3. 若套了 Cloudflare：申请证书时先把云朵切成灰色（DNS only），签发成功后再开代理，否则 HTTP-01 校验会失败。

先不要在宝塔里配置反向代理，等进程起来后再配（第 10 步）。

---

## 3. 建数据库和专用账号

宝塔「数据库 → 添加数据库」：

- 数据库名：`jianli`
- 用户名：`blog_app`（不要用 root）
- 密码：随机强密码，记下来
- 字符集：`utf8mb4`

如果是**已有数据**要迁移：在宝塔 phpMyAdmin 导入 `mysqldump` 出来的 SQL；没有数据就留空库，稍后跑迁移建表。

---

## 4. 上传代码

在服务器上创建根目录：

```bash
mkdir -p /www/wwwroot/personal-blog
cd /www/wwwroot/personal-blog
```

把仓库代码放进来（二选一）：

```bash
# 方式 A：git
git clone <你的仓库地址> .

# 方式 B：本机打包上传后解压
# 注意排除 node_modules、.next、.git
tar -xzf personal-page.tar.gz -C /www/wwwroot/personal-blog
```

> 如果你说的「已经打包了前端」是指本机 `next build` 出来的 `.next`：
> **不要直接上传到 Linux**。Windows 构建产物里带 win32 原生模块（sharp / next-swc），
> Linux 上会报 `Cannot find module ...linux-x64-gnu` 或 sharp 相关错误。
> 正确做法是在服务器上重新 `npm ci && npm run build`（下面的发布脚本会自动做），
> 或者在 WSL / Linux 机器上构建后连同 `node_modules` 一起上传。

---

## 5. 准备 Go 二进制（服务器没装 Go 时）

在本地 Windows PowerShell：

```powershell
cd blog-server
$env:CGO_ENABLED="0"
$env:GOOS="linux"
$env:GOARCH="amd64"
go build -trimpath -ldflags "-s -w" -o bin/server ./cmd/server
```

把 `blog-server/bin/server` 上传到服务器：

```
/www/wwwroot/personal-blog/blog-server/bin/server
```

并加执行权限：

```bash
chmod +x /www/wwwroot/personal-blog/blog-server/bin/server
file /www/wwwroot/personal-blog/blog-server/bin/server
# 期望输出：ELF 64-bit LSB executable, x86-64 ...
```

> 服务器是 ARM（如甲骨文 Ampere）时，把 `GOARCH` 改成 `arm64`。

---

## 6. 初始化目录与环境变量

```bash
cd /www/wwwroot/personal-blog
bash deploy/deploy.sh bootstrap
```

它会在 `shared/` 下生成 `backend.env`、`frontend.env.local` 模板。然后编辑：

```bash
nano shared/backend.env
```

```ini
NODE_ENV=production
PORT=4000

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=blog_app
MYSQL_PASSWORD=这里填第 3 步的密码
MYSQL_DATABASE=jianli

# 生成：openssl rand -hex 32
JWT_SECRET=替换成64位随机串
JWT_EXPIRES_IN=7d

# 浏览器真实访问地址（必须完全一致，否则 CORS 403）
CORS_ORIGIN=https://fantasynote.cloud

# 只在同机 Nginx 反代时信任本机
TRUSTED_PROXIES=127.0.0.1,::1

# 上传目录必须指向 shared/uploads（systemd 只允许写这里）
UPLOAD_DIR=/www/wwwroot/personal-blog/shared/uploads
UPLOAD_MAX_SIZE=5242880

# 发文后刷新 Next 静态页；两个文件里的值必须一致
NEXT_REVALIDATE_URL=https://fantasynote.cloud
REVALIDATE_SECRET=替换成32位随机串

# 可选：GitHub 贡献图（没有也能跑，只是显示 unavailable）
# GITHUB_TOKEN=ghp_xxx
```

```bash
nano shared/frontend.env.local
```

```ini
REVALIDATE_SECRET=与 backend.env 完全一致
```

```bash
chmod 600 shared/backend.env shared/frontend.env.local
mkdir -p shared/uploads
chown -R www:www shared/uploads
```

> 生成随机串：`openssl rand -hex 32`（JWT）、`openssl rand -hex 24`（revalidate）。

---

## 7. 用 systemd 托管 Go 后端

```bash
cp blog-server/deploy/systemd/blog-server.service /etc/systemd/system/
nano /etc/systemd/system/blog-server.service
```

重点核对：

- `User=www` / `Group=www`（宝塔站点默认用户）；
- `WorkingDirectory=/www/wwwroot/personal-blog/current/blog-server`；
- `EnvironmentFile=/www/wwwroot/personal-blog/shared/backend.env`；
- `ExecStart=/www/wwwroot/personal-blog/current/blog-server/bin/server`；
- `After=mysql.service`：CentOS 上服务名可能是 `mysqld.service`，按发行版改；
- `ReadWritePaths=/www/wwwroot/personal-blog/shared/uploads` 保持不变。

```bash
systemctl daemon-reload
systemctl enable blog-server
```

> 先不要 `start`：`current` 软链还不存在。等第 9 步发布时由脚本启动。
> 如果你手动部署、没有用 `deploy.sh`，就自己把 `current` 指到发布目录后再启动。

---

## 8. 建表 + 创建管理员

用 `shared/backend.env` 里的变量直接执行（此时还没切 `current`，用源码目录里的二进制）：

```bash
cd /www/wwwroot/personal-blog
set -a; . shared/backend.env; set +a

./blog-server/bin/server migrate
```

- 空库会依次执行 `0000` 建表、`0001` 主/子标签改造；
- 如果导入的是**旧版带 `tags` 数组列**的库，会触发标签审批门禁：

```bash
./blog-server/bin/server migrate-tags export --out /tmp/tagmap.json
# 编辑 /tmp/tagmap.json，填 approvedBy / approvedAt
./blog-server/bin/server migrate-tags verify --file /tmp/tagmap.json
./blog-server/bin/server migrate-tags apply  --file /tmp/tagmap.json
./blog-server/bin/server migrate
```

创建管理员（只做一次）：

```bash
ADMIN_INITIAL_PASSWORD='你的强密码' ./blog-server/bin/server seed-admin
```

之后后台登录账号是 `admin`，密码就是上面这个。

---

## 9. 构建前端 + 发布

先确认 **Node 版本**：

```bash
node -v   # 必须 >= 20.9，推荐 22.x
npm -v
```

如果 `node -v` 还是 18，用宝塔 Node 版本管理器把命令行版本切到 22，并确保 PM2 用同一个 node：

```bash
which node
npm i -g pm2
```

创建一次发布目录并交给 `deploy.sh` 构建、切换、启动：

```bash
cd /www/wwwroot/personal-blog
REL="releases/$(date -u +%Y%m%d-%H%M%S)"
mkdir -p "$REL"
rsync -a --exclude node_modules --exclude .next --exclude .git \
  --exclude releases --exclude shared --exclude logs --exclude current \
  ./ "$REL/"
bash deploy/deploy.sh deploy "$REL"
```

脚本会依次：

1. 校验环境变量（含两端 `REVALIDATE_SECRET` 一致）；
2. 用预编译的 `bin/server`（服务器有 Go 则会重新编译）；
3. `npm ci && next build`（**构建时后端必须已可访问**，所以这一步在起后端之后更稳）；
4. 切换 `current` 软链；
5. `systemctl restart blog-server` + 健康检查 `/api/health`；
6. `pm2 startOrReload` + 健康检查 `127.0.0.1:3000`；
7. 自动触发 `/blog`、`/blog/[id]`、`/home`、`/plan`、`/resume` 的静态刷新；
8. 失败时自动切回上一个发布。

> 第一次发布如果后端还没起来，`/blog` 的 SSG 可能是空列表；
> 脚本在服务起来后会自动 revalidate 一次，把这个坑补上。

成功后检查：

```bash
bash deploy/deploy.sh status
pm2 ls
curl -s http://127.0.0.1:4000/api/health
```

---

## 10. Nginx 反向代理

**方式 A（宝塔 UI，最简单）**

站点「设置 → 反向代理 → 添加反向代理」：

- 代理名称：`blog`
- 目标 URL：`http://127.0.0.1:3000`
- 发送域名：`$host`

保存即可。`/api`、`/uploads` 不需要单独配置，Next 会内部转发到 4000。

**方式 B（用仓库示例，带缓存策略）**

编辑站点「配置文件」，把 `server` 段按 `deploy/nginx-blog.conf.example` 替换，
域名和证书路径已按 `fantasynote.cloud` 填好。检查并重载：

```bash
nginx -t && systemctl reload nginx
```

建议保留示例里的：

- `/ _next/static/` 与 `/uploads/` 一年 immutable 缓存；
- `/api/` 加 `Cache-Control: no-store`；
- `client_max_body_size 10m`（上传上限 5MB，留余量）；
- `proxy_set_header X-Forwarded-For` / `X-Forwarded-Proto`（限流与日志需要）。

---

## 11. 首次刷新静态页（通常已自动执行）

```bash
SECRET=$(grep '^REVALIDATE_SECRET=' shared/backend.env | cut -d= -f2-)
curl -g -s "http://127.0.0.1:3000/api/revalidate?secret=${SECRET}&path=/blog&path=/blog/%5Bid%5D&path=/home&path=/plan&path=/resume"
# 期望：{"revalidated":true,...}
```

如果返回 401：说明 Next 没读到 `frontend.env.local`，把 `REVALIDATE_SECRET`
也写进 `deploy/ecosystem.config.cjs` 的 `env`（或导出后再 `pm2 reload`）。

---

## 12. 上线验收清单

- [ ] `https://fantasynote.cloud/` 首页正常，强制 HTTPS 生效；
- [ ] `/blog` 有文章列表（不是空的），点进详情正常；
- [ ] `/plan`、`/resume`、`/about`、封面页 `/cover` 正常；
- [ ] `/admin/login` 能登录，`/admin/articles`、`/admin/plan`、`/admin/resume` 可用；
- [ ] 发一篇测试文章 → 首页/列表/详情立即更新（revalidate 生效）；
- [ ] 上传一张图片 → 返回 `/uploads/...` 可访问；
- [ ] 手机 4G 访问正常，无横向滚动/白屏；
- [ ] `curl -I https://fantasynote.cloud/` 有 `HTTP/2 200`；
- [ ] 3000 / 4000 / 3306 从公网不可访问。

---

## 13. 备份、升级与回滚

**每日备份**（宝塔计划任务或 crontab）：

```bash
mysqldump -u blog_app -p'密码' --single-transaction jianli | gzip > /www/backup/jianli-$(date +%F).sql.gz
tar -czf /www/backup/uploads-$(date +%F).tar.gz -C /www/wwwroot/personal-blog/shared uploads
cp /www/wwwroot/personal-blog/shared/backend.env /www/backup/backend.env.$(date +%F)
```

把 `/www/backup` 同步到对象存储或另一台机器；定期演练恢复。

**升级**：上传新代码到新的 `releases/<时间戳>/`，再执行：

```bash
bash deploy/deploy.sh deploy releases/<新目录>
```

**回滚**（不重新构建）：

```bash
bash deploy/deploy.sh rollback
# 或指定目录
bash deploy/deploy.sh rollback releases/<旧目录>
```

> 数据库迁移是向前不可逆的：回滚代码前先确认 schema 兼容，必要时用备份恢复数据库。

---

## 14. 常见问题

| 现象 | 排查 |
| --- | --- |
| 502 Bad Gateway | `pm2 ls` 看 `blog-web`；`journalctl -u blog-server -n 100` |
| 首页 500 / 接口全挂 | `curl 127.0.0.1:4000/api/health`；看 `shared/backend.env` 数据库配置 |
| 文章列表为空 | 后端没起时构建过；执行第 11 步的 revalidate，或后端在线后重新发布 |
| 发文后不刷新 | 两端 `REVALIDATE_SECRET` 不一致；手动 curl 测试 |
| 上传 413 | Nginx `client_max_body_size` 与 Go `UPLOAD_MAX_SIZE` |
| 图片 404 | `UPLOAD_DIR` 是否指向 `shared/uploads`；`chown -R www:www` |
| CORS 403 | `CORS_ORIGIN` 必须与浏览器地址完全一致（含 https、有无 www） |
| `Invalid ELF header` / 203/EXEC | 二进制不是 Linux 版或没 `chmod +x` |
| Next 启动报 sharp / linux-x64-gnu | 上传了 Windows 的 `.next`/`node_modules`，在服务器重新构建 |
| `Error 1045 Access denied` | `MYSQL_USER/PASSWORD` 不对；生产环境密码必须显式配置 |
| 迁移报「标签映射未审批」 | 按第 8 步 `migrate-tags export/verify/apply` |
| PM2 重启后丢失 | `pm2 save && pm2 startup` |

---

## 15. 安全收尾

- 宝塔面板：改端口、强密码、面板 SSL、限制访问 IP；
- MySQL：只监听 `127.0.0.1`，`blog_app` 只授权 `jianli.*`；
- 防火墙/安全组：只开 22/80/443；
- 定期 `apt upgrade` / 宝塔漏洞修复；
- 证书自动续签保持开启；
- 日志轮转：`/www/wwwlogs/*.log` 与 `journalctl` 限制大小；
- 备份文件不要放在网站根目录下。
