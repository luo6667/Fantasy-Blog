import { rateLimit } from 'express-rate-limit';

/**
 * 请求限流中间件（express-rate-limit）
 *
 * - authLimiter：登录 / 注册防爆破（15 分钟 20 次 / IP）
 * - writeLimiter：评论、回复、私信、点赞等写操作防刷（1 分钟 30 次 / IP）
 *
 * 注意：默认不信任代理（trust proxy 关闭），直接暴露公网时 IP 不会被伪造。
 * 若部署在反向代理 / CDN 之后，需要在 app.ts 里 `app.set('trust proxy', 1)`
 * （只信任一层代理），否则所有请求会按代理 IP 计数、可能误伤。
 */
const tooMany = (msg: string) => ({ code: 429, msg, data: null });

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: tooMany('尝试过于频繁，请 15 分钟后再试'),
});

export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: tooMany('操作过于频繁，请稍后再试'),
});
