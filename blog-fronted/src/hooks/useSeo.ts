import { useEffect } from 'react';

/**
 * SEO hook：更新 document.title 与 meta description / Open Graph 标签
 *
 * 博客详情页等动态页面在数据到达后调用，保证分享链接与搜索引擎能看到正确标题摘要。
 * 不传参时重置为站点默认标题。
 */

const SITE_NAME = 'JasonLuo · 个人简历';
const SITE_DESC = 'JasonLuo - 前端工程师个人简历与博客';

/** 设置或更新 <meta> 标签（name 或 property 维度） */
function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

interface UseSeoOptions {
  title?: string;
  description?: string;
}

export function useSeo({ title, description }: UseSeoOptions = {}): void {
  useEffect(() => {
    const fullTitle = title ? `${title} · JasonLuo` : SITE_NAME;
    document.title = fullTitle;
    setMeta('name', 'description', description ?? SITE_DESC);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', description ?? SITE_DESC);
  }, [title, description]);
}
