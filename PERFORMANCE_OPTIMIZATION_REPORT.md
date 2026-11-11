# 性能优化报告（2026-11-11）

对应方案：`PERFORMANCE_OPTIMIZATION_PLAN.md`。本次在 `main` 分支分批提交，所有数字均可用文末命令复现。

## 一、结论

| 指标（Lighthouse 移动端，4× CPU + 慢 4G 模拟） | 优化前 | 优化后 |
| --- | --- | --- |
| 首页 Performance | 90 | **97** |
| 首页 LCP | 3.1 s（LCP 元素是 5 MB 远程视频） | **1.1 s** |
| 博客列表 Performance | 85 | **97** |
| 博客列表 LCP | 3.9 s | **1.0 s** |
| 博客详情 Performance | — | **98** |
| 博客详情 LCP | — | **1.1 s** |
| CLS（三个页面） | 0 ~ 0.247 | **0** |
| TBT（三个页面） | 170 ~ 210 ms | 180 ~ 200 ms |

桌面端三个页面均为 **100 分**（LCP 0.7 ~ 0.9 s）。

滚动流畅度（headless Chrome，桌面 1280×800，4 s 滚动采样）：

| 页面 | 优化前 | 优化后 |
| --- | --- | --- |
| 首页 | 60 帧，p50 65.9 ms，p95 124.5 ms，59 帧 > 50 ms | 242 帧，p50 16.6 ms，p95 18 ms，0 帧 > 25 ms |
| 博客列表 | 70 帧全部 > 25 ms，p50 56.9 ms | 242 帧，p50 16.6 ms，0 帧 > 25 ms |

结论：全站「滚动/移动鼠标卡顿」的主因是**大面积高斯模糊图层 + 每帧重算渐变 + 5 MB 远程视频解码**，不是主线程长任务（long task 始终为 0）。换成等价但走合成层的实现后，滚动回到 60 fps 档位。

## 二、改动清单

### 运行时（卡顿主因）

| 文件 | 改动 |
| --- | --- |
| `blog-fronted/src/components/common/BgOrbs/index.tsx` | 去掉 3 个光晕的 `blur-[120px]`，改为静态径向渐变（`radial-gradient` + `color-mix`）；动画只保留 transform，不再让浏览器每帧重算大模糊层 |
| `blog-fronted/src/components/common/CursorGlow/index.tsx` | 不再用 `useMotionTemplate` 每帧生成 `radial-gradient` 背景；改为固定尺寸光斑用 spring 的 `x/y` transform 跟随鼠标 |
| `blog-fronted/src/app/(site)/layout.tsx` | 首页壁纸视频本地化；首屏只展示 CSS 海报（`hero-poster-sm.jpg` 17.9 KB），视频在用户首次 `pointermove/scroll/wheel/touchstart` 后再挂载 |
| `blog-fronted/src/lib/motion.ts` | `fadeUp` 由「opacity + blur(6px) + y」改为只动 `y`：首屏文字在 HTML 里立即可见，不再把 LCP 拖到 hydration 之后，也去掉大字号模糊动画 |
| `blog-fronted/src/app/(site)/layout.tsx` | 删除整页路由切换的 `opacity: 0 → 1` 包裹 |
| `blog-fronted/src/views/blog/index.tsx` | 列表项去掉 `Reveal` + `opacity/x` 入场，只保留 hover 位移；首屏列表立即可见、DOM 动画层更少 |

### 资源与按需加载

| 文件 | 改动 |
| --- | --- |
| `public/media/hero-loop.mp4` | 远程 5,001,221 B（1920×1080/30fps/4 Mbps）→ 本地 607 KB（1280×720/24fps/x264 CRF31/无音轨/faststart） |
| `public/media/hero-poster.jpg` / `hero-poster-sm.jpg` | 66 KB 桌面海报 / 17.9 KB 移动海报；`index.css` 的 `.hero-wallpaper` 在 ≤860px 时换小图 |
| `views/admin/ArticleEditor.tsx` | `MdxPreview` 改为 `next/dynamic({ ssr: false })`，unified/remark/rehype（44.5 KB gzip）只在点开预览时加载 |
| `views/blog/index.tsx`、`views/blog-detail/index.tsx`、`views/admin/ArticleEditor.tsx` | `SafeImg` 补 `sizes`；详情封面加 `priority` |

### 数据层

| 文件 | 改动 |
| --- | --- |
| `hooks/queries/useArticleQueries.ts`、`useTagQueries.ts` | 列表/标签查询 `staleTime: 5 min`，避免 SSG 注水后挂载即重复请求 |
| `blog-server/internal/database/database.go` | 连接池 `MaxIdleConns(0)` → `10`，并设 `ConnMaxLifetime(30m)`/`ConnMaxIdleTime(5m)`：旧配置每个请求新建 MySQL 连接，并发压测会把本机临时端口耗尽（实测大量 500） |

### 后端观测（测量，不改搜索语义）

`blog-server/scripts/api-bench.mjs`（node:http keep-alive，4 并发 3 s）：

| 接口 | requests | errors | p50 | p95 | p99 |
| --- | --- | --- | --- | --- | --- |
| `/api/health` | 17519 | 0 | 0.6 ms | 1.1 ms | 1.9 ms |
| `/api/articles?page=1` | 7421 | 0 | 1.5 ms | 2.4 ms | 3.3 ms |
| `/api/articles?page=2` | 8911 | 0 | 1.2 ms | 1.9 ms | 2.4 ms |
| `/api/tags` | 13576 | 0 | 0.8 ms | 1.3 ms | 1.8 ms |
| `/api/site-content/plan` | 14632 | 0 | 0.7 ms | 1.2 ms | 1.5 ms |
| `/api/site-content/homeProjects` | 14016 | 0 | 0.8 ms | 1.2 ms | 1.7 ms |

EXPLAIN（当前 12 行数据）：

- 文章列表：`type=ALL` + `Using filesort`（`ORDER BY createdAt DESC, id ASC` 与单列索引 `articles_created_at` 不匹配）；
- 按主标签筛选：`tags.name` const + `articles_primary_tag_id ref`，仍有 filesort；
- 搜索：`title/excerpt/content LIKE '%kw%'` 全表扫描 + filesort（语义不变，未改）；
- 标签计数：`tags` 全表 + `Using temporary; Using filesort`。

实测单次 0.2 ~ 0.9 ms，**当前数据量下不加索引**；数据量上来后再评估 `(createdAt, id)`、`(primaryTagId, createdAt, id)` 与全文索引。

## 三、未做项与理由

- **motion 43.4 KB gzip 换成 LazyMotion/`m`**：需要改全站十几个组件的导入与 `m` 前缀，收益主要在包体积而非本次卡顿；留作后续独立改动。
- **axios（17.1 KB gzip）换 fetch**：同理，收益有限且改动面大。
- **prefers-reduced-motion**：按用户选择不处理，统一观感。
- **Go 搜索语义/索引**：无慢查询证据，按方案要求不改。
- **Nginx/HTTP2 实际部署**：只补了配置示例（`deploy/nginx-blog.conf.example`），未在服务器执行。

## 四、发布注意

- `/blog`、`/blog/[id]` 是 SSG/ISR。**构建时必须能访问后端**，否则预渲染出的 HTML 不含列表，首屏要等客户端补数据（会出现布局位移、LCP 变差）。发布流程里请保证构建阶段 API 可用，或在切换后触发一次后端 revalidate。
- `deploy/nginx-blog.conf.example` 已补：upstream keepalive、gzip、`/_next/static` 与 `/uploads` 一年 immutable、`/api` no-store、HTTP/2。

## 五、复现命令

```bash
# 包分析（不进默认 dev/build）
cd blog-fronted && npm run analyze
node scripts/bundle-baseline.mjs --top=15

# Lighthouse（需先启动 Go:4000 与 next start:3200）
npx lighthouse http://localhost:3200/home --chrome-flags="--headless=new --no-sandbox" --output=json --output-path=../perf-baseline/home-mobile.json
npx lighthouse http://localhost:3200/home --preset=desktop ...

# 滚动采样
node scripts/perf-profile.mjs --url=http://localhost:3200/home --out=../perf-baseline/profile-home.json

# API 压测（先启动后端）
cd blog-server && node scripts/api-bench.mjs http://127.0.0.1:4000 3
```
