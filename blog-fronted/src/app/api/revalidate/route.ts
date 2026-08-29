import { revalidatePath } from 'next/cache';
import { NextRequest } from 'next/server';

/**
 * 📘 app/api/revalidate/route.ts —— on-demand revalidation 入口（Next.js 核心能力）
 *
 * 背景：博客内容 SSG 静态化后，发文章 / 改内容不会自动反映到页面。
 * 这条链路让「发布即更新」成立：
 *   Express 写操作成功（article / siteContent）→ fetch 本接口 → revalidatePath 重建静态页
 *
 * 约定：
 * - 仅接受 POST；query 携带 `secret`（与 REVALIDATE_SECRET 环境变量比对）和
 *   一个或多个 `path`（支持动态段定义，如 /blog/[id] 会重建所有详情页）；
 * - 只允许 Express 后端调用（secret 只存在于服务端环境变量，前端 JS 里没有）；
 * - 本 route 是真实路由，优先于 next.config rewrites 的 /api/:path* 代理，不会被转去 Express；
 * - 点赞 / 评论等高频写操作【不】走这里——它们不在静态 HTML 里，
 *   由客户端 TanStack Query 的 invalidateQueries 即时刷新（见 hooks/queries/）。
 */
export const dynamic = 'force-dynamic';

export function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ error: 'invalid secret' }, { status: 401 });
  }

  const paths = req.nextUrl.searchParams.getAll('path');
  if (paths.length === 0) {
    return Response.json({ error: 'missing path' }, { status: 400 });
  }

  for (const p of paths) {
    revalidatePath(p);
  }
  return Response.json({ revalidated: true, paths });
}
