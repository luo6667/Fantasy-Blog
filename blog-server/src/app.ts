import cors from 'cors';
import express from 'express';

import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import articleRoutes from './routes/article.routes.js';
import authRoutes from './routes/auth.routes.js';
import commentRoutes from './routes/comment.routes.js';
import conversationRoutes from './routes/conversation.routes.js';
import messageRoutes from './routes/message.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import siteContentRoutes from './routes/siteContent.routes.js';
import tagRoutes from './routes/tag.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import userRoutes from './routes/user.routes.js';
import { ok } from './utils/response.js';

/**
 * Express 应用组装
 *
 * 中间件顺序：CORS → body 解析 → 静态资源 → 业务路由 → 404 → 全局错误处理。
 * Express 5 对 async handler 的 rejected promise 会自动转发给错误中间件。
 */
const app = express();

// 跨域：允许配置的多个来源（逗号分隔）
const allowedOrigins = env.CORS_ORIGIN.split(',').map((s) => s.trim());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// 请求体解析
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// 上传文件的静态访问（/uploads/xxx.png，目录为基于项目根的绝对路径）
app.use('/uploads', express.static(env.UPLOAD_DIR_ABS));

// 健康检查（供部署平台与前端探测服务状态）
app.get('/api/health', (_req, res) => {
  ok(res, { status: 'up', timestamp: new Date().toISOString() });
});

// 业务路由
app.use('/api/auth', authRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/site-content', siteContentRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);

// 404 与全局错误处理（必须最后注册）
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
