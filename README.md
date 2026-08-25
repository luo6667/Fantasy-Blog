# JasonLuo 个人主页 & 博客

前端工程师个人简历 + 博客系统,前后端分离部署于同一仓库。

## 项目结构

```
├── blog-fronted/          # 前端 — Next.js 16 (App Router) + React 19 + Tailwind CSS v4
│   └── src/
│       ├── app/           # App Router 页面与布局 (route groups: (site)/)
│       ├── components/    # 通用组件 (common/、layout/、ai/、comment/、auth/、notification/、providers/)
│       ├── views/         # 页面视图 (home、about、resume、blog、blog-detail、admin、cover、not-found)
│       ├── hooks/         # 自定义 hooks (queries/ 为 React Query 封装)
│       ├── stores/        # zustand 状态 (authStore、themeStore)
│       ├── lib/           # 基础设施 (api 客户端、queryClient、queryKeys、motion、utils)
│       ├── constants/     # 静态数据
│       └── types/         # 与后端对应的类型定义
└── blog-server/           # 后端 — Express 5 + TypeScript + Sequelize + MySQL
    └── src/
        ├── routes/        # 路由定义
        ├── controllers/   # 请求处理
        ├── services/      # 业务逻辑
        ├── models/        # Sequelize 模型
        ├── middleware/    # auth、error、rateLimit、upload、validate
        ├── config/        # 环境变量解析
        └── utils/         # logger、response、mdx
```

## 技术栈

| 端 | 技术 |
|---|---|
| 前端 | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · React Query · zustand · motion · zod |
| 后端 | Express 5 · TypeScript · Sequelize 6 · MySQL 8 · Socket.IO · JWT · multer |
| 其他 | Socket.IO 实时消息 · SSE (AI 流式对话) · MDX 渲染 |

## 环境要求

- Node.js >= 20
- MySQL 8 (本地或远程)

## 快速开始

### 1. 启动后端

```bash
cd blog-server
npm install
# 复制 .env.example 为 .env 并填写数据库账号密码
npm run dev        # 开发模式 (tsx watch)
```

### 2. 启动前端

```bash
cd blog-fronted
npm install
npm run dev        # 开发模式 (默认 http://localhost:3000)
```

前端通过 `next.config.ts` 的 rewrites 将 `/api/*` 与 `/uploads/*` 代理到后端
(`http://localhost:4000`,可用环境变量 `API_TARGET` 覆盖)。

### 3. 初始化管理员

```bash
cd blog-server
npm run seed
```

## 常用脚本

### blog-fronted

| 命令 | 说明 |
|---|---|
| `npm run dev` | 开发模式 |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务 |
| `npm run lint` / `lint:fix` | ESLint 检查 / 自动修复 |
| `npm run format` / `format:check` | Prettier 格式化 / 检查 |
| `npm run type-check` | TypeScript 类型检查 |

### blog-server

| 命令 | 说明 |
|---|---|
| `npm run dev` | 开发模式 (tsx watch) |
| `npm run build` | 编译到 dist/ |
| `npm run start` | 运行编译产物 |
| `npm run seed` | 创建/重置管理员账号 |
| `npm run typecheck` | 类型检查 |

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
