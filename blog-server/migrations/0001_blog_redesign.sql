-- 0001_blog_redesign：文章分类改造（1 个主标签 + 自由子标签）并移除普通用户/评论/通知/AI。
--
-- 执行前置：全量备份已完成并验证可恢复（见 0001_blog_redesign_checklist.md），
-- 生产环境必须先在生产副本上演练并取得站长对标签映射表的确认。
-- 该迁移由 blog-server migrate 子命令执行，禁止用 GORM AutoMigrate 代替。

-- 1. 新增主标签与子标签列（先允许 NULL，回填后再收紧）。
ALTER TABLE `articles`
  ADD COLUMN `primaryTagId` VARCHAR(24) COLLATE utf8mb4_unicode_ci NULL AFTER `contentHtml`,
  ADD COLUMN `subTags` JSON NULL AFTER `primaryTagId`;

-- 2. 记录每篇文章的「主标签名」与「子标签数组」：
--    旧 tags 首项 → 主标签；其余项 → 子标签；空数组归入「未分类」。
--    若已执行过 migrate-tags apply，tmp_tag_map 中的人工审批结果优先（INSERT IGNORE）。
CREATE TABLE IF NOT EXISTS `tmp_tag_map` (
  `articleId` VARCHAR(24) COLLATE utf8mb4_unicode_ci NOT NULL,
  `primaryName` VARCHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subTags` JSON NOT NULL,
  PRIMARY KEY (`articleId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `tmp_tag_map` (`articleId`, `primaryName`, `subTags`)
SELECT
  `id`,
  CASE
    WHEN `tags` IS NULL OR JSON_LENGTH(`tags`) = 0 THEN '未分类'
    ELSE LEFT(TRIM(JSON_UNQUOTE(JSON_EXTRACT(`tags`, '$[0]'))), 64)
  END,
  CASE
    WHEN `tags` IS NULL OR JSON_LENGTH(`tags`) <= 1 THEN JSON_ARRAY()
    ELSE JSON_REMOVE(`tags`, '$[0]')
  END
FROM `articles`;

SET SESSION group_concat_max_len = 32768;

-- 3. 旧标签库中不存在的主标签自动补建（同名唯一，不会产生重复主标签）。
INSERT INTO `tags` (`id`, `name`, `createdAt`, `updatedAt`)
SELECT LEFT(SHA2(CONCAT('tag:', m.`primaryName`), 256), 24), m.`primaryName`, NOW(), NOW()
FROM (SELECT DISTINCT `primaryName` FROM `tmp_tag_map`) m
LEFT JOIN `tags` t ON t.`name` = m.`primaryName`
WHERE t.`id` IS NULL;

-- 4. 回填 articles.primaryTagId 与 subTags（子标签去空白、去空串）。
UPDATE `articles` a
JOIN `tmp_tag_map` m ON m.`articleId` = a.`id`
JOIN `tags` t ON t.`name` = m.`primaryName`
SET
  a.`primaryTagId` = t.`id`,
  a.`subTags` = CAST(CONCAT('[', COALESCE((
    SELECT GROUP_CONCAT(JSON_QUOTE(d.`tag`) ORDER BY d.`firstOrd` SEPARATOR ',')
    FROM (
      SELECT TRIM(jt.`tag`) AS `tag`, MIN(jt.`ord`) AS `firstOrd`
      FROM JSON_TABLE(m.`subTags`, '$[*]' COLUMNS (`ord` FOR ORDINALITY, `tag` VARCHAR(64) PATH '$')) jt
      WHERE TRIM(jt.`tag`) <> ''
      GROUP BY TRIM(jt.`tag`)
    ) d
  ), ''), ']') AS JSON);

-- 5. 每篇文章必须且只能有一个主标签。
ALTER TABLE `articles`
  MODIFY COLUMN `primaryTagId` VARCHAR(24) COLLATE utf8mb4_unicode_ci NOT NULL;
ALTER TABLE `articles`
  ADD KEY `articles_primary_tag_id` (`primaryTagId`);

-- 6. 旧分类与互动字段删除；普通用户体系、评论、通知、AI 配置整体移除。
ALTER TABLE `articles`
  DROP COLUMN `tags`,
  DROP COLUMN `likedBy`,
  DROP COLUMN `favoritedBy`,
  DROP COLUMN `likes`,
  DROP COLUMN `favorites`,
  DROP COLUMN `authorType`,
  DROP COLUMN `authorId`,
  DROP COLUMN `authorName`;

DROP TABLE `comments`;
DROP TABLE `notifications`;
DROP TABLE `users`;
DROP TABLE `ai_configs`;
DROP TABLE `tmp_tag_map`;
