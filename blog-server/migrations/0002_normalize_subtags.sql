-- 0002_normalize_subtags：幂等归一化子标签（trim、去空、去重、保持首次出现顺序）。
--
-- 适用场景：0001 已执行、但旧文章的子标签可能包含空白/重复项（早期 0001 未去重）。
-- 该迁移可重复执行且不改动主标签；对已是干净数据没有影响。

CREATE TEMPORARY TABLE `tmp_subtags_norm` (
  `articleId` VARCHAR(24) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subTags` JSON NOT NULL,
  PRIMARY KEY (`articleId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET SESSION group_concat_max_len = 32768;

INSERT INTO `tmp_subtags_norm` (`articleId`, `subTags`)
SELECT s.`id`, CAST(CONCAT('[', COALESCE(GROUP_CONCAT(JSON_QUOTE(s.`tag`) ORDER BY s.`firstOrd` SEPARATOR ','), ''), ']') AS JSON)
FROM (
  SELECT a.`id` AS `id`, TRIM(jt.`tag`) AS `tag`, MIN(jt.`ord`) AS `firstOrd`
  FROM `articles` a
  JOIN JSON_TABLE(a.`subTags`, '$[*]' COLUMNS (`ord` FOR ORDINALITY, `tag` VARCHAR(128) PATH '$')) jt
  WHERE TRIM(jt.`tag`) <> ''
  GROUP BY a.`id`, TRIM(jt.`tag`)
) s
GROUP BY s.`id`;

UPDATE `articles` a
JOIN `tmp_subtags_norm` n ON n.`articleId` = a.`id`
SET a.`subTags` = n.`subTags`;

UPDATE `articles`
SET `subTags` = JSON_ARRAY()
WHERE `subTags` IS NULL OR JSON_LENGTH(`subTags`) = 0;

DROP TEMPORARY TABLE `tmp_subtags_norm`;
