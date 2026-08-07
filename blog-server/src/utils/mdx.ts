import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

/**
 * 把文章正文（Markdown / GFM）编译为「消毒后的 HTML」
 *
 * 安全设计（发布文章防注入）：
 * - 使用标准 remark → rehype 管线：纯 Markdown 解析，**不解析 / 不执行任何 JSX / 脚本**
 * - rehype-sanitize：按 GitHub 白名单过滤 HTML（剥离 script、style、事件属性、危险协议等）
 * - 存储 contentHtml 供前端直接渲染，前端不再运行时编译，杜绝存储型 XSS
 *
 * 失败时抛出编译错误，由调用方转为 400（内容不合法时不落库）。
 */
export async function mdxToSafeHtml(mdx: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(mdx);
  return String(file);
}
