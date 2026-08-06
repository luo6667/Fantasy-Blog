import { SiteContent } from '../models/SiteContent.js';
import { SITE_CONTENT_KEYS, type SiteContentItem, type SiteContentKey, type SiteContentValue } from '../types/siteContent.js';
import { SITE_CONTENT_DEFAULTS } from './siteContentDefaults.js';

/**
 * 站点内容业务逻辑
 *
 * 5 个 key（education / skills / resumeProjects / evaluation / homeProjects）各存一条记录：
 * - 启动时 seedSiteContent 补齐缺失 key 的默认值
 * - 公开读：getSiteContent（不存在时懒写入默认值，页面永远有内容）
 * - 管理员写：updateSiteContent（按 key upsert）
 */

/** 文档 → API 项 */
function toItem(doc: {
  _id: { toString(): string };
  key: SiteContentKey;
  value: SiteContentValue;
  updatedAt: Date;
}): SiteContentItem {
  return {
    id: doc._id.toString(),
    key: doc.key,
    value: doc.value,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** 启动时补齐缺失 key（幂等，可重复执行） */
export async function seedSiteContent(): Promise<void> {
  const existing = await SiteContent.find({}, { key: 1 }).lean();
  const have = new Set(existing.map((d) => d.key as SiteContentKey));
  const missing = SITE_CONTENT_KEYS.filter((k) => !have.has(k));
  if (missing.length === 0) return;
  await SiteContent.insertMany(
    missing.map((key) => ({ key, value: SITE_CONTENT_DEFAULTS[key] })),
  );
}

/** 全部内容（管理员后台用；缺失 key 一并补齐默认值） */
export async function listSiteContents(): Promise<SiteContentItem[]> {
  await seedSiteContent();
  const docs = await SiteContent.find({ key: { $in: SITE_CONTENT_KEYS } })
    .sort({ key: 1 })
    .lean();
  return docs.map((d) => toItem(d));
}

/** 单个内容（公开读；key 不合法由路由层拦截，缺失时懒写入默认值） */
export async function getSiteContent(key: SiteContentKey): Promise<SiteContentItem> {
  let doc = await SiteContent.findOne({ key }).lean();
  if (!doc) {
    doc = await SiteContent.create({ key, value: SITE_CONTENT_DEFAULTS[key] });
  }
  return toItem(doc);
}

/** 更新单个内容（管理员；整体替换该 key 的 value） */
export async function updateSiteContent(
  key: SiteContentKey,
  value: SiteContentValue,
): Promise<SiteContentItem> {
  const doc = await SiteContent.findOneAndUpdate(
    { key },
    { $set: { value } },
    { new: true, upsert: true },
  );
  return toItem(doc);
}
