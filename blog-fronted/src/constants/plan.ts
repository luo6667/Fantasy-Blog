import type { PlanContent, PlanItemStatus } from '@/types/api';

/** 规划页在接口不可用时展示的兜底内容。正常内容由后台维护。 */
export const PLAN_CONTENT: PlanContent = {
  title: '学习 Go',
  summary: '从语言基础走向服务端项目实践，建立可独立交付的 Go 开发能力。',
  stages: [
    {
      id: 'go-basics',
      order: 1,
      title: 'Go 基础与工具链',
      summary: '先建立语言直觉和日常开发环境。',
      goals: [
        { id: 'go-syntax', title: '掌握基础语法与控制流', desc: '变量、函数、切片、映射与错误处理。', status: 'active' },
        { id: 'go-structs', title: '理解结构体与接口', desc: '用组合和接口组织业务代码。', status: 'planned' },
        { id: 'go-tooling', title: '熟悉 Go Modules 与调试工具', desc: '完成依赖管理、测试和本地调试闭环。', status: 'planned' },
      ],
    },
    {
      id: 'go-concurrency',
      order: 2,
      title: '并发与 Web 开发',
      summary: '理解 Go 的并发模型，并写出可维护的 HTTP 服务。',
      goals: [
        { id: 'go-goroutine', title: '掌握 Goroutine 与 Channel', desc: '理解并发协作、取消和错误传播。', status: 'planned' },
        { id: 'go-gin', title: '使用 Gin 构建 REST API', desc: '完成路由、中间件、参数校验与错误响应。', status: 'planned' },
        { id: 'go-data', title: '接入 MySQL 与 GORM', desc: '完成建模、查询、事务与迁移。', status: 'planned' },
      ],
    },
    {
      id: 'go-project',
      order: 3,
      title: '项目实践与部署',
      summary: '把知识收束为一个可部署、可维护的完整项目。',
      goals: [
        { id: 'go-architecture', title: '设计分层服务结构', desc: '明确 handler、service、model 的职责边界。', status: 'planned' },
        { id: 'go-testing', title: '补齐关键接口测试', desc: '为核心服务写可重复运行的测试。', status: 'planned' },
        { id: 'go-deploy', title: '完成线上部署与观测', desc: '配置环境变量、日志和基础运行检查。', status: 'planned' },
      ],
    },
  ],
};

/** 规划状态 → 中文文案（页面徽章与后台编辑器共用） */
export const PLAN_STATUS_LABEL: Record<PlanItemStatus, string> = {
  planned: '未开始',
  active: '进行中',
  done: '已完成',
};

export const PLAN_STATUS_OPTIONS: { value: PlanItemStatus; label: string }[] = [
  { value: 'planned', label: PLAN_STATUS_LABEL.planned },
  { value: 'active', label: PLAN_STATUS_LABEL.active },
  { value: 'done', label: PLAN_STATUS_LABEL.done },
];
