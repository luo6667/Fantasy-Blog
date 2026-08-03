import { HttpError } from '../middleware/error.js';
import { Article } from '../models/Article.js';
import { Tag } from '../models/Tag.js';
import type { TagItem } from '../types/tag.js';

/**
 * 标签业务逻辑
 *
 * listTags：标签库全部标签（含文章数，按文章数倒序）
 * createTag：新增标签（重名返回 409）
 * deleteTag：删除标签，同时从所有文章移除该标签（保持数据一致）
 */

/** 标签库列表（含文章数） */
export async function listTags(): Promise<TagItem[]> {
  const [tags, counts] = await Promise.all([
    Tag.find().sort({ createdAt: 1 }).lean(),
    Article.aggregate<{ _id: string; count: number }>([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
    ]),
  ]);
  const countMap = new Map(counts.map((c) => [c._id, c.count]));
  return tags.map((t) => ({ id: t._id.toString(), name: t.name, count: countMap.get(t.name) ?? 0 }));
}

/** 新增标签（name 已在路由层做过 trim/去重校验） */
export async function createTag(name: string): Promise<TagItem> {
  try {
    const doc = await Tag.create({ name });
    return { id: doc._id.toString(), name: doc.name, count: 0 };
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new HttpError(409, `标签「${name}」已存在`);
    }
    throw err;
  }
}

/** 删除标签，并同步从所有文章移除该标签 */
export async function deleteTag(name: string): Promise<{ name: string }> {
  const doc = await Tag.findOneAndDelete({ name });
  if (!doc) {
    throw new HttpError(404, `标签「${name}」不存在`);
  }
  // 同步清理文章上的该标签，保持标签库与文章一致
  await Article.updateMany({ tags: name }, { $pull: { tags: name } });
  return { name: doc.name };
}
