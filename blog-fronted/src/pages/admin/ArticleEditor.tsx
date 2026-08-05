import { type ChangeEvent, type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { BgOrbs, MdxContent } from '@/components/common';
import {
  useArticleDetailQuery,
  useCreateArticleMutation,
  useTagsQuery,
  useUpdateArticleMutation,
} from '@/hooks/queries';
import { uploadApi } from '@/lib/api';

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none transition-colors focus:border-accent';

const toolBtn =
  'cursor-pointer rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent';

const toolBtnActive =
  'cursor-pointer rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90';

/**
 * 文章编辑器页面（/admin/new 新建、/admin/edit/:id 编辑）
 *
 * 独立页面 + MDX 编辑器：
 * - 标题、简介、分类标签（必选，来自标签库）、封面图（本地上传）
 * - 正文支持工具栏：加粗 / 斜体 / 标题 / 引用 / 代码块 / 列表 / 上传图片插入 / 链接 / MDX 预览
 */
export default function ArticleEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [cover, setCover] = useState('');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false); // 图片上传中

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const detailQuery = useArticleDetailQuery(id);
  const { data: availableTags = [], isLoading: tagsLoading, error: tagsError } = useTagsQuery();
  const createArticle = useCreateArticleMutation();
  const updateArticle = useUpdateArticleMutation();

  // 编辑模式：详情数据到达后回填表单（按文章 id 记录，避免 refetch 覆盖已编辑内容）
  const initializedIdRef = useRef<string | null>(null);
  useEffect(() => {
    const article = detailQuery.data;
    if (!article || initializedIdRef.current === article.id) return;
    initializedIdRef.current = article.id;
    setTitle(article.title);
    setExcerpt(article.excerpt);
    setContent(article.content);
    setSelectedTags(article.tags);
    setCover(article.cover ?? '');
  }, [detailQuery.data]);

  const saving = createArticle.isPending || updateArticle.isPending;
  const serverError =
    detailQuery.error?.message ??
    tagsError?.message ??
    createArticle.error?.message ??
    updateArticle.error?.message;
  const errorMessage = error || serverError;

  /** 在正文光标处插入文本 */
  function insertAtCursor(text: string) {
    const ta = contentRef.current;
    if (!ta) {
      setContent((prev) => prev + text);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = content.slice(0, start) + text + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  /** 用包围语法包裹选区（加粗/斜体/行内代码等） */
  function wrapSelection(before: string, after: string, placeholder: string) {
    const ta = contentRef.current;
    const start = ta?.selectionStart ?? content.length;
    const end = ta?.selectionEnd ?? content.length;
    const selected = content.slice(start, end) || placeholder;
    const next = content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      ta?.focus();
      const pos = start + before.length + selected.length;
      ta?.setSelectionRange(pos, pos);
    });
  }

  /** 行首插入（标题/引用/列表等） */
  function insertLineStart(text: string) {
    const ta = contentRef.current;
    const start = ta?.selectionStart ?? content.length;
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const next = content.slice(0, lineStart) + text + content.slice(lineStart);
    setContent(next);
    requestAnimationFrame(() => {
      ta?.focus();
      const pos = lineStart + text.length;
      ta?.setSelectionRange(pos, pos);
    });
  }

  /** 上传封面图 */
  async function handleCoverUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await uploadApi.uploadImage(file);
      setCover(res.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
      e.target.value = '';
    }
  }

  /** 上传图片并在光标处插入 MDX 图片语法 */
  async function handleInsertImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await uploadApi.uploadImage(file);
      insertAtCursor(`\n![图片](${res.url})\n`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
      e.target.value = '';
    }
  }

  /** 插入链接 */
  function handleInsertLink() {
    const url = window.prompt('输入链接地址（URL）：');
    if (!url) return;
    insertAtCursor(`[链接文字](${url})`);
  }

  /** 切换标签选中状态 */
  function toggleTag(name: string) {
    setSelectedTags((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name],
    );
  }

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selectedTags.length === 0) {
      setError('请至少选择一个分类标签');
      return;
    }
    setError('');
    const input = {
      title: title.trim(),
      excerpt: excerpt.trim(),
      content,
      tags: selectedTags,
      cover: cover || undefined,
    };
    try {
      const saved = isEdit
        ? await updateArticle.mutateAsync({ id: id ?? '', input })
        : await createArticle.mutateAsync(input);
      void navigate(`/blog/${saved.id}`);
    } catch {
      /* 错误已通过 errorMessage 展示 */
    }
  }

  // 合并可选标签：标签库 ∪ 已选标签（编辑时保留已被移除的标签显示）
  const availableNames = new Set(availableTags.map((t) => t.name));
  const mergedTags = [...new Set([...availableTags.map((t) => t.name), ...selectedTags])];

  return (
    <main>
      <BgOrbs />
      <section className="relative z-[1] px-6 py-12">
        <div className="mx-auto max-w-4xl">
          <Link
            to="/admin"
            className="mb-4 inline-block text-sm text-text-muted transition-colors hover:text-accent"
          >
            ← 返回管理
          </Link>

          <h1 className="mb-6 text-2xl font-bold tracking-[-0.02em]">
            {isEdit ? '编辑文章' : '新建文章'}
          </h1>

          <form onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col gap-5">
            {/* 标题 */}
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-text-muted">标题 *</span>
              <input className={inputClass} value={title} onChange={(e) => { setTitle(e.target.value); }} required maxLength={200} />
            </label>

            {/* 简介 */}
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-text-muted">简介 *</span>
              <input className={inputClass} value={excerpt} onChange={(e) => { setExcerpt(e.target.value); }} required maxLength={500} />
            </label>

            {/* 分类标签（必选，来自标签库） */}
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="text-text-muted">分类标签 *（至少选择一个）</span>
              {availableTags.length === 0 && !isEdit && !tagsLoading ? (
                <p className="text-xs text-red-500">标签库为空，请先到「标签管理」添加分类标签。</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {mergedTags.map((name) => {
                    const active = selectedTags.includes(name);
                    const removed = !availableNames.has(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => { toggleTag(name); }}
                        className={`cursor-pointer rounded-full border px-3 py-1 text-[0.8125rem] transition-colors ${
                          active
                            ? 'border-transparent bg-accent font-semibold text-white'
                            : 'border-[var(--color-border)] text-text-secondary hover:border-accent hover:text-accent'
                        }`}
                        title={removed ? '该标签已被从标签库移除，保存前请更换' : name}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 封面图（本地上传） */}
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="text-text-muted">封面图（选填）</span>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => { void handleCoverUpload(e); }}
                  className="text-sm text-text-muted file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:font-semibold file:text-accent"
                />
                {cover && (
                  <span className="flex items-center gap-2 text-xs text-text-muted">
                    <img src={cover} alt="封面预览" className="h-12 w-20 rounded object-cover" />
                    <button
                      type="button"
                      onClick={() => { setCover(''); }}
                      className="cursor-pointer rounded-md border border-[var(--color-border)] px-2 py-0.5 transition-colors hover:border-red-400 hover:text-red-500"
                    >
                      移除
                    </button>
                  </span>
                )}
              </div>
            </div>

            {/* 正文（MDX 编辑器） */}
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-text-muted">正文 *（MDX / Markdown，可插入图片、链接等）</span>
                <div className="flex flex-wrap gap-1.5">
                  {mode === 'edit' ? (
                    <>
                      <button type="button" className={toolBtn} onClick={() => { wrapSelection('**', '**', '加粗文本'); }} title="加粗">B</button>
                      <button type="button" className={toolBtn} onClick={() => { wrapSelection('*', '*', '斜体文本'); }} title="斜体">I</button>
                      <button type="button" className={toolBtn} onClick={() => { insertLineStart('## '); }} title="二级标题">H2</button>
                      <button type="button" className={toolBtn} onClick={() => { insertLineStart('### '); }} title="三级标题">H3</button>
                      <button type="button" className={toolBtn} onClick={() => { insertLineStart('> '); }} title="引用">引用</button>
                      <button type="button" className={toolBtn} onClick={() => { insertAtCursor('\n```\n代码块\n```\n'); }} title="代码块">代码</button>
                      <button type="button" className={toolBtn} onClick={() => { insertLineStart('- '); }} title="无序列表">列表</button>
                      <button type="button" className={toolBtn} onClick={() => { insertLineStart('1. '); }} title="有序列表">1.</button>
                      <button type="button" className={toolBtn} onClick={() => { imageInputRef.current?.click(); }} title="上传图片并插入">图片</button>
                      <button type="button" className={toolBtn} onClick={handleInsertLink} title="插入链接">链接</button>
                      <button type="button" className={toolBtnActive} onClick={() => { setMode('preview'); }}>预览</button>
                    </>
                  ) : (
                    <button type="button" className={toolBtn} onClick={() => { setMode('edit'); }}>
                      返回编辑
                    </button>
                  )}
                </div>
              </div>

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => { void handleInsertImage(e); }}
                className="hidden"
              />

              {mode === 'edit' ? (
                <textarea
                  ref={contentRef}
                  className={`${inputClass} min-h-[22rem] resize-y font-mono leading-relaxed`}
                  value={content}
                  onChange={(e) => { setContent(e.target.value); }}
                  required
                  placeholder={'支持 MDX / Markdown，例如：\n\n## 小节标题\n\n这是一段 **加粗** 和 *斜体* 文字。\n\n> 引用内容\n\n- 列表项一\n- 列表项二\n\n![图片描述](/uploads/xxx.png)\n\n[链接文字](https://example.com)'}
                />
              ) : (
                <div className="min-h-[22rem] rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
                  {content.trim() ? (
                    <MdxContent mdx={content} />
                  ) : (
                    <p className="py-8 text-center text-text-muted">正文为空，暂无预览。</p>
                  )}
                </div>
              )}
            </div>

            {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}

            <div className="flex justify-end gap-2">
              <Link
                to="/admin"
                className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm transition-colors hover:border-accent hover:text-accent"
              >
                取消
              </Link>
              <button
                type="submit"
                disabled={submitting || saving}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? '保存中…' : isEdit ? '保存修改' : '发布文章'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
