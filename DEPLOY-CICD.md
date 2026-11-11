# CICD 部署手册（GitHub Actions → 阿里云 ECS）

> 面向本仓库的**自动化部署**：`push main` 即上线，支持一键回滚，失败自动退回上一版。
> 架构沿用现有线上形态（Nginx → Next.js `next start` :3000 → Express :4000 → MySQL），**不引入 Docker、不改 Nginx 结构**。
>
> ⚠️ 后端已迁移为 Go（提交 `87def6e`），且博客已改为管理员专用（评论/通知/AI 已移除）。
> 下文 Express + PM2 的构建/启动步骤**尚未更新**（属后续任务）；Go 版的 systemd 示例与
> 发布/回滚清单见 [`blog-server/deploy/`](./blog-server/deploy/)。
> 手工部署流程见 [DEPLOYMENT.md](./DEPLOYMENT.md)；本文只讲「有了这套流水线之后怎么用」。

---

## 一、流水线做了什么

```
开发者                     GitHub Actions                     阿里云 ECS
  │                              │                                │
  │  git push origin main        │                                │
  ├─────────────────────────────▶│                                │
  │                              │ ① verify：两端的 tsc / eslint    │
  │                              │    （PR 只跑这一步，不碰线上）    │
  │                              │ ② rsync 源码（排除 node_modules/ │
  │                              │    .next/.env/uploads）──────────▶ releases/20261020-1327-672de74/
  │                              │ ③ SSH 执行 deploy.sh deploy ────▶│
  │                              │                                │ ④ 构建后端（npm ci + tsc）
  │                              │                                │ ⑤ 构建前端（next build，
  │                              │                                │    用刚起的后端预渲染文章）
  │                              │                                │ ⑥ 切 current 软链
  │                              │                                │ ⑦ pm2 reload 两个进程
  │                              │                                │ ⑧ 健康检查（失败自动切回上一版）
  │                              │◀────── 退出码 0 / 1 ────────────│
```

服务器目录结构（一次建好，之后每次发布新建一个 `releases/xxx`，其他不动）：

```
/www/wwwroot/personal-blog/
├── releases/
│   ├── 20261020-1327-672de74/     ← 每次发布一份完整代码（含自己的 node_modules、.next、dist）
│   └── 20261018-0902-1a2b3c4/
├── current -> releases/20261020-1327-672de74/   ← PM2 的工作目录，切它就是切版本
├── shared/                         ← 跨版本复用，回滚不会动
│   ├── backend.env                 → 软链成 blog-server/.env
│   ├── frontend.env.local          → 软链成 blog-fronted/.env.local
│   ├── deploy.env                  （可选）覆盖 KEEP_RELEASES / NPM_REGISTRY / PATH
│   └── uploads/                    ← 文章图片，UPLOAD_DIR 固定指这里
└── logs/                           ← PM2 日志
```

---

## 二、为什么这么设计（四个决定，都踩过坑）

| 决定 | 原因 | 代价 |
|---|---|---|
| **GitHub Actions 主动推**（rsync + SSH），不让服务器来拉 | 国内 ECS 访问 GitHub 经常很慢或超时；反过来 runner 连 ECS 稳定得多，且 ECS 不需要任何出网权限 | 需要把 22 端口对 GitHub runner 开放（runner IP 不固定，建议改端口 + 只允许密钥登录 + fail2ban） |
| **在服务器上构建**，不在 CI 里构建好再传 | 前端是 SSG：`generateStaticParams` 必须在构建期调后端拿到**真实文章列表**，CI 里没有数据库；且 `.env.local` 的 `REVALIDATE_SECRET` 在运行机器上才能生效 | 每次部署占服务器 CPU/内存约 2–3 分钟（4G 机器没问题；构建时线上仍由旧版本对外服务） |
| **releases + current 软链** | 回滚 = 切软链 + reload，**秒级且不用重新构建**；新旧版本产物互不覆盖 | 每个版本约 700MB 磁盘，保留 3 版（`KEEP_RELEASES` 可调） |
| **密钥和图片放 shared/** | `.env`、`uploads/` 本来就在 .gitignore 里，不能进发布目录，否则回滚会把密钥和图片一起回滚没 | 部署脚本必须处理软链，多一层间接（已封装在 `deploy.sh`） |

> 为什么不在 CI 构建前端产物再传：CI 构建时打不到线上 MySQL，`generateStaticParams` 会降级成空列表，所有文章详情页退化成「按需生成」，SEO 和首屏收益直接丢掉。这个问题只有「贴近数据构建」能解。

---

## 三、一次性准备（换新 ECS 就照着做一遍）

### 3.1 基础环境（root 执行）

```bash
# Node 22 LTS（Next.js 16 要求 Node >= 20）
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# 国内机器建议顺手换 npm 源（后面写进 shared/deploy.env）
npm config set registry https://registry.npmmirror.com

node -v   # v22.x
npm -v
```

宝塔面板里另外装好 **Nginx**、**MySQL 8**，并在「数据库」里建库建号：

- 库名 `jianli`
- 账号 `blog_app`，密码用随机强密码，权限选「本地」
- 不需要手工建表，后端启动会自动 `CREATE DATABASE/TABLE IF NOT EXISTS`

### 3.2 建部署用户（不要用 root 跑 CI）

```bash
useradd -m -s /bin/bash deploy
# 让 deploy 能写站点目录
mkdir -p /www/wwwroot/personal-blog
chown -R deploy:deploy /www/wwwroot/personal-blog

# 用 deploy 身份装 pm2（pm2 是「每个用户一套」的，必须和跑进程的用户一致）
su - deploy -c 'npm i -g pm2'
su - deploy -c 'pm2 -v'
```

> ⚠️ 常见坑：用 root 装 pm2、用 deploy 跑脚本 → `pm2: command not found` 或进程在 root 名下、切版本不生效。**装 pm2 的人和 CI 登录的人必须是同一个。**

### 3.3 生成 SSH 密钥（本机或服务器上执行都行）

```bash
ssh-keygen -t ed25519 -C "github-actions-blog-deploy" -f ~/.ssh/blog_deploy -N ""
# 公钥装机：注意要装到 deploy 用户
cat ~/.ssh/blog_deploy.pub | ssh root@<ECS_IP> \
  'mkdir -p /home/deploy/.ssh && cat >> /home/deploy/.ssh/authorized_keys && chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys'
```

服务器侧加固（可选但强烈建议）：`/etc/ssh/sshd_config` 里 `PasswordAuthentication no`、改 `Port`，然后 `systemctl restart sshd`。

顺手把主机公钥记下来，等会儿填 `SSH_KNOWN_HOSTS`：

```bash
ssh-keyscan -p 22 <ECS_IP> | sed "s/^<ECS_IP>/$(echo <ECS_IP>) /" 
# 或直接：ssh-keyscan -H <ECS_IP>  > known_hosts 内容
```

### 3.4 在 GitHub 配好 Secret / Variable

仓库 → **Settings → Secrets and variables → Actions**：

| 类型 | 名称 | 必填 | 说明 |
|---|---|---|---|
| Secret | `SSH_HOST` | ✅ | ECS 公网 IP 或域名 |
| Secret | `SSH_USER` | ✅ | `deploy` |
| Secret | `SSH_PRIVATE_KEY` | ✅ | 3.3 生成的**私钥全文**（含 `BEGIN/END` 行） |
| Secret | `SSH_PORT` | 可选 | 默认 22 |
| Secret | `SSH_KNOWN_HOSTS` | 可选 | 主机公钥，填了就固定校验指纹；不填会退化成 `ssh-keyscan` 临时信任 |
| Variable | `APP_ROOT` | 可选 | 默认 `/www/wwwroot/personal-blog` |

### 3.5 先 bootstrap，再填环境变量

GitHub → **Actions → Deploy → Run workflow**，`action` 选 **bootstrap**。

它会在服务器上建好 `releases/ shared/ shared/uploads/ logs/`，并生成两份环境变量模板，然后打印接下来的步骤。跑完后在服务器上填：

```bash
sudo -u deploy nano /www/wwwroot/personal-blog/shared/backend.env
sudo -u deploy nano /www/wwwroot/personal-blog/shared/frontend.env.local
```

`backend.env` 里必须改的：

```bash
MYSQL_PASSWORD=<建库时的强密码>
JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGIN=https://www.jasonluoblog.online        # 浏览器真实访问的地址
NEXT_REVALIDATE_URL=https://www.jasonluoblog.online
REVALIDATE_SECRET=$(openssl rand -hex 32)          # 前后端必须同值！
```

`frontend.env.local` 里只放同一个 `REVALIDATE_SECRET`。
**这两个值不一致不会报错，只会静默失去「发文即时刷新」**，所以 `deploy.sh` 每次发布会比对并警告，也会在发布前拦下 `CHANGE_ME` 占位符。

（可选）`shared/deploy.env`，用于改默认行为：

```bash
KEEP_RELEASES=3                                   # 保留几个历史版本
NPM_REGISTRY=https://registry.npmmirror.com       # 国内加速 npm ci
# PATH=/www/server/nodejs/v22.11.0/bin:$PATH       # 用宝塔 Node 管理器时补 PATH
```

### 3.6 PM2 开机自启（一次性）

```bash
sudo -u deploy bash -l -c 'pm2 startup'   # 按提示复制输出的 sudo 命令并执行
```

### 3.7 Nginx + 安全组

Nginx 参考 [deploy/nginx-blog.conf.example](./deploy/nginx-blog.conf.example)：宝塔里把站点「配置文件」中自动生成的 `location /` 段替换掉，关键是整站反代 `127.0.0.1:3000` + `proxy_buffering off`（AI 流式对话）+ `client_max_body_size 10m`（图片上传）。改完 `nginx -t && nginx -s reload`。

证书：域名不变的话在新机器上重新申请一次 Let's Encrypt 即可（旧证书绑定旧机器路径）。

阿里云安全组**只放行 22 / 80 / 443**；`3000`、`4000` 绝对不要对公网开放。

### 3.8 首次发布

Actions → Deploy → Run workflow → `action=deploy`。跑完应该看到：

```
✔ blog-server 健康检查通过（第 3 次）
✔ blog-web 健康检查通过（第 2 次）
✔ 发布成功：20261020-1327-672de74
```

然后 `curl -I https://你的域名` 与 `curl https://你的域名/api/health` 各验一次。

> 首次部署的一个已知特性：那一次前端构建时后端还没起过，`generateStaticParams` 拿不到文章列表 → 文章详情页不会预渲染，而是在**首次访问时按需生成并缓存**（`dynamicParams` 默认 true）。从第二次发布开始就是全量 SSG。想立刻拿到全量静态页，第一次上线后再触发一次 `action=deploy` 即可。

---

## 四、日常：改完代码就 push

```bash
git add -A
git commit -m "feat: xxx"
git push origin main      # 剩下的交给流水线
```

- **PR**：只跑 `verify`（两端 `tsc` + 前端 `eslint`），不部署 —— 适合提 PR 前自查；
- **main**：`verify` 通过 → 自动发布，`Actions → Deploy` 里能看完整日志；
- 每次发布生成新目录，`KEEP_RELEASES` 之外的旧版本自动清理。

> 前端 lint 与类型检查我刚在本地跑过（`tsc --noEmit` 两端 + `eslint .`），当前代码是干净的，流水线第一次跑不会因为历史遗留问题红掉。

---

## 五、回滚

**方式一（推荐）**：Actions → Deploy → Run workflow → `action=rollback`。切到上一个**构建完整**的历史版本，不重新构建，通常 10 秒内完成。

**方式二（服务器上）**：

```bash
bash /www/wwwroot/personal-blog/current/deploy/deploy.sh rollback
bash /www/wwwroot/personal-blog/current/deploy/deploy.sh status     # 看当前版本/进程/健康
```

**自动回滚**：发布后健康检查（`/api/health`、`/`）连续失败，`deploy.sh` 会自己把 `current` 切回上一版并重启，CI 任务标记失败。所以「新版把线上搞挂了」通常表现为一次红色构建，而不是站点长时间 502。

注意：回滚只切换**代码**，不回滚数据库。如果这次发布带了破坏性的表结构变更，需要手工处理数据。

---

## 六、老服务器 → 新服务器数据迁移（这次真正要做的动作）

代码可以由流水线搬，**数据库和图片不行**。老机器过期前按这个顺序来：

### 6.1 在老机器上导出

```bash
# ① 数据库（单事务导出，不锁表；注意库名）
mysqldump -u root -p --single-transaction --routines --triggers \
  --default-character-set=utf8mb4 jianli | gzip > /root/jianli-$(date +%F).sql.gz

# ② 文章图片
tar czf /root/uploads-$(date +%F).tar.gz \
  -C /www/wwwroot/personal-blog/blog-server uploads

# ③ 环境变量（手工带走，别贴到公开渠道）
cat /www/wwwroot/personal-blog/blog-server/.env
cat /www/wwwroot/personal-blog/blog-fronted/.env.local
```

### 6.2 传到新机器并还原

```bash
scp /root/jianli-*.sql.gz /root/uploads-*.tar.gz root@<新ECS_IP>:/root/

# 数据库（先在宝塔里建好 jianli 库和 blog_app 账号）
gunzip -c /root/jianli-*.sql.gz | mysql -u blog_app -p jianli

# 图片
mkdir -p /tmp/blog-uploads && tar xzf /root/uploads-*.tar.gz -C /tmp/blog-uploads
rsync -a /tmp/blog-uploads/uploads/ /www/wwwroot/personal-blog/shared/uploads/
chown -R deploy:deploy /www/wwwroot/personal-blog/shared/uploads

# 环境变量：拷贝到 3.5 生成的两个文件里（值照抄老机器）
```

### 6.3 切换域名（把停机时间压到最短）

1. **提前一天**把 DNS 的 TTL 调到 60~300 秒（阿里云云解析里改）；
2. 新机器先用 `https://新IP` 或临时 hosts 自测：首页、文章详情、登录、发文章、上传图片；
3. 改 A 记录指向新 IP，等 TTL 生效；
4. 老机器**先别释放**，挂 24–48 小时观察（回滚就是把 A 记录改回去）。

### 6.4 迁移后核对

- [ ] 首页 / 简历页 / 文章列表 / 文章详情都能打开，图片正常（说明 uploads 迁到位）
- [ ] 老文章里的图片路径仍然是 `/uploads/xxx`，没写成绝对地址（域名不变则无感）
- [ ] admin 能登录（JWT_SECRET 与老机器一致，老 token 也不会全失效）
- [ ] 发一篇测试文章 → 前端**立即**能看到（`REVALIDATE_SECRET` 两端一致）
- [ ] `pm2 ls` 两个进程 online，重启服务器后自动拉起（`pm2 save` + `pm2 startup`）
- [ ] `shared/uploads` 已在宝塔计划任务里每日备份，数据库也做了备份

---

## 七、排错

| 现象 | 原因 / 处理 |
|---|---|
| CI 报 `node: command not found` | 非交互式 SSH 不加载 nvm/宝塔的 PATH。`deploy.sh` 会自动找 `/www/server/nodejs/*/bin`、`~/.nvm/...`；仍不行就在 `shared/deploy.env` 里写 `PATH=...:$PATH` |
| `pm2: command not found` | pm2 装在了 root 名下。用 `su - deploy -c 'npm i -g pm2'` 重装 |
| `deploy.sh` 报 `CHANGE_ME` | `shared/backend.env` / `frontend.env.local` 还没填真实值（这个检查是故意的） |
| 后端起不来、日志里有 `Invalid environment variables` | `backend.env` 缺项或类型不对（zod 强校验，缺 `JWT_SECRET`/`MYSQL_DATABASE` 等直接退出）。`pm2 logs blog-server --lines 50` |
| 后端日志 `EADDRINUSE :4000` | 还有手工 `npm start` 或上一版孤儿进程：`pm2 delete blog-server && pm2 startOrReload ... `，或 `ss -lntp \| grep 4000` |
| 前端健康检查失败、日志 `Could not find a production build` | `next build` 没产物（多见于构建被打断）。重新触发一次发布 |
| 构建卡住很久在 `next/font/google` | 项目用 `Outfit` 字体，构建期要访问 `fonts.googleapis.com`；国内 ECS 可能超时。解法：给构建机配代理（在 `shared/deploy.env` 写 `https_proxy=...`），或把字体改成 `next/font/local` 放本地 woff2 |
| `CORS 403` | `CORS_ORIGIN` 不是浏览器实际访问的域名（改完 `shared/backend.env` 要重新发布/重启） |
| 发文后页面不刷新 | 两端 `REVALIDATE_SECRET` 不一致 —— `deploy.sh` 会 `!` 警告，CI 日志里搜「不一致」 |
| `rsync: Permission denied` | `deploy` 对 `APP_ROOT` 没有写权限：`chown -R deploy:deploy /www/wwwroot/personal-blog` |
| 磁盘越用越少 | 调小 `KEEP_RELEASES`（如 2）；`deploy.sh status` 会打印 releases/uploads 占用 |

---

## 八、可选增强（按需，不急）

1. **构建产物缓存**：`npm ci` 每次全量装（约 60–90 秒/端）。要更快可以在服务器上配 `NPM_CONFIG_CACHE` 或换 pnpm store。
2. **图片上对象存储**：`shared/uploads` 迁到阿里云 OSS，ECS 换机/扩容时数据彻底解耦（顺带解决图片走不了 CDN 的问题）。
3. **数据库上 RDS**：同理，ECS 只是计算节点，换机不再需要 dump/import。
4. **阿里云效替代 GitHub Actions**：如果 runner 连国内 ECS 抖动明显，可以把 `deploy/deploy.sh` 原样复用，只在云效里写「构建 → 执行脚本」两步。
5. **发布通知**：在 deploy 步骤后加一个 webhook（企业微信/飞书/邮件），失败立即知道。

---

## 附：本地手工执行（排查用）

```bash
# 在服务器上，等价于 CI 的一次发布（先手动 rsync 一份代码到 releases/）
bash /www/wwwroot/personal-blog/releases/<目录>/deploy/deploy.sh deploy /www/wwwroot/personal-blog/releases/<目录>
bash /www/wwwroot/personal-blog/current/deploy/deploy.sh status
bash /www/wwwroot/personal-blog/current/deploy/deploy.sh rollback
```
