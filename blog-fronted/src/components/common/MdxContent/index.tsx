import './mdx.css';

/**
 * 📘 components/common/MdxContent/index.tsx —— 正文渲染组件（安全 HTML 版）
 *
 * 文章正文是 Markdown，但这里不自己解析——后端发布时已经用
 * remark → rehype → rehype-sanitize 编译并消毒成安全的 contentHtml（见 blog-server/utils/mdx.ts），
 * 前端直接渲染该 HTML（dangerouslySetInnerHTML），不再运行时编译，杜绝存储型 XSS。
 * 样式见同目录 mdx.css（.mdx-content）。
 */
interface MdxContentProps {
  /** 服务端消毒后的正文 HTML */
  html: string;
}

export default function MdxContent({ html }: MdxContentProps) {
  return <div className="mdx-content" dangerouslySetInnerHTML={{ __html: html }} />;
}
