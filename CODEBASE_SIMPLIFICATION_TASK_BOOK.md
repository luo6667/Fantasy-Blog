# 代码审查与仓库瘦身任务书

## 目标

修复已确认的功能偏差，移除没有调用方或已过时的代码/配置，降低后续维护成本。严格保持当前产品功能：管理员登录、文章管理、主/子标签、规划、简历和首页项目管理。

## 执行规则

- 每项任务独立提交；不要把格式化、性能改造或新功能混入本次任务。
- 删除前先用 `rg` 确认没有运行时代码引用目标。
- 删除数据备份或重写 Git 历史前，必须先在仓库外保存可恢复副本，并由仓库管理员确认。
- 后端修改后运行 `go test ./...`、`go vet ./...`、`go build ./cmd/server`；前端修改后运行 `npm run lint`、`npm run type-check`、`npm run build`。

## 任务 1：恢复站点内容保存后的页面刷新

**优先级：P1**

**问题：** `UpdateSiteContent` 更新数据库后未触发 Next.js revalidate，公开规划、简历和首页项目可能显示旧内容直到 ISR 过期。

**改动：**

- 在 `blog-server/internal/service/sitecontent.go` 的更新成功路径中，按内容 key 调用现有 revalidate 机制。
- `plan` 刷新规划页；教育/技能/项目/评价刷新简历页；`homeProjects` 刷新首页。
- revalidate 失败不得回滚已成功的数据库写入，但应输出不含敏感数据的告警日志。

**验收：**

- [ ] 更新每个内容 key 后，正确请求对应的 Next revalidate 路径。
- [ ] 外部刷新失败时，更新 API 仍返回成功，且日志可定位失败。
- [ ] 为 key 与刷新路径映射增加单元测试。

**依赖：** 无。

---

## 任务 2：收紧管理员登录请求契约

**优先级：P1**

**问题：** 普通用户体系已移除，但前端仍发送 `role: 'admin'`；后端会静默忽略未知 `role` 字段，测试甚至将 `role: 'user'` 登录成功视为正常。

**改动：**

- 从 `blog-fronted/src/lib/api.ts` 的登录请求中移除 `role`。
- 在 Go JSON 解码边界拒绝未知字段，或仅在登录接口实现等价的严格字段校验。
- 更新集成测试：携带 `role` 的登录请求必须返回 400；正常用户名/密码登录仍成功。

**验收：**

- [ ] 管理员正常登录和 `/auth/me` 继续可用。
- [ ] `role=user`、`role=admin` 和任意未知请求字段均返回预期校验错误。
- [ ] 旧用户注册路由仍返回 404。

**依赖：** 无。

---

## 任务 3：修正标签迁移的去重与审批流程

**优先级：P1**

**问题：** 旧标签数组迁移时不会去重；生产标签映射仅写在本地文档中，无法让站长核对、修正和批准后再迁移。

**改动：**

- 更新 `0001_blog_redesign.sql`：对旧子标签执行 trim、去空和去重。
- 把“生成映射清单”和“应用迁移”拆为两个明确步骤；映射清单必须可导出、可修正、可审核。
- 只有显式批准的映射才能在生产执行；记录批准人、日期和映射文件校验值或等价审计信息。
- 为已上线数据库设计兼容的补救迁移，不允许直接修改已应用迁移后假设它会重新运行。

**验收：**

- [ ] `['主标签', 'Go', ' Go ', 'Go']` 迁移后仅得到一个 `Go` 子标签。
- [ ] 生产执行前能得到并修改完整映射表。
- [ ] 未批准映射时，生产迁移命令明确停止并给出操作提示。

**依赖：** 需要数据库副本；上线前需站长确认映射。

---

## 任务 4：补齐后台路由 metadata

**优先级：P2**

**问题：** 仓库约定每个页面导出 `metadata` 或 `generateMetadata`，但多个后台路由没有；后台页面也应阻止搜索引擎收录。

**改动：**

- 为 `/admin`、文章管理、规划管理、简历管理、新建文章、编辑文章页面提供 metadata。
- 所有后台页面设置 `robots: { index: false, follow: false }`。
- 新建/编辑文章当前是客户端入口时，改为服务端页面包装客户端 `ArticleEditor`，避免在 client page 中导出 metadata。

**验收：**

- [ ] 所有 `src/app/**/page.tsx` 页面均有 metadata 或动态 metadata。
- [ ] `npm run build` 无 Next metadata 或 client/server 边界错误。

**依赖：** 无。

---

## 任务 5：删除确认无调用方的前端代码

**优先级：P2**

**删除目标：**

- `blog-fronted/src/components/common/ErrorBoundary/`
- `blog-fronted/src/components/common/PageSuspense/`
- `blog-fronted/src/views/admin/content/index.tsx` 中未使用的默认 `SiteContentManager`
- 相应的 `components/common/index.ts` 导出。

**理由：** Next 已使用 `src/app/error.tsx` 处理路由错误；`PageSuspense` 没有使用方；默认 `SiteContentManager` 在后台拆分为文章/规划/简历入口后没有消费者。

**验收：**

- [ ] 删除前后 `rg` 均确认不存在这些导入或运行时引用。
- [ ] 前端 lint、type-check、build 通过。
- [ ] `/home`、`/blog`、`/plan`、`/resume`、后台登录页和错误页正常渲染。

**依赖：** 无。

---

## 任务 6：删除过期 Node 后端部署路径

**优先级：P1**

**问题：** `deploy/ecosystem.config.cjs` 仍试图用 PM2 启动旧 Node 后端 `dist/index.js`，但当前后端已是 Go + systemd。继续保留可能导致部署错误或误启动旧服务。

**改动：**

- 以 `blog-server/deploy/systemd/blog-server.service` 为唯一 Go 后端进程管理方式。
- 更新或删除 `deploy/deploy.sh` 与 `deploy/ecosystem.config.cjs` 中旧 Node 后端启动逻辑。
- 若 PM2 仍用于 Next 前端，只保留 `blog-web` 配置，并在文档中明确边界；否则统一改为 systemd。

**验收：**

- [ ] 发布脚本不再引用 `blog-server/dist/index.js`、Node 后端构建或旧 PM2 后端进程。
- [ ] 按部署文档可启动 Go API 与 Next 前端。
- [ ] 回滚步骤与实际服务管理方式一致。

**依赖：** 应先在预发布服务器演练。

---

## 任务 7：清理不应纳入 Git 的本地文件

**优先级：P0**

**目标：**

- 停止跟踪 `.idea/` 下的 IDE 用户配置；保留 `.gitignore` 规则。
- 将 `blog-server/backups/2026-11-10-pre-redesign.sql` 移出仓库，放在受控且加密的备份位置。
- 添加 `blog-server/backups/` 忽略规则，避免未来再次提交数据库备份。

**安全要求：** 该备份曾被纳入 Git；删除工作区文件并不能清除提交历史。若该分支已推送，必须先撤销/轮换其中可能出现的秘密，再由仓库管理员执行历史清理与受控 force-push。

**验收：**

- [ ] `git ls-files '.idea/*' 'blog-server/backups/*'` 无输出。
- [ ] 新建临时 `.idea` 文件或备份文件不会被 Git 显示为未跟踪。
- [ ] 恢复演练从仓库外的安全备份完成。

**依赖：** 仓库管理员、备份所有者及外部密钥轮换权限。

## 检查点：任务 1--6 完成后

- [ ] Go 单元/集成测试、静态检查和构建通过。
- [ ] 前端 lint、type-check、生产构建通过。
- [ ] 管理员登录、文章编辑、主/子标签、规划保存、简历保存和退出流程均手工验证。
- [ ] 内容保存后公开页刷新行为得到验证。

## 不在本次范围内

- 全量重写 React 组件、引入新的状态管理库或 UI 框架。
- 仅因“可能更快”而删除现有性能分析脚本。
- 删除仍被实际使用的 `CursorGlow`、`TiltCard`、`SectionHeading` 等视觉组件。
- GitHub 登录、评论系统或新的产品功能。
