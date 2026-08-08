# 上线部署说明（JasonLuo Blog）

前端 `blog-fronted`（Vite + React SPA）与后端 `blog-server`（Express + MongoDB）分离部署。
本文档列出上线前必须确认的配置项，以及一份可直接套用的 Nginx 反代配置。

## 一、上线前必须确认（环境变量）

在 `blog-server/.env` 中（**不要**提交到 git）：

```bash
NODE_ENV=production
PORT=4000

# 强随机密钥：openssl rand -hex 32 生成；泄露后所有 token 可伪造，务必替换
JWT_SECRET=<openssl rand -hex 32 的结果>
JWT_EXPIRES_IN=3d          # 建议从 7d 缩短到 3d

MONGODB_URI=mongodb://<user>:<password>@<host>:<port>/blog
# 使用 Atlas 时请开启 TLS；MongoDB 账号用最小权限，勿用 root

# 真实前端域名（逗号分隔多来源）
CORS_ORIGIN=https://blog.your-domain.com

# 可选：seed 建管理员时的初始密码（用完请清空该变量，防止重跑 seed 重置密码）
ADMIN_INITIAL_PASSWORD=
```

其他上线项：

- [ ] `index.html` 中 `og:url` / `canonical` 的 `https://your-domain.com/` 替换为真实域名
- [ ] favicon `/head.jpg` 可换成 32×32 的 `.ico`
- [ ] 用 `npm run seed` 创建管理员后，清空 `ADMIN_INITIAL_PASSWORD`
- [ ] `GET /api/users?search=` 现在必须带关键词才返回结果（防用户名枚举），聊天新会话需输入用户名搜索

## 二、构建与启动

```bash
# 后端
cd blog-server
npm ci && npm run build && npm run start

# 前端
cd blog-fronted
npm ci && npm run build   # 产物在 dist/
```

## 三、Nginx 反代配置（示例）

```nginx
server {
    listen 443 ssl http2;
    server_name blog.your-domain.com;

    # SSL 证书配置（Let's Encrypt / 云厂商证书）
    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # 前端静态资源（带 hash 的文件长缓存）
    root /var/www/blog-fronted/dist;
    index index.html;

    # SPA history 路由回退：刷新 /blog/:id 等深链时回到 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 带 hash 的构建资源：一年长缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API 反代
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # AI 流式对话（SSE）需要关闭缓冲
        proxy_buffering off;
        proxy_read_timeout 120s;
    }

    # 上传文件
    location /uploads/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
    }

    # Socket.IO（私信 / 通知实时推送）
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 60s;
    }
}
```

## 四、部署在反代之后必须改的代码点

后端限流默认**不信任代理**（`trust proxy` 关闭），部署在 Nginx 后所有请求按代理 IP
计数，会误伤正常用户。请打开 `blog-server/src/app.ts`，在 `const app = express();`
之后加一行（只信任一层代理）：

```ts
app.set('trust proxy', 1);
```

## 五、其他建议

- 给 MongoDB 开备份（Atlas 自带 / cron + mongodump）
- 服务器上 `npm start` 用 `pm2` 或 systemd 托管，崩溃自动重启
- 如域名走 HTTPS，`helmet()` 已默认启用 HSTS
- 上线后访问 `/api/health` 确认服务存活
