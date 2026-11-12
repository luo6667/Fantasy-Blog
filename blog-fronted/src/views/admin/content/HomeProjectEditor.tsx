import { type ChangeEvent,useMemo, useState } from 'react';

import { uploadApi } from '@/lib/api';
import type { HomeProjectItem } from '@/types/api';

import { EditorCard, Field, SaveBar } from './contentFields';
import {
  editorBtnAdd,
  editorBtnDanger,
  editorBtnGhost,
  editorInputClass,
  useContentEditor,
} from './useContentEditor';

/** 旧数据只有 name/desc/tags：读取时补齐新字段，保存后即为新结构。 */
type StoredProject = Partial<HomeProjectItem> & { name: string; desc?: string };

function normalize(items: StoredProject[] | undefined): HomeProjectItem[] | undefined {
  if (!items) return undefined;
  return items.map((it, i) => ({
    name: it.name,
    summary: it.summary ?? it.desc ?? '',
    desc: it.desc,
    category: it.category ?? '',
    year: it.year ?? '',
    cover: it.cover ?? '',
    coverAlt: it.coverAlt ?? '',
    tags: it.tags ?? [],
    link: it.link ?? '',
    linkLabel: it.linkLabel ?? '',
    featured: it.featured ?? true,
    order: it.order ?? i + 1,
  }));
}

const emptyProject = (order: number): HomeProjectItem => ({
  name: '',
  summary: '',
  category: '',
  year: '',
  cover: '',
  coverAlt: '',
  tags: [],
  link: '',
  linkLabel: '',
  featured: true,
  order,
});

/**
 * 首页精选项目编辑器
 *
 * 支持封面、类别、年份、简介、外链与排序；最多 4 个项目可标记为「精选」。
 */
export default function HomeProjectEditor({ value }: { value: HomeProjectItem[] | undefined }) {
  const normalized = useMemo(() => normalize(value as StoredProject[] | undefined), [value]);
  const { draft, setDraft, dirty, saving, error, save } = useContentEditor<HomeProjectItem[]>(
    'homeProjects',
    normalized,
  );
  const [uploading, setUploading] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState('');
  if (draft === null) return null;

  const update = (i: number, patch: Partial<HomeProjectItem>) => {
    setDraft((prev) => (prev === null ? prev : prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it))));
  };
  const updateTag = (i: number, j: number, v: string) => {
    setDraft((prev) =>
      prev === null
        ? prev
        : prev.map((it, idx) => (idx === i ? { ...it, tags: it.tags.map((t, jdx) => (jdx === j ? v : t)) } : it)),
    );
  };
  const addTag = (i: number) => {
    setDraft((prev) =>
      prev === null ? prev : prev.map((it, idx) => (idx === i ? { ...it, tags: [...it.tags, ''] } : it)),
    );
  };
  const removeTag = (i: number, j: number) => {
    setDraft((prev) =>
      prev === null
        ? prev
        : prev.map((it, idx) => (idx === i ? { ...it, tags: it.tags.filter((_, jdx) => jdx !== j) } : it)),
    );
  };
  const remove = (i: number) => {
    setDraft((prev) => (prev === null ? prev : prev.filter((_, idx) => idx !== i)));
  };
  /** 上移/下移项目（dir: -1 上移，1 下移）；保存后首页按 order 与数组顺序展示 */
  const move = (i: number, dir: -1 | 1) => {
    setDraft((prev) => {
      if (prev === null) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[i] as HomeProjectItem;
      next[i] = next[j] as HomeProjectItem;
      next[j] = tmp;
      return next;
    });
  };
  const add = () => {
    setDraft((prev) => (prev === null ? prev : [emptyProject(prev.length + 1), ...prev]));
  };

  async function handleCoverUpload(e: ChangeEvent<HTMLInputElement>, i: number) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploading(i);
    try {
      const res = await uploadApi.uploadImage(file);
      update(i, { cover: res.url });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  }

  const featuredCount = draft.filter((it) => it.featured).length;

  return (
    <EditorCard
      title="首页精选项目"
      desc="首页「精选作品」区块：封面、类别、年份、简介、标签与外链；最多 4 个项目标记为精选。"
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          error={error ?? (uploadError || undefined)}
          onSave={() => {
            void save();
          }}
          onReset={() => {
            setDraft(value ?? null);
          }}
        />
      }
    >
      <p className="text-xs text-text-muted">
        当前精选 {featuredCount} / 4。首页按「精选」筛选，并按排序值从小到大展示。
      </p>
      {draft.map((item, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-[var(--color-border-light)] p-4">
          <Field
            label="项目名称"
            value={item.name}
            placeholder="如 Fantasy 博客"
            onChange={(v) => {
              update(i, { name: v });
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="类别"
              value={item.category}
              placeholder="如 内容系统"
              onChange={(v) => {
                update(i, { category: v });
              }}
            />
            <Field
              label="年份"
              value={item.year}
              placeholder="如 2026"
              onChange={(v) => {
                update(i, { year: v });
              }}
            />
          </div>
          <Field
            label="一句价值说明（首页展示）"
            textarea
            rows={2}
            value={item.summary}
            placeholder="一两句话说明这个项目解决了什么问题…"
            onChange={(v) => {
              update(i, { summary: v });
            }}
          />
          <div className="space-y-2 rounded-md bg-[var(--color-bg-alt)]/60 p-3">
            <Field
              label="封面图 URL（留空时首页渲染生成的抽象封面）"
              value={item.cover}
              placeholder="/uploads/xxx.png 或 https://…"
              onChange={(v) => {
                update(i, { cover: v });
              }}
            />
            <div className="flex items-center gap-3">
              <label className={`${editorBtnGhost} cursor-pointer`}>
                {uploading === i ? '上传中…' : '上传封面'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void handleCoverUpload(e, i);
                  }}
                />
              </label>
              {item.cover && <span className="truncate text-xs text-text-muted">{item.cover}</span>}
            </div>
            <Field
              label="封面 alt（无障碍描述）"
              value={item.coverAlt}
              placeholder="如 Fantasy 博客的编辑排版封面"
              onChange={(v) => {
                update(i, { coverAlt: v });
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="外链（可选）"
              value={item.link ?? ''}
              placeholder="https://…"
              onChange={(v) => {
                update(i, { link: v });
              }}
            />
            <Field
              label="外链文案"
              value={item.linkLabel ?? ''}
              placeholder="查看项目"
              onChange={(v) => {
                update(i, { linkLabel: v });
              }}
            />
          </div>
          <div className="space-y-2">
            <span className="text-xs text-text-muted">技术标签</span>
            {item.tags.map((t, j) => (
              <div key={j} className="flex items-center gap-2">
                <input
                  className={editorInputClass}
                  value={t}
                  placeholder="如 React"
                  onChange={(e) => {
                    updateTag(i, j, e.target.value);
                  }}
                />
                <button
                  type="button"
                  className={editorBtnDanger}
                  onClick={() => {
                    removeTag(i, j);
                  }}
                >
                  删除
                </button>
              </div>
            ))}
            <button
              type="button"
              className={editorBtnAdd}
              onClick={() => {
                addTag(i);
              }}
            >
              + 添加标签
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.featured}
                onChange={(e) => {
                  update(i, { featured: e.target.checked });
                }}
              />
              首页精选
            </label>
            <label className="flex items-center gap-2 text-sm">
              排序
              <input
                type="number"
                min={0}
                max={9999}
                className={`${editorInputClass} w-24`}
                value={item.order}
                onChange={(e) => {
                  update(i, { order: Number(e.target.value) || 0 });
                }}
              />
            </label>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" className={editorBtnGhost} disabled={i === 0} onClick={() => { move(i, -1); }} title="上移">
              ↑ 上移
            </button>
            <button
              type="button"
              className={editorBtnGhost}
              disabled={i === draft.length - 1}
              onClick={() => { move(i, 1); }}
              title="下移"
            >
              ↓ 下移
            </button>
            <button type="button" className={editorBtnDanger} onClick={() => { remove(i); }}>删除项目</button>
          </div>
        </div>
      ))}
      <button type="button" className={editorBtnAdd} onClick={add}>+ 添加项目</button>
    </EditorCard>
  );
}
