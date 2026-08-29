# JasonLuo 个人主页 & 博客 — 项目学习指南

> 目标:按顺序读完本文,配合代码注释,即可吃透整个项目(前端 Next.js + 后端 Express)。
> 建议边读边在 `blog-fronted` 和 `blog-server` 里打开对应文件对照。

---

## 1. 技术栈地图

| 层 | 技术 | 用在哪 |
|---|---|---|
| 前端框架 | **Next.js 16 (App Router)** + React 19 + TypeScript | `blog-fronted/src/app/` 文件系统路由 |
| 样式 | **Tailwind CSS v4**(CSS 变量 + `@custom-variant` 做暗色) | `src/index.css`,类名直接写在 JSX |
| 数据获取 | **TanStack Query v5**(缓存/加载态/失效刷新) | `src/lib/queryClient.ts`、`hooks/queries/` |
| 渲染模型 | **SSG + ISR + on-demand revalidate**(博客/简历内容) | `blog/[id]/page.tsx`、`api/revalidate/route.ts` |
| HTTP 客户端 | **axios**(拦截器 + 统一解包) | `src/lib/api.ts` |
| 状态管理 | **zustand**(登录态 / 主题) | `src/stores/` |
| 动画 | **motion**(framer-motion 新包名) | `src/lib/motion.ts`、各视图 |
| 校验 | **zod** | 前后端都用(后端请求体校验) |
| 后端框架 | **Express 5** + TypeScript(ESM, NodeNext) | `blog-server/src/app.ts` |
| ORM | **Sequelize 6** + MySQL 8 | `models/`、`services/` |
| 鉴权 | **jsonwebtoken** + **bcryptjs**(模型 hook 哈希) | `services/auth.service.ts`、`middleware/auth.ts` |
| 文件上传 | **multer**(内存存储 + magic bytes 类型嗅探) | `middleware/upload.ts` |
| 实时输出 | **SSE**(仅 AI 流式对话;已无 WebSocket) | `services/ai.service.ts` + 前端 `aiChatStream` |
| 安全 | helmet、express-rate-limit、CORS 白名单 | `app.ts`、`middleware/rateLimit.ts` |

---

## 2. 架构全景(两条主线)

```
┌─────────────────────── 前端 (Next.js, :3000) ───────────────────────┐
│  app/(site)/home/page.tsx ──(RSC, 可服务端取数 + ISR 缓存)──┐        │
│  views/home/index.tsx (client) ◄───────────────────────────┘        │
│      │                                                            │
│      ├─ hooks/queries/useXxxQuery ──► lib/api.ts (axios)          │
│      │                                     │                      │
│      │                                 /api 同源(浏览器)            │
└──────┼─────────────────────────────────────┼──────────────────────┘
       │                                     │ next.config rewrites 代理
┌──────┼─────────────────────────────────────┼──────────────────────┐
│      ▼                                     ▼                      │
│  Express 后端 (:4000)  routes → controllers → services → models   │
│  middleware: 限流 → JWT 鉴权 → zod 校验 → 控制器                    │
│  Sequelize → MySQL (jianli 库, JSON 列存数组/文档)                  │
└────────────────────────────────────────────────────────────────────┘
   │ 写操作成功(文章/站点内容) → fetch /api/revalidate → revalidatePath 重建静态页
```

**核心结论**:前后端完全分离,前端通过 `/api` 同源代理访问后端;数据流是
`页面(hooks) → api.ts(axios) → Express 路由 → 控制器 → 服务 → Sequelize 模型 → MySQL`,
返回时按同一链路反向走,统一 `{ code, msg, data }` 结构。

### 2.1 渲染模型:SSG / ISR / CSR 怎么分工(本项目的核心设计)

| 数据特征 | 用什么 | 本项目例子 |
|---|---|---|
| 公开 + 改动不频繁(写一次读多次) | **SSG** 构建时预渲染进 HTML | 博客列表/正文、简历内容、首页 |
| 内容不常变但有更新 | **ISR**(`revalidate`)定期按需重建 | 各静态页 `export const revalidate = 3600` |
| 写完要立刻生效 | **on-demand revalidate** 写操作后重建 | 后端调 `/api/revalidate`(见下) |
| 实时/交互/因人而异 | **CSR** 客户端 fetch | 评论、点赞、搜索、AI、admin |

**「发布即更新」链路**:前端内容静态化后,发文章不会自动反映到页面。所以后端在
`article.service.ts`(增删改)与 `siteContent.service.ts`(更新)成功后调用
`revalidateNext(['/blog', '/blog/[id]'])` → fetch 前端 `app/api/revalidate/route.ts`
(secret 校验)→ `revalidatePath` 重建静态页。**评论/点赞不走这条链**——它们不在
静态 HTML 里,客户端 `invalidateQueries` 即刷新生效。

---

## 3. 学习路线(按顺序)

### 3.1 先跑起来

1. `blog-server`:复制 `.env.example` 为 `.env` 填 MySQL 账号 → `npm run dev`(tsx watch, :4000)
2. `blog-fronted`:`npm run dev`(Next.js, :3000)
3. 打开 `http://localhost:3000`,点进博客、后台(admin / 123456)、发评论

> 关键点:浏览器访问前端页面时,`/api/*` 请求被 `next.config.ts` 的 rewrites 转发到后端 —— 所以前端代码里看不到任何后端地址,都是相对路径 `/api`。

### 3.2 前端入口与路由(先读这几个文件)

| 顺序 | 文件 | 要点 |
|---|---|---|
| 1 | `next.config.ts` | rewrites 代理(前后端桥) |
| 2 | `src/app/layout.tsx` | 根布局:字体、metadata、主题防闪白脚本、QueryProvider |
| 3 | `src/app/(site)/layout.tsx` | 路由组布局:顶栏/底栏/路由淡入(整站共享) |
| 4 | `src/app/page.tsx` | 封面页(Server Component + 拆分出的 client 子组件) |
| 5 | `src/app/(site)/home/page.tsx` | **RSC 示例**:服务端取数 + ISR 缓存,props 传给 client 视图 |
| 6 | `src/app/(site)/blog/[id]/page.tsx` | **SSG 示例**:generateStaticParams 构建时枚举文章,正文预渲染进 HTML |
| 7 | `src/app/api/revalidate/route.ts` | **on-demand revalidate 入口**:后端写操作后重建静态页 |

> 概念:App Router 里 `(site)` 是**路由组**(括号目录不参与 URL)。`layout.tsx` 是共享外壳,
> `page.tsx` 是页面。标了 `'use client'` 的是客户端组件,没标的是 Server Component(RSC)。
> 组件边界规则:client 里可以引入 client;RSC 可以渲染 client 子组件(数据必须可序列化,如 props)。

### 3.3 前端:一次数据请求的旅程(以博客列表为例)

列表页现在是**两条路**:
- **首屏(SSG)**:page.tsx 构建时拉第一页文章 + 标签,经 props 预填给 client 视图
  (`views/blog` 用 `placeholderData` 预填,首屏直出、不发请求);
- **交互(CSR)**:搜索 / 标签筛选 / 无限滚动改变 query key,走正常客户端请求。

1. `views/blog/index.tsx` 调用 `useArticleListInfiniteQuery(tag, search, initialArticles)`(`hooks/queries/useArticleQueries.ts`)
2. hook 返回 `useQuery({ queryKey, queryFn })` —— queryKey 来自 `lib/queryKeys.ts`(全局统一,决定缓存归属)
3. `queryFn` 调 `articleApi.list()`(`lib/api.ts`)
4. axios 实例自动带 JWT;响应拦截器解包 `{ code, msg, data }`,非 0 code 抛 `ApiError`
5. 结果进入 TanStack Query 缓存;同 key 的组件(管理页/博客页)共享同一份数据
6. 增删改走 `useXxxMutation`,成功后 `invalidateQueries` 自动刷新相关查询 —— **不需要手动 refetch**

> 注意配置:`lib/queryClient.ts` 里 `staleTime: 30s`(短时间复用缓存)、
> `refetchOnWindowFocus: false`、`retry: 1`。

### 3.4 前端状态管理(zustand,替代了 Context)

- `stores/authStore.ts`:登录态。`login/register/logout/refresh`,模块加载时校验本地 token(`/auth/me`)
- `stores/themeStore.ts`:主题。写入 `<html data-theme>` + localStorage,驱动 Tailwind 暗色
- `hooks/useAuth.ts` / `useTheme.ts`:用 `useShallow` 做浅比较,只有字段变化才触发重渲染
- 为什么不用 Context:Provider 层层嵌套 + 整棵子树重渲染;zustand 直接订阅,组件按需取

### 3.5 后端:一次 API 请求的旅程(以「发表评论」为例)

```
POST /api/articles/:id/comments
  → routes/article.routes.ts:writeLimiter(限流) → requireAuth(验 JWT) → validateBody(zod 校验)
  → controllers/comment.controller.ts(取参)
  → services/comment.service.ts(业务:写库 + 生成通知)
  → models/Comment.ts / Notification.ts(Sequelize)
  → utils/response.ts ok() → { code:0, msg, data }
```

- **分层职责**:routes 只组装(路由 + 中间件);controllers 只取参 + 调 service + 响应;
  services 写业务(事务、通知、级联);models 定义表结构。
- **错误处理**:业务层抛 `HttpError(status, msg)`,全局 `middleware/error.ts` 按类型分发
  (HttpError / ZodError / Sequelize 校验 / 唯一约束 / multer / JSON 解析错误),
  未知错误记日志并返回 500,不泄露内部细节。
- **鉴权两个中间件**:`requireAuth`(登录即可,评论/点赞用)、`requireAdmin`(管理员,增删改用);
  `req.user` 由 `verifyToken` 注入。

### 3.6 后端关键功能拆解(吃透这些就吃透了业务)

| 功能 | 文件 | 关键点 |
|---|---|---|
| 注册/登录 | `services/auth.service.ts` | JWT payload 带 role;`verifyToken` 回查数据库;密码 bcrypt 哈希在模型 hook |
| 文章 CRUD | `services/article.service.ts` | 服务端 MDX 编译 + 消毒(`utils/mdx.ts` 防 XSS);标签必须存在于标签库 |
| 点赞/收藏 | `toggleArticleLike` | **事务 + 行锁**(`SELECT ... FOR UPDATE`)防并发;JSON 数组存 `"role:id"` + 冗余计数 |
| 评论树 | `CommentSection` + comment service | 扁平表 + parentId,前端 O(n) 构建父子映射;删除文章级联删评论 |
| 通知 | `services/notification.service.ts` | 点赞/评论/发文时创建;**无实时推送**,前端靠 Query 刷新 |
| 图片上传 | `middleware/upload.ts` | memoryStorage → **magic bytes 嗅探真实类型**(不信 Content-Type)→ UUID 文件名落盘 |
| AI 流式 | `services/ai.service.ts` + `hooks/useAiStream.ts` | 后端 SSE 透传上游;前端 `fetch + ReadableStream + AbortController` 支持中断 |
| 站点内容 | `services/siteContent.service.ts` | 首页/简历可编辑内容存一张表(key-value),后台改完前端 Query 自动刷新 |

### 3.7 主题与动画

- 主题:`index.css` 定义 `:root` 与 `[data-theme="dark"]` 两套 CSS 变量;
  Tailwind v4 用 `@custom-variant dark` 映射,组件里 `bg-surface`、`text-text-muted` 等类名自动切换
- 动画:`lib/motion.ts` 导出统一 variants(fadeUp)与 spring 配置;
  页面淡入在 `(site)/layout.tsx`(key=pathname 重触发);元素入场用 `Reveal` 组件 + `useInView`

---

## 4. 注意什么(坑与迁移残留)

1. **⚠️ `lib/preload.ts` 是 Vite 时代残留**:React.lazy 手动预加载在 App Router 中已无意义
   (Next.js 自带代码分割 + 预取),只是无害保留,可删。
2. **⚠️ `blog-server/dist/` 有过期产物**(socket.js、events.routes.js 等是 MongoDB 时代遗留,
   gitignored)。源码里已无 Socket.IO —— **当前项目没有实时推送**,
   SSE 仅用于 AI 流式。私信/聊天功能已下线(前端无 socket.io-client)。
3. **Sequelize JSON 列**:`tags`、`likedBy` 等存 MySQL JSON 列(保留 MongoDB 文档风格);
   JSON 列不能用普通索引,个人站数据量小没问题。点赞用 `JSON_CONTAINS` + 事务行锁。
4. **`noUncheckedIndexedAccess` / `noUnusedLocals` 是开着的**(前端 tsconfig):
   数组索引访问返回 `T | undefined`,模板字符串里插 number 会报
   `restrict-template-expressions` —— 改代码时注意,这也是 eslint 严格模式的一部分。
5. **环境变量**:后端 `.env` 不入库,`.env.example` 是模板;`JWT_SECRET` 生产必须换强随机值。
   前端服务端取数(`API_TARGET`)与 `metadataBase` 部署时要配置真实域名。
6. **主题闪白防护**:`layout.tsx` 的 `beforeInteractive` 内联脚本 + `themeStore` 模块级初始化,
   两者协作保证首屏主题正确 —— 别随意删。
7. **RSC 与 client 边界**:视图文件基本都标了 `'use client'`,只有 `app/` 下的 `page.tsx`
   可以做服务端取数(如首页贡献日历)。在 client 组件里直接用 fetch 不会经过代理的
   server 端环境,注意区分。
8. **⚠️ SSG 构建时后端必须在线(或优雅降级)**:`generateStaticParams` / 页面级取数在
   `next build` 时真实请求后端,所以每个取数点都 try/catch 降级(空列表/空壳页),
   保证后端不在时构建照常通过。
9. **⚠️ placeholderData 的坑**:给 TanStack Query 传 `initialData` 会把 `data`/`isLoading`
   类型收窄(loading/空列表分支被判死代码,eslint no-unnecessary-condition 报错),
   所以 SSG 预填一律用 `placeholderData`(语义等价:首屏直出 + 不写缓存)。
10. **on-demand revalidate 配置**:后端 `.env` 的 `NEXT_REVALIDATE_URL`(前端地址)与
   `REVALIDATE_SECRET`(与前端构建时 REVALIDATE_SECRET 同值)不设置 = 关闭即时刷新
   (等 ISR 周期或重新部署),不影响写操作本身。

---

## 5. 关键点速查表(面试 / 复习用)

- **前后端如何连通**:Next.js rewrites 把 `/api`、`/uploads` 代理到 Express,浏览器零跨域。
- **登录态如何流转**:登录 → token 存 localStorage → axios 拦截器自动带 `Bearer` →
  authStore 启动时 `/auth/me` 恢复 → `useAuth()` 提供 `isAdmin`。
- **数据缓存如何失效**:queryKey 前缀统一 → mutation `invalidateQueries` → 自动 refetch。
- **评论为何能即时看到**:不是实时推送,是发布后 invalidate 评论 key 重新拉取。
- **点赞为何安全**:事务 + 行锁 + JSON 数组去重 + 冗余计数(避免遍历大数组算 length)。
- **上传为何安全**:magic bytes 验真实类型(拒 SVG 等可执行内容)+ 随机文件名 + nosniff。
- **AI 如何流式**:后端 SSE 转发 OpenAI 兼容接口;前端 `fetch` 流式解析 `data:` 行,支持中断。
- **暗色主题如何切换**:`<html data-theme>` + CSS 变量 + Tailwind `@custom-variant`。
- **SSG 与 ISR 区别**:SSG 构建时生成一次;ISR = SSG + 定期/按需重新生成(`revalidate`)。
- **发布文章后页面如何立即更新**:后端写操作 → `revalidateNext` → `/api/revalidate` →
  `revalidatePath('/blog')` + `'/blog/[id]'`(重建全部详情页)。
- **评论为何不用 revalidate**:评论/点赞不在静态 HTML 里,客户端 `invalidateQueries` 即刷新生效。
- **哪些页面不该用 SSG**:实时/登录态/写操作(评论、admin、AI),全走 CSR。

---

## 6. 想改功能时从哪下手

| 想改什么 | 动哪里 |
|---|---|
| 页面文案/布局 | `views/` 下对应视图(如首页 `views/home/index.tsx`) |
| 新增一个后台管理项 | 后端 `routes/` + `controllers/` + `services/` + `models/`,前端 `views/admin/` + `hooks/queries/` |
| 改博客列表每页条数 | 前端 `useArticleListQuery`(pageSize)或后端 `listArticles` 上限 |
| 改 GitHub 贡献日历 | `lib/github.ts`(数据源/用户名)+ `components/common/GitHubContributions/`(渲染) |
| 换 AI 接口 | 后端 `services/ai.service.ts` 的 `normalizeBaseURL`,前端无需改 |
| 加实时通知 | 需要重新引入 Socket.IO(参考 dist 里残留的旧实现思路)或前端加轮询 |
| 改主题色 | `index.css` 的 `--color-accent` 等变量,亮暗两套 |
| 改静态页刷新周期 | 对应 `page.tsx` 的 `export const revalidate`(秒);即时刷新看后端 `revalidateNext` 与 `/api/revalidate` |
| 让发布后立即生效 | 前端 `app/api/revalidate/route.ts`(secret) + 后端写操作处调 `revalidateNext(paths)` |

---

## 7. 验证命令

```bash
# 前端:类型检查 / lint / 构建
cd blog-fronted
npm run type-check && npm run lint && npm run build

# 后端:类型检查
cd blog-server
npm run typecheck
```
