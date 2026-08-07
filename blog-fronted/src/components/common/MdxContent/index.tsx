import './mdx.css';

/**
 * 正文渲染组件（安全 HTML 版）
 *
 * 接收服务端已编译并消毒的 contentHtml（服务端 format:'md' + rehype-sanitize，
 * 不执行 JSX / 脚本），此处直接渲染，不再运行时编译，杜绝存储型 XSS。
 * 样式见同目录 mdx.css（.mdx-content）。
 */
interface MdxContentProps {
  /** 服务端消毒后的正文 HTML */
  html: string;
}

export default function MdxContent({ html }: MdxContentProps) {
  return <div className="mdx-content" dangerouslySetInnerHTML={{ __html: html }} />;
}
