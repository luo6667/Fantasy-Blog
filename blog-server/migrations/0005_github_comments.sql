-- 0005_github_comments：GitHub 身份的文章评论与单选表情。
-- 管理员账号体系保持不变；此处只保存公开 GitHub 资料。

CREATE TABLE `github_commenters` (
  `id` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL,
  `githubId` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `login` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `avatarUrl` varchar(2048) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `profileUrl` varchar(2048) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `github_commenters_github_id` (`githubId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `article_comments` (
  `id` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL,
  `articleId` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL,
  `commenterId` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `article_comments_article_created` (`articleId`, `createdAt`),
  KEY `article_comments_commenter` (`commenterId`),
  CONSTRAINT `fk_article_comments_article` FOREIGN KEY (`articleId`) REFERENCES `articles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_article_comments_commenter` FOREIGN KEY (`commenterId`) REFERENCES `github_commenters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `article_reactions` (
  `articleId` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL,
  `commenterId` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('love', 'confused', 'correction') COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`articleId`, `commenterId`),
  KEY `article_reactions_article_type` (`articleId`, `type`),
  CONSTRAINT `fk_article_reactions_article` FOREIGN KEY (`articleId`) REFERENCES `articles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_article_reactions_commenter` FOREIGN KEY (`commenterId`) REFERENCES `github_commenters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
