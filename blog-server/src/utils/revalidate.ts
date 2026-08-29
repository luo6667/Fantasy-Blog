import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * 📘 utils/revalidate.ts —— 通知 Next.js 前端重建静态页（on-demand revalidation）
 *
 * 前端博客内容已 SSG/ISR 静态化，写操作后静态页不会自动更新。本函数在
 * 后端写操作成功后调用前端 `/api/revalidate`，让「发布即更新」成立：
 *
 *   Express 写操作成功 → revalidateNext(paths) → fetch 前端 /api/revalidate
 *   → 前端 revalidatePath(paths) 重建对应静态页（见 web/src/app/api/revalidate/route.ts）
 *
 * 约定与注意：
 * - 仅对「会进静态 HTML」的数据触发：文章增删改 → ['/blog', '/blog/[id]']（[id] 是
 *   动态段定义，会重建全部详情页）；站点内容更新 → ['/resume', '/home']；
 * - 评论 / 点赞 / 收藏【不】触发：它们不在静态 HTML 里，由客户端 TanStack Query
 *   invalidateQueries 即时刷新，无需重建页面；
 * - 环境变量 NEXT_REVALIDATE_URL / REVALIDATE_SECRET 未配置时直接跳过（静默降级），
 *   写操作本身不受影响；失败只记 warn，不阻塞业务响应；
 * - secret 只存在于服务端环境变量，前端 JS 拿不到。
 */
export async function revalidateNext(paths: string[]): Promise<void> {
  const base = env.NEXT_REVALIDATE_URL;
  const secret = env.REVALIDATE_SECRET;
  if (!base || !secret) return;

  const qs = paths.map((p) => `path=${encodeURIComponent(p)}`).join('&');
  try {
    const res = await fetch(`${base}/api/revalidate?secret=${encodeURIComponent(secret)}&${qs}`, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      logger.warn('revalidateNext returned non-ok', { status: res.status, paths });
    }
  } catch (err) {
    // 前端不在线 / 网络失败：不影响业务，等 ISR 周期兜底
    logger.warn('revalidateNext failed', err);
  }
}
