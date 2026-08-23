import '@/components/common/MdxContent/mdx.css';

import { useEffect, useState } from 'react';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

/**
 * 编辑器实时预览（客户端编译 + 消毒）
 *
 * 仅用于管理端文章编辑器（未保存的 Markdown 源码无法走服务端编译），
 * 与详情页相同的安全策略：纯 Markdown 解析 + rehype-sanitize 白名单消毒。
 * 该组件只在编辑器 chunk 内被引用，访客端不会下载编译库。
 */
interface MdxPreviewProps {
  /** 编辑中的 Markdown 源码 */
  mdx: string;
}

export default function MdxPreview({ mdx }: MdxPreviewProps) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeSanitize)
      .use(rehypeStringify)
      .process(mdx)
      .then((file) => {
        if (!cancelled) setHtml(String(file));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [mdx]);

  if (error) {
    return <p className="text-sm text-red-500">正文渲染失败：{error}</p>;
  }
  return <div className="mdx-content" dangerouslySetInnerHTML={{ __html: html }} />;
}
