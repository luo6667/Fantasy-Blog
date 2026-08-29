import { literal, QueryTypes, UniqueConstraintError } from 'sequelize';

import { sequelize } from '../db/sequelize.js';
import { HttpError } from '../middleware/error.js';
import Article from '../models/Article.js';
import Tag from '../models/Tag.js';
import { revalidateNext } from '../utils/revalidate.js';
import type { TagItem } from '../types/tag.js';

/**
 * 标签业务逻辑
 *
 * listTags：标签库全部标签（含文章数，按文章数倒序）
 * createTag：新增标签（重名返回 409）
 * deleteTag：删除标签，同时从所有文章移除该标签（保持数据一致）
 */

/** JSON 列包含指定字符串值（等价 MongoDB 的 { field: value } 数组匹配） */
function jsonContains(column: string, value: string) {
  return literal(`JSON_CONTAINS(${column}, JSON_QUOTE(${sequelize.escape(value)}))`);
}

/** 标签库列表（含文章数） */
export async function listTags(): Promise<TagItem[]> {
  const [tags, rows] = await Promise.all([
    Tag.findAll({ order: [['createdAt', 'ASC']] }),
    // 展开每篇文章的 tags 数组并按标签统计文章数（等价原 $unwind + $group）
    sequelize.query<{ tag: string; cnt: number }>(
      `SELECT jt.tag AS tag, COUNT(*) AS cnt
       FROM articles, JSON_TABLE(articles.tags, '$[*]' COLUMNS (tag VARCHAR(64) PATH '$')) AS jt
       GROUP BY jt.tag`,
      { type: QueryTypes.SELECT },
    ),
  ]);
  const countMap = new Map(rows.map((r) => [r.tag, Number(r.cnt)]));
  return tags.map((t) => ({ id: t.id, name: t.name, count: countMap.get(t.name) ?? 0 }));
}

/** 新增标签（name 已在路由层做过 trim/去重校验） */
export async function createTag(name: string): Promise<TagItem> {
  try {
    const doc = await Tag.create({ name });
    return { id: doc.id, name: doc.name, count: 0 };
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw new HttpError(409, `标签「${name}」已存在`);
    }
    throw err;
  }
}

/** 删除标签，并同步从所有文章移除该标签 */
export async function deleteTag(name: string): Promise<{ name: string }> {
  const affected = await Tag.destroy({ where: { name } });
  if (affected === 0) {
    throw new HttpError(404, `标签「${name}」不存在`);
  }
  // 同步清理文章上的该标签，保持标签库与文章一致
  const articles = await Article.findAll({ where: jsonContains('tags', name) });
  for (const article of articles) {
    article.tags = article.tags.filter((t) => t !== name);
    await article.save();
  }
  // 发布即更新：文章标签被移除，重建列表页（标签计数）与全部详情页（文章标签显示）。
  // 创建标签不需要——新标签没有文章使用，不会出现在列表页统计里。
  void revalidateNext(['/blog', '/blog/[id]']);
  return { name };
}
