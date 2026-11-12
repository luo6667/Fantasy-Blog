# JasonLuo 个人主页 & 博客

前端工程师个人简历 + 博客系统,前后端分离部署于同一仓库。

## 项目结构

```
├── blog-fronted/          # 前端 — Next.js 16 (App Router) + React 19 + Tailwind CSS v4
│   └── src/
│       ├── app/           # App Router 页面与布局 (route groups: (site)/)
│       ├── components/    # 通用组件 (common/、layout/、providers/)
│       ├── views/         # 页面视图 (home、about、resume、plan、blog、blog-detail、admin、cover、not-found)
│       │                  # 后台：/admin/articles|plan|resume + /admin/login（共享 AdminShell）
│       ├── hooks/         # 自定义 hooks (queries/ 为 React Query 封装)
│       ├── stores/        # zustand 状态 (authStore、themeStore)
│       ├── lib/           # 基础设施 (api 客户端、queryClient、queryKeys、motion、utils)
│       ├── constants/     # 静态数据
│       └── types/         # 与后端对应的类型定义
└── blog-server/           # 后端 — Go 1.27 + Gin + GORM + MySQL 8
    ├── cmd/server/        # 入口与子命令 (migrate、seed-admin)
    ├── internal/          # config、model、service、handler、middleware、migrate
    ├── migrations/        # 版本化 SQL 迁移与核对表
    ├── deploy/            # systemd 示例与发布/回滚清单
    └── tests/             # 旧版快照 (fixtures/) 与冒烟脚本 (smoke/)
```

## 技术栈

| 端 | 技术 |
|---|---|
| 前端 | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · React Query · zustand · motion · zod |
| 后端 | Go 1.27 · Gin · GORM · MySQL 8 · JWT · bcrypt · goldmark |
| 内容模型 | 管理员专用认证 · 文章（1 主标签 + 自由子标签）· 站点内容 JSON · 图片上传 |
| 其他 | 按需刷新 (Next.js revalidate) · Markdown 渲染与净化 |

## 环境要求

- Go >= 1.27
- MySQL 8 (本地或远程)

## 快速开始

### 1. 启动后端

```bash
cd blog-server
# 复制 .env.example 为 .env 并填写数据库账号密码
go run ./cmd/server   # 开发模式 (默认 http://localhost:4000)
```

也可以使用 `scripts/dev.sh`：编译到 `bin/` 后启动，参数会透传
（如 `scripts/dev.sh migrate`）。

### 2. 启动前端

```bash
cd blog-fronted
npm install
npm run dev        # 开发模式 (默认 http://localhost:3000)
```

> 开发模式的页面是按需编译的，首次进入某个路由会慢一点；真实体验请以 `npm run build && npm start` 为准。

前端通过 `next.config.ts` 的 rewrites 将 `/api/*` 与 `/uploads/*` 代理到后端
(`http://localhost:4000`,可用环境变量 `API_TARGET` 覆盖)。

### 3. 初始化管理员

```bash
cd blog-server
go run ./cmd/server seed-admin   # 创建或重置管理员，密码读 ADMIN_INITIAL_PASSWORD
```

## 常用脚本

### blog-fronted

| 命令 | 说明 |
|---|---|
| `npm run dev` | 开发模式 |
| `npm run build` | 生产构建 |
| `npm run nav:timing` | 路由切换计时（需先启动 3000/3300 服务，验证首屏是否即时可见） |
| `npm run start` | 启动生产服务 |
| `npm run lint` / `lint:fix` | ESLint 检查 / 自动修复 |
| `npm run format` / `format:check` | Prettier 格式化 / 检查 |
| `npm run type-check` | TypeScript 类型检查 |

### blog-server

| 命令 | 说明 |
|---|---|
| `go run ./cmd/server` | 开发模式启动 (默认 :4000) |
| `scripts/dev.sh` | 编译到 `bin/` 后启动 |
| `scripts/dev.sh migrate` | 执行版本化 SQL 迁移 |
| `go run ./cmd/server seed-admin` | 创建/重置管理员账号 |
| `scripts/check.sh` | gofmt / vet / test / build 一键检查 |
| `go test ./...` | 单元测试 + MySQL 集成测试 |
| `bash tests/smoke/frontend.sh` | 前端 + 后端联调冒烟 |

## 部署

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## 目录说明与约定

- **前后端分离**:前端 Next.js 渲染,后端仅提供 REST API + 静态上传文件;
  CORS 由 `blog-server/.env` 的 `CORS_ORIGIN` 控制。
- **客户端边界**:页面/布局入口组件显式标注 `'use client'`,服务端组件不直接
  使用 hooks(React Query、zustand 均需在 client 组件内调用)。
- **SEO**:每个页面导出 `metadata` / `generateMetadata`,不通过客户端 JS 改
  `document.title`。
- **图片**:统一使用 `SafeImg` 组件(基于 `next/image`),加载失败时降级为占位块。
- **类型**:前后端类型手工同步维护,改接口时注意同步 `blog-fronted/src/types/`。
