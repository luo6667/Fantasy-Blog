import type { Types } from 'mongoose';

import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { logger } from '../utils/logger.js';

/**
 * 会话数据迁移（幂等，可重复执行）
 *
 * 背景：旧版本在 participants（数组）字段上建了唯一索引。MongoDB 多键索引会对数组的
 * 每个元素各建一条索引并全局唯一，导致任何两个共享同一参与者的会话都无法创建
 * （E11000 duplicate key），表现为「一个用户只能和一个对象聊天」。
 *
 * 修复步骤：
 * 1. 为每条会话生成规范化唯一键 participantsKey（参与者排序后以 "|" 连接）
 * 2. 若有历史脏数据（同 key 多条），保留 lastMessageAt 最新的会话，删除其余（含其消息）
 * 3. 删除旧的 participants_1 唯一索引，重建为普通索引
 * 4. 创建 participantsKey 唯一索引（字符串字段上的唯一索引语义正确）
 */
export async function migrateConversations(): Promise<void> {
  const col = Conversation.collection;

  // 1. 填充 participantsKey
  const docs = await col
    .find({}, { projection: { participants: 1, lastMessageAt: 1 } })
    .toArray();
  let filled = 0;
  for (const doc of docs) {
    const participants = (doc.participants ?? []).map(String);
    if (participants.length !== 2) continue;
    const participantsKey = [...participants].sort().join('|');
    if (doc.participantsKey !== participantsKey) {
      await col.updateOne({ _id: doc._id }, { $set: { participantsKey } });
      filled += 1;
    }
  }
  if (filled > 0) logger.info(`[migrate] conversations: 填充 participantsKey ${filled} 条`);

  // 2. 去重：同 participantsKey 仅保留 lastMessageAt 最新的一条（旧 bug 下理论不会产生，
  //    但防御性处理历史脏数据），删除多余会话及其消息
  const grouped = new Map<string, { _id: unknown; lastMessageAt: Date }[]>();
  for (const doc of docs) {
    const participants = (doc.participants ?? []).map(String);
    if (participants.length !== 2) continue;
    const participantsKey = [...participants].sort().join('|');
    const list = grouped.get(participantsKey) ?? [];
    list.push({ _id: doc._id, lastMessageAt: doc.lastMessageAt });
    grouped.set(participantsKey, list);
  }
  const dropIds: Types.ObjectId[] = [];
  for (const list of grouped.values()) {
    if (list.length <= 1) continue;
    list.sort((x, y) => new Date(y.lastMessageAt).getTime() - new Date(x.lastMessageAt).getTime());
    dropIds.push(...list.slice(1).map((x) => x._id as Types.ObjectId));
  }
  if (dropIds.length > 0) {
    await col.deleteMany({ _id: { $in: dropIds } });
    await Message.deleteMany({ conversation: { $in: dropIds } });
    logger.info(`[migrate] conversations: 清理重复会话 ${dropIds.length} 条（含其消息）`);
  }

  // 3. 重建索引：删除数组字段上的旧唯一索引，重建为普通索引
  const indexes = await col.indexes();
  for (const idx of indexes) {
    if (idx.name === 'participants_1' && idx.unique) {
      await col.dropIndex('participants_1');
      logger.info('[migrate] conversations: 已删除旧的 participants_1 唯一索引');
    }
  }
  await col.createIndex({ participantsKey: 1 }, { unique: true, name: 'participantsKey_1' });
  await col.createIndex({ participants: 1 }, { name: 'participants_1' });
  logger.info('[migrate] conversations: 索引已重建（participantsKey 唯一 / participants 普通）');
}
