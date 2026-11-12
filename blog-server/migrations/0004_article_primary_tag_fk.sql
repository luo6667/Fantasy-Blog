-- 主标签引用完整性：先兜底「未分类」，把历史孤儿引用归入其中，再加外键。
-- MySQL 的 DDL 会隐式提交；本迁移只执行一次，由 schema_migrations 登记。

INSERT INTO tags (id, name, createdAt, updatedAt)
SELECT LEFT(SHA2(CONCAT('tag:', '未分类'), 256), 24), '未分类', NOW(), NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM tags WHERE name = '未分类');

UPDATE articles a
LEFT JOIN tags t ON t.id = a.primaryTagId
SET a.primaryTagId = (SELECT id FROM tags WHERE name = '未分类' LIMIT 1)
WHERE t.id IS NULL;

ALTER TABLE articles
  ADD CONSTRAINT fk_articles_primary_tag
  FOREIGN KEY (primaryTagId) REFERENCES tags (id) ON DELETE RESTRICT;
