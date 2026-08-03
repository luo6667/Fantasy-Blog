import { evaluate } from '@mdx-js/mdx';
import { MDXProvider, useMDXComponents } from '@mdx-js/react';
import { type ComponentProps, type ReactNode,useEffect, useState } from 'react';
import * as runtime from 'react/jsx-runtime';
import remarkGfm from 'remark-gfm';

/** evaluate 返回的模块结构（MDXModule 类型来自未随包安装的 mdx/types） */
interface MdxModuleLike {
  default: (props: { children?: ReactNode }) => ReactNode;
}

/**
 * MDX 内容渲染组件
 *
 * 将文章正文（MDX 文本）在运行时编译并渲染：
 * - 支持标准 Markdown 语法（标题、列表、引用、代码块、表格等，含 GFM）
 * - 支持 `![alt](url)` 插入图片（配合编辑器「插入图片」按钮）
 * - 支持 MDX 内联 JSX（管理员自行编写的受限内容）
 *
 * 样式通过 MDXProvider 的自定义 components 统一美化，与站点主题一致。
 */

interface MdxContentProps {
  /** MDX 源文本 */
  mdx: string;
}

/** 代码块高亮样式的简单封装 */
function Code({ className, children, ...rest }: ComponentProps<'code'>) {
  const text = typeof children === 'string' ? children : '';
  const isBlock = Boolean(className) || text.includes('\n');
  if (isBlock) {
    return (
      <code className={`block overflow-x-auto whitespace-pre rounded-md bg-bg-alt px-3 py-2 text-[0.85em] ${className ?? ''}`} {...rest}>
        {children}
      </code>
    );
  }
  return (
    <code className="rounded bg-bg-alt px-1.5 py-0.5 text-[0.85em] text-accent" {...rest}>
      {children}
    </code>
  );
}

/** 与站点主题一致的 MDX 元素样式 */
const mdxComponents = {
  h1: (props: ComponentProps<'h1'>) => (
    <h1 className="mb-4 mt-8 text-2xl font-bold tracking-[-0.02em]" {...props} />
  ),
  h2: (props: ComponentProps<'h2'>) => (
    <h2 className="mb-3 mt-8 text-xl font-bold tracking-[-0.02em]" {...props} />
  ),
  h3: (props: ComponentProps<'h3'>) => (
    <h3 className="mb-2 mt-6 text-lg font-semibold tracking-[-0.02em]" {...props} />
  ),
  h4: (props: ComponentProps<'h4'>) => (
    <h4 className="mb-2 mt-5 text-base font-semibold" {...props} />
  ),
  p: (props: ComponentProps<'p'>) => (
    <p className="my-4 leading-[1.9] first:mt-0 last:mb-0" {...props} />
  ),
  a: (props: ComponentProps<'a'>) => (
    <a className="text-accent underline decoration-accent/40 underline-offset-4 transition-colors hover:decoration-accent" {...props} />
  ),
  img: (props: ComponentProps<'img'>) => (
    <img
      className="my-6 max-w-full rounded-lg border border-[var(--color-border-light)]"
      loading="lazy"
      {...props}
    />
  ),
  ul: (props: ComponentProps<'ul'>) => (
    <ul className="my-4 list-disc space-y-1 pl-6 leading-[1.8]" {...props} />
  ),
  ol: (props: ComponentProps<'ol'>) => (
    <ol className="my-4 list-decimal space-y-1 pl-6 leading-[1.8]" {...props} />
  ),
  li: (props: ComponentProps<'li'>) => <li className="pl-1" {...props} />,
  blockquote: (props: ComponentProps<'blockquote'>) => (
    <blockquote
      className="my-4 border-l-2 border-accent bg-accent-soft/40 px-4 py-2 text-text-muted"
      {...props}
    />
  ),
  code: Code,
  pre: (props: ComponentProps<'pre'>) => (
    <pre className="my-4 overflow-x-auto rounded-lg border border-[var(--color-border-light)] bg-bg-alt p-4 text-[0.85rem] leading-relaxed" {...props} />
  ),
  hr: () => <hr className="my-8 border-[var(--color-border-light)]" />,
  table: (props: ComponentProps<'table'>) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props: ComponentProps<'th'>) => (
    <th className="border border-[var(--color-border-light)] bg-bg-alt px-3 py-2 text-left font-semibold" {...props} />
  ),
  td: (props: ComponentProps<'td'>) => (
    <td className="border border-[var(--color-border-light)] px-3 py-2" {...props} />
  ),
  strong: (props: ComponentProps<'strong'>) => <strong className="font-semibold" {...props} />,
  em: (props: ComponentProps<'em'>) => <em {...props} />,
};

export default function MdxContent({ mdx }: MdxContentProps) {
  const [mod, setMod] = useState<MdxModuleLike | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setMod(null);
    setError('');
    evaluate(mdx, { ...runtime, remarkPlugins: [remarkGfm], useMDXComponents })
      .then((m) => {
        if (!cancelled) setMod(m);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [mdx]);

  if (error) {
    return <p className="text-sm text-red-500">MDX 渲染失败：{error}</p>;
  }
  if (!mod) {
    return <p className="py-4 text-center text-sm text-text-muted">正文渲染中…</p>;
  }

  const Content = mod.default;
  return (
    <MDXProvider components={mdxComponents}>
      <Content />
    </MDXProvider>
  );
}
