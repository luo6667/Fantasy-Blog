# 个人博客性能优化方案（必要改动版）

## 结论

项目使用 Next.js 16 App Router + Go/Gin + MySQL。App Router 已自动按 `page.tsx` 路由分包，因此不要全站再做“路由懒加载”。本轮应优先处理图片传输、包体积可见性、后台重组件、首屏重复请求、API/数据库依据和生产传输配置。

## 必做项

### 1. 为响应式图片补齐 `sizes`

**位置：** `blog-fronted/src/components/common/SafeImg/index.tsx` 及首页、文章列表、文章详情调用处。

`SafeImg` 基于 `next/image`，但允许不传 `sizes`。这会使响应式大图可能下载超过实际显示尺寸的资源，直接影响移动端 LCP。

- 首页首屏图提供实际宽度规则，如 `(max-width: 768px) 100vw, 50vw`。
- 文章卡片和正文图按容器宽度提供 `sizes`。
- 只给真实 LCP 图使用 `priority`；其余保持懒加载。
- 保留明确宽高或比例，避免 CLS。

**验收：** LCP 图请求尺寸与实际显示尺寸匹配，CLS ≤ 0.1。

### 2. 加入 Bundle 分析和包体积基线

**位置：** `blog-fronted/package.json`、Next 构建配置、CI/发布脚本。

当前依赖含 `motion`、Markdown 渲染链（`unified`、`remark-*`、`rehype-*`）和 React Query。没有构建分析，无法知道它们是否进入公开页面的初始包。

- 添加可重复执行的 bundle analysis 命令。
- 每次生产构建输出公开路由和后台路由的初始 JS 大小。
- 为首页、博客列表、文章详情建立基线；单次增长超过 10% 必须说明原因。
- 分析工具不得默认运行在普通开发命令中。

**验收：** 能定位每个大依赖进入了哪个路由包，并保留优化前后数据。

### 3. 仅按分析结果动态加载后台重组件

**位置：** `blog-fronted/src/views/admin/ArticleEditor.tsx`、规划/简历编辑器及页面入口。

后台编辑器包含表单、上传、动画和可能的 Markdown 逻辑。它们不应影响公开页面；但只有包分析证明它们是大块时才值得拆分。

- 先完成第 2 项，再对确认偏大的编辑器/Markdown 预览使用 `next/dynamic`。
- 不拆分普通按钮、字段、小型展示组件。
- 使用固定高度加载骨架，避免加载时布局跳动。
- 编辑、上传、主标签/子标签保存行为保持不变。

**验收：** 后台非编辑页初始 JS 减少；加载编辑器时无控制台错误和明显 CLS。

### 4. 消除首屏重复请求与串行瀑布

**位置：** `blog-fronted/src/hooks/queries/`、`blog-fronted/src/lib/api.ts`、`blog-fronted/src/app/(site)/`。

项目同时使用 ISR/服务端预取与 React Query hydration。若 query key 或 stale time 不一致，浏览器会重复请求服务端已经取得的数据。

- 用 Network 记录首页、博客、详情、规划、简历的实际请求。
- 服务端已注水的数据使用一致 query key 和合理 stale time。
- 相互独立的数据读取并行执行，不得无故串行。
- 后台写入后精确失效相关 query，不能为缓存显示旧内容。

**验收：** 首屏没有同一资源的重复 API 请求；更新内容后能在预期时间看到新数据。

### 5. 为 Go API 和 MySQL 建立性能依据

**位置：** `blog-server/internal/service/article.go`、相关路由/中间件、迁移索引。

文章列表已有分页和 `primaryTagId` 索引，不能凭感觉重写。已知潜在热点是搜索的 `title/excerpt/content LIKE '%关键词%'`：数据量增大后普通索引无法有效使用。

- 记录文章列表、详情、主标签、站点内容、搜索的 p50/p95/p99。
- 在代表性数据量下对列表、主标签筛选和搜索执行 `EXPLAIN`/`EXPLAIN ANALYZE`。
- 确认主标签筛选命中 `articles_primary_tag_id` 索引。
- 只有搜索被证实为慢查询时，才设计 MySQL FULLTEXT 或搜索服务；本轮不提前改变搜索语义。
- 日志只记录路由、状态码、总耗时和数据库耗时，禁止记录 token、密码或完整请求体。

**验收：** 关键公开 API p95 ≤ 200 ms；若搜索不达标，需留下可复现的 query plan 和单独任务。

### 6. 验证生产压缩、缓存和连接复用

**位置：** Nginx/反向代理配置、部署文档、Go 服务启动配置。

- 启用并验证 HTTP/2、gzip 或 Brotli、keep-alive。
- Next 哈希静态资源和上传图片保持长期 immutable 缓存。
- HTML、管理员 API 和写接口不得设置公共长缓存。
- 核验文章更新后的 ISR/revalidate 不会被代理缓存掩盖。

**验收：** 响应头和资源类型匹配；文章更新后博客列表与详情不会持续显示旧内容。

## 当前不该做的事

- 不给所有路由加 `React.lazy()` 或 `next/dynamic()`；App Router 已按路由分包。
- 不给所有组件套 `memo`、`useMemo`、`useCallback`；仅在 Profiler 证明成本后使用。
- 不为所有 API 加缓存；公开内容已有 ISR，后台写接口不能被共享缓存。
- 不在没有慢查询证据时替换搜索实现。
- 不以降低图片质量、删除内容或牺牲 SEO/可访问性换取表面分数。

## 执行顺序

1. 生产构建并记录路由包大小；用 Lighthouse/Network 建立首页、博客、详情、规划、简历基线。
2. 完成图片 `sizes` 审计和修复，复测 LCP/CLS。
3. 检查并修复确认存在的 React Query 重复请求或串行瀑布。
4. 根据 bundle analysis 决定后台编辑器是否动态导入。
5. 对 Go API/MySQL 做耗时与 SQL 采样，只优化实测热点。
6. 固化包体积、Lighthouse、API 耗时检查，防止后续回退。

## 验收标准

| 指标 | 目标 |
| --- | --- |
| Lighthouse Performance（桌面） | ≥ 90 |
| Lighthouse Performance（移动） | ≥ 80 |
| LCP | ≤ 2.5 秒 |
| CLS | ≤ 0.1 |
| INP | ≤ 200 ms |
| 关键公开 API p95 | ≤ 200 ms |

每项改动必须有前后对比数据；无可测量改善的复杂度应撤销，不保留“可能有用”的优化代码。
