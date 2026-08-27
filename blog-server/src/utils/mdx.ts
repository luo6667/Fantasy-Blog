import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

/**
 * 📘 utils/mdx.ts —— Markdown 编译为安全 HTML（技术栈：unified + remark + rehype）
 *
 * 发布文章防注入的核心防线：
 * - 标准管线：remark-parse(解析 Markdown) → remark-gfm(表格/删除线等) →
 *   remark-rehype(转 HTML 节点) → rehype-sanitize(按 GitHub 白名单过滤：
 *   剥离 script、style、事件属性、危险协议) → rehype-stringify(序列化)；
 * - 纯 Markdown 解析，不执行任何 JSX / 脚本；
 * - 存的是消毒后的 contentHtml，前端直接渲染、不再运行时编译（杜绝存储型 XSS）；
 * - 失败时抛编译错误，由调用方转为 400（内容不合法时不落库）。
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
