import { Router, type RequestHandler } from 'express';
import { z, ZodError, type ZodType } from 'zod';

import { getHandler, listHandler, updateHandler } from '../controllers/siteContent.controller.js';
import { requireAdmin } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { SITE_CONTENT_KEYS, type SiteContentKey } from '../types/siteContent.js';

const router = Router();

/** 教育背景项 */
const educationItemSchema = z.object({
  year: z.string().trim().min(1, '年份不能为空').max(64),
  title: z.string().trim().min(1, '专业/职位不能为空').max(64),
  school: z.string().trim().min(1, '学校/公司不能为空').max(64),
  desc: z.string().trim().max(200, '描述最多 200 字'),
});

/** 简历页项目经历项 */
const resumeProjectItemSchema = z.object({
  title: z.string().trim().min(1, '项目名不能为空').max(128),
  meta: z.string().trim().max(256, 'meta 最多 256 字'),
  desc: z.array(z.string().trim().min(1).max(1000, '单段描述最多 1000 字')).min(1, '至少一段描述'),
});

/** 首页精选项目项 */
const homeProjectItemSchema = z.object({
  name: z.string().trim().min(1, '项目名不能为空').max(128),
  desc: z.string().trim().min(1, '描述不能为空').max(500, '描述最多 500 字'),
  tags: z.array(z.string().trim().min(1).max(32, '单个标签最多 32 字')).max(20, '最多 20 个标签'),
  link: z
    .string()
    .trim()
    .max(500, '链接最长 500 字')
    .refine((s) => s === '' || /^(https?:\/\/|git@)/i.test(s), '链接需以 http(s):// 或 git@ 开头')
    .optional(),
});

/** 各 key 的 value 校验 schema */
const valueSchemas: Record<SiteContentKey, ZodType<unknown>> = {
  education: z.array(educationItemSchema),
  skills: z.array(z.string().trim().min(1).max(500, '单条技能最多 500 字')),
  resumeProjects: z.array(resumeProjectItemSchema),
  evaluation: z.string().trim().min(1, '内容不能为空').max(2000, '最多 2000 字'),
  homeProjects: z.array(homeProjectItemSchema),
};

/** 校验 PUT 的 value（按 params.key 选择 schema） */
const validateValue: RequestHandler = (req, _res, next) => {
  const key = req.params.key as SiteContentKey;
  const schema = valueSchemas[key];
  if (!schema) {
    throw new HttpError(400, `未知的内容类型：${String(req.params.key)}`);
  }
  try {
    req.body = { value: schema.parse(req.body.value) };
  } catch (e) {
    // 把数组项的 zod 错误转成友好提示：如「0.desc: 描述不能为空」→「第 1 项：描述不能为空」
    if (e instanceof ZodError) {
      const msg = e.issues
        .map((i) => {
          const first = i.path[0];
          return typeof first === 'number' ? `第 ${first + 1} 项：${i.message}` : i.message;
        })
        .join('；');
      throw new HttpError(400, msg);
    }
    throw e;
  }
  next();
};

/**
 * 站点内容路由
 *
 * GET    /api/site-content       全部内容（管理员）
 * GET    /api/site-content/:key  单个内容（公开，页面渲染用）
 * PUT    /api/site-content/:key  更新单个内容（管理员）
 */
router.get('/', requireAdmin, listHandler);
router.get('/:key', getHandler);
router.put('/:key', requireAdmin, validateValue, updateHandler);

export default router;
