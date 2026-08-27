# 📖 JasonLuo 个人主页 & 博客 — 从零吃透指南

> 面向想彻底搞懂这个项目的人。按本文顺序读，配合代码里 `📘` 开头的教学注释，一天内可以建立完整心智模型。
> 项目已有 `LEARNING_GUIDE.md`（偏"复习速查"），本文是**主阅读路线**：先按本文走，再回头用 LEARNING_GUIDE 复习。

---

## 0. 这项目是什么（一句话）

一个**个人主页 + 博客系统**：Markdown 写文章、标签分类、点赞收藏、评论回复、通知、图片上传、AI 智能助手（流式对话）、后台管理（文章/标签/用户/站点内容/权限）。

**整体架构（先记住这张图）**：

```
┌─────────────────────────────────────────────────────────┐
│  浏览器（Next.js 16 前端，端口 3000）                      │
│  app/(site)/* 页面 → views/ 组件 → hooks/queries → lib/api │
│         │                        │                        │
│     /api 请求(HTTP)          /uploads 图片(静态)          │
└─────────┼────────────────────────┼───────────────────────┘
          │   next.config rewrites 同源代理（开发/生产）
          ▼                        ▼
┌─────────────────────────────────────────────────────────┐
│  Express 后端（端口 4000）                                │
│  app.ts → routes/ → controllers/ → services/ → models/  │
│  middleware: 限流 → JWT 鉴权 → zod 校验                  │
│                     ↓                                    │
│              MySQL（Sequelize，库名 jianli）              │
└─────────────────────────────────────────────────────────┘
```

两个服务：`blog-fronted/`（Next.js 16 + React 19）、`blog-server/`（Express 5 + Sequelize/MySQL）。

---

## 1. 技术栈总表（每项解决什么问题）

| 技术 | 在哪用 | 解决什么问题 | 备注 |
|---|---|---|---|
| **Next.js 16 (App Router)** | 前端 | 页面路由、服务端组件(RSC)取数、`next/font` 字体优化 | 路由组 `(site)` 共享布局 |
| **React 19 + TypeScript** | 前端 | UI 渲染、类型安全（tsconfig 开 `noUncheckedIndexedAccess` 很严格） | — |
| **TanStack Query** | 前端 | 请求缓存 + 加载态 + mutation 后自动失效刷新 | queryKey 全局统一（`lib/queryKeys.ts`） |
| **zustand** | 前端 | 登录态 / 主题 的全局状态 | 替代 Context，组件按需订阅 |
| **axios** | 前端 | HTTP 封装：自动带 JWT、统一解包 `{ code, msg, data }` | SSE 流式用原生 fetch |
| **motion** | 前端 | 动画（路由淡入、元素入场、3D 卡片） | framer-motion 新包名 |
| **unified + remark + rehype** | 前后端 | Markdown 解析 & 消毒成安全 HTML | 后端编译防 XSS，前端直接渲染 |
| **Tailwind CSS v4** | 前端 | 样式，CSS 变量 + `@custom-variant` 做暗色主题 | — |
| **Express 5** | 后端 | REST API 框架 | 分层：routes/controllers/services/models |
| **Sequelize 6 + MySQL 8** | 后端 | ORM：表 ↔ TS 类；JSON 列存数组 | 库名 `jianli` |
| **jsonwebtoken + bcryptjs** | 后端 | 登录签发 JWT（payload 带 role）、密码哈希（模型 hook） | `requireAuth` / `requireAdmin` |
| **zod** | 前后端 | 请求参数校验（后端 validateBody 中间件） | 前后端各自维护 |
| **multer** | 后端 | 图片上传（内存存储 + magic bytes 嗅探真实类型） | 拒 SVG 等可执行内容 |
| **SSE** | 前后端 | AI 流式对话（打字机效果） | 已无 WebSocket |
| **helmet / cors / express-rate-limit** | 后端 | 安全头 / 跨域白名单 / 写接口限流 | 生产必需 |

---

## 2. 怎么跑起来（先跑通再看代码）

前置：Node 18+、本地 MySQL（默认 `root/1234@127.0.0.1:3306`，库 `jianli`，**启动时自动建库建表**）。

```bash
# 后端（http://localhost:4000）
cd blog-server
cp .env.example .env        # 填 MySQL 账号，JWT_SECRET 至少 16 位
npm install && npm run dev

# 前端（http://localhost:3000）
cd blog-fronted
npm install && npm run dev
```

打开 `http://localhost:3000`：浏览博客 → 评论 → 后台（`/admin`，默认管理员密码看 `ADMIN_INITIAL_PASSWORD` 或 seed 脚本打印）→ 发文章、传图、开 AI 助手。

> 跑起来后用 Navicat 看一眼 `jianli` 库：`articles`、`comments`、`tags`、`users`、`notifications`、`site_contents` 等表，和 `models/` 一一对应。注意 `tags`、`likedBy` 这类**数组字段存的是 JSON 列**。

---

## 3. 阅读路径（推荐顺序，共 7 步）

### 第 1 步：先看前后端怎么连（建立整体感）
**文件**：`blog-fronted/next.config.ts`(📘) → `blog-server/src/app.ts`(📘)
**要点**：前端 `/api/*`、`/uploads/*` 被 rewrites 同源代理到 4000 —— 浏览器零跨域；后端 app.ts 组装中间件链和 9 组业务路由。

### 第 2 步：看后端配置与数据库（搞懂"数据存在哪"）
**文件**：`blog-server/src/config/env.ts`(📘) → `blog-server/src/db/sequelize.ts`(📘) → `blog-server/src/models/Article.ts`(📘)
**要点**：
- env.ts：zod 强校验环境变量，配错直接启动失败；
- **sequelize.ts 就是"怎么连 MySQL"的答案**：Sequelize 单例 + `ensureDatabase()` 自动建库；
- models/Article.ts：一个 Model = 一张表，JSON 列存数组、冗余计数、24 位 hex 主键。

### 第 3 步：看后端一次请求的完整旅程（核心，花最多时间）
以「发表评论」为例走链路（后端分层是重点）：

```
POST /api/articles/:id/comments
  → routes/article.routes.ts   (路由声明 + 限流 + requireAuth + validateBody)
  → controllers/comment.controller.ts  (取参 + 调 service + 统一响应)
  → services/comment.service.ts        (业务：写库 + 生成通知)
  → models/Comment.ts / Notification.ts (Sequelize)
  → utils/response.ts ok() → { code:0, msg, data }
```

**配套读**：
| 文件 | 看什么 |
|---|---|
| `middleware/auth.ts`(📘) | JWT 鉴权：requireAuth / requireAdmin，req.user 注入 |
| `middleware/validate.ts`(📘) | zod 校验中间件：合法写回 req.body，非法 400 |
| `middleware/error.ts` | 全局错误处理：HttpError/ZodError/唯一约束/500 兜底 |
| `services/article.service.ts`(📘) | **最核心业务**：点赞事务+行锁、MDX 消毒、通知 |
| `utils/mdx.ts`(📘) | Markdown → 安全 HTML（防存储型 XSS） |

### 第 4 步：看前端数据流（数据怎么到页面）
**文件**：`blog-fronted/src/lib/api.ts`(📘) → `lib/queryClient.ts`(📘) → `lib/queryKeys.ts`(📘) → `hooks/queries/useArticleQueries.ts`(📘)
**要点**：
- api.ts：axios 封装（自动带 JWT、解包 `{code,msg,data}`、SSE 用 fetch）；
- queryKeys：缓存"地址"统一管理，mutation 后 invalidate 自动刷新；
- 页面组件用 `useArticleListQuery()` 等 hook 拿数据，不用手写 loading。

### 第 5 步：看前端状态与入口
**文件**：`app/layout.tsx`(📘 根布局) → `app/(site)/layout.tsx`(📘 路由组外壳) → `stores/authStore.ts`(📘 登录态) → `components/providers/QueryProvider.tsx`(📘)
**要点**：根布局是 Server Component；登录态用 zustand（启动时 `/auth/me` 恢复）；主题防闪白脚本。

### 第 6 步：看博客特色的三个功能
| 功能 | 文件 | 看点 |
|---|---|---|
| Markdown 渲染 | `components/common/MdxContent/index.tsx`(📘) | 渲染后端消毒过的 HTML，不自己解析 |
| 评论区 | `components/comment/CommentSection.tsx`(📘) | 扁平表 + parentId，O(n) 建评论树；折叠 |
| AI 智能助手 | `hooks/useAiStream.ts`(📘) + `lib/api.ts` 的 `aiChatStream` | fetch + ReadableStream 解析 SSE，支持中断 |

### 第 7 步：走一遍业务闭环
1. **登录**：`stores/authStore.login` → `/api/auth/login` → JWT 存 localStorage → axios 自动带；
2. **发文章**：后台编辑器 → `/api/articles` → 后端 MDX 消毒入库 → 通知普通用户 → 前端 invalidate 自动刷新列表；
3. **评论**：发表 → 入库 + 通知 → 前端刷新评论 key（**不是实时推送**，是刷新）；
4. **点赞**：事务 + 行锁 → JSON 数组去重 + 计数 → 通知作者；
5. **AI 助手**：前端 `aiChatStream` → `/api/ai/chat` → 后端 SSE 转发上游 → 打字机输出。

---

## 4. 核心机制详解（小白重点）

### 4.1 MySQL 是怎么连上的
```
config/env.ts   → MYSQL_HOST/PORT/USER/PASSWORD/DATABASE（默认 root/1234/jianli）
      ↓
db/sequelize.ts
  ① ensureDatabase()：mysql2 裸连（不指定库）→ CREATE DATABASE IF NOT EXISTS jianli
  ② new Sequelize(...)：ORM 单例，timezone '+08:00'
  ③ index.ts：connectDB() → sequelize.sync()（按 models/ 建表）→ seed 默认内容
      ↓
models/*.ts     → 每张表一个 Model
      ↓
services/*.ts   → Article.findAll(...) 等 ORM 查询
```

### 4.2 登录鉴权（JWT 全链路）
```
登录:用户密码 → auth.service 校验 bcrypt 哈希 → 签发 JWT(payload 带 role: user|admin, 7 天)
请求:axios 拦截器自动带 Authorization: Bearer <token>
校验:middleware/auth.ts 的 requireAuth/requireAdmin → verifyToken(回查数据库) → req.user
```

### 4.3 文章 XSS 防护（为什么 Markdown 安全）
```
发布:utils/mdx.ts  unified 管线
  remark-parse(Markdown) → remark-gfm → remark-rehype → rehype-sanitize(白名单过滤) → HTML
入库:存 contentHtml(已消毒)
渲染:前端 MdxContent 直接 dangerouslySetInnerHTML —— 不执行任何脚本
```

### 4.4 点赞为什么并发安全
```
toggleArticleLike:
  sequelize.transaction(async t => {
    Article.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });  // 行锁!
    likedBy 数组包含 "role:id" ? 移除 : 加入（JSON 列）
    likes 冗余计数 ±1
    doc.save({ transaction: t });
  })
```
行锁保证"点过则取消、没点过则点赞"的原子性；冗余计数避免读大数组算 length。

### 4.5 评论树怎么构建
- 后端存**扁平表**：每条评论有 `parentId`（回复指向父评论）；
- 前端 `CommentSection` 用 `buildRepliesMap` 一次 O(n) 遍历构建"父 → 子"映射；
- 回复超过 5 条折叠，只展示前 3 条。

### 4.6 图片上传为什么安全
```
middleware/upload.ts:
  multer memoryStorage（先存内存，不落盘）→ 读文件头的 magic bytes 嗅探真实类型
  （不信 Content-Type，拒 SVG 等可执行内容）→ UUID 随机文件名 → 落盘 uploads/
静态访问:app.ts express.static('/uploads', { immutable + nosniff })
```

### 4.7 AI 流式（SSE）怎么工作
```
前端 aiChatStream(fetch '/api/ai/chat', stream)
  → 后端 ai.service 转发 OpenAI 兼容接口(stream:true)
  → 响应 text/event-stream 逐块回传
  → 前端 reader 按行解析 "data: {...}"，取 delta 增量 → useAiStream 回调 onDelta
  → AbortController 支持中断(stop)
```

### 4.8 通知机制（无实时推送）
点赞 / 评论 / 发文时在 service 里 `createNotification()` 写 `notifications` 表；
前端用 `useNotificationsQuery` 拉取 + 轮询/手动刷新，**没有 WebSocket**。

---

## 5. 常用调试技巧

| 需求 | 做法 |
|---|---|
| 看后端收到什么请求 | `blog-server` 终端日志（utils/logger.ts）；或 Postman 直接打 4000 |
| 直接查数据 | `mysql -h 127.0.0.1 -u root -p1234 jianli -e "SELECT * FROM articles LIMIT 5;"` |
| 测试鉴权接口 | 先 `POST /api/auth/login` 拿 token，请求头带 `Authorization: Bearer <token>` |
| 看错误为什么 400/500 | 读 `middleware/error.ts` 的分类逻辑；业务错误在 service 里抛 `HttpError(status, msg)` |
| 改代码自动生效 | 后端 `npm run dev` 是 tsx watch；前端 Next dev 热更新 |
| 检查类型/规范 | 前端 `npm run type-check && npm run lint`；后端 `npm run typecheck` |

---

## 6. 教学注释索引（代码里搜 `📘`）

| 层 | 文件 |
|---|---|
| 前端入口/配置 | `blog-fronted/next.config.ts`、`src/app/layout.tsx`、`src/app/(site)/layout.tsx`、`src/app/(site)/home/page.tsx` |
| 前端数据层 | `src/lib/api.ts`、`src/lib/queryClient.ts`、`src/lib/queryKeys.ts`、`src/hooks/queries/useArticleQueries.ts`、`src/components/providers/QueryProvider.tsx` |
| 前端状态/特色 | `src/stores/authStore.ts`、`src/hooks/useAiStream.ts`、`src/components/common/MdxContent/index.tsx`、`src/components/comment/CommentSection.tsx` |
| 后端入口/配置 | `blog-server/src/index.ts`、`src/app.ts`、`src/config/env.ts`、`src/db/sequelize.ts` |
| 后端分层 | `src/models/Article.ts`、`src/middleware/auth.ts`、`src/middleware/validate.ts`、`src/services/article.service.ts`、`src/utils/mdx.ts` |

> 其它文件（controllers/routes/其他 models/services）结构相似：routes 声明路由 → controllers 取参响应 → services 写业务 → models 定义表，读通上面这些代表文件后就能举一反三。

---

## 7. 学习路线图（建议投入时间）

```
半小时  跑起来 + 看 next.config / app.ts / env.ts / sequelize.ts（建立骨架）
2 小时   第 3 步：后端一次请求的旅程 + article.service（最核心）
1 小时   第 4 步：前端数据流（api → queryKeys → hooks）
1 小时   第 6-7 步：Markdown 渲染 / 评论树 / AI 流式 + 业务闭环走一遍
1 小时   对照 4.x 详解过一遍核心机制（JWT/MDX/事务锁/SSE）
之后     按兴趣深入：上传 magic bytes、通知、GitHub 贡献日历、主题动画
```
