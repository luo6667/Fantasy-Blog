package migrate

import (
	"os"
	"strings"
	"testing"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"gorm.io/gorm"

	"blog-server/internal/config"
	"blog-server/internal/database"
	"blog-server/migrations"
)

const tagmapTestDB = "blog_tagmap_test"

func tagmapDB(t *testing.T) *gorm.DB {
	t.Helper()
	pass := os.Getenv("MYSQL_PASSWORD")
	if pass == "" {
		pass = "1234"
	}
	cfg := &config.Config{
		MySQLHost: "127.0.0.1",
		MySQLPort: 3306,
		MySQLUser: "root",
		MySQLPass: pass,
		MySQLDB:   tagmapTestDB,
	}
	if err := database.EnsureDatabase(cfg); err != nil {
		t.Skipf("MySQL 不可用：%v", err)
	}
	db, err := database.Open(cfg)
	if err != nil {
		t.Skipf("MySQL 不可用：%v", err)
	}
	if err := db.Exec("DROP TABLE IF EXISTS `migration_approvals`, `schema_migrations`, `tmp_tag_map`").Error; err != nil {
		t.Fatalf("drop tables: %v", err)
	}
	if err := db.Exec("DROP TABLE IF EXISTS `articles`, `tags`, `admins`, `comments`, `notifications`, `site_contents`, `ai_configs`").Error; err != nil {
		t.Fatalf("drop legacy tables: %v", err)
	}
	return db
}

// applyLegacyBaseline 只执行 0000，留下旧结构供映射测试使用。
func applyLegacyBaseline(t *testing.T, db *gorm.DB) {
	t.Helper()
	body, err := migrations.FS.ReadFile("0000_legacy_schema.sql")
	if err != nil {
		t.Fatalf("read baseline: %v", err)
	}
	if err := db.Exec(createSchemaTable).Error; err != nil {
		t.Fatalf("create schema table: %v", err)
	}
	if err := applyFile(db, legacyBaseline, string(body)); err != nil {
		t.Fatalf("apply baseline: %v", err)
	}
}

func insertLegacyArticle(t *testing.T, db *gorm.DB, id, title, tagsJSON string) {
	t.Helper()
	err := db.Exec("INSERT INTO `articles` (`id`,`title`,`excerpt`,`content`,`contentHtml`,`tags`,`likedBy`,`favoritedBy`) "+
		"VALUES (?,?,?,?,?,?,JSON_ARRAY(),JSON_ARRAY())",
		id, title, "摘要", "正文", "<p>正文</p>", tagsJSON).Error
	if err != nil {
		t.Fatalf("insert article %s: %v", id, err)
	}
}

func TestTagMapApprovalGate(t *testing.T) {
	db := tagmapDB(t)
	applyLegacyBaseline(t, db)
	insertLegacyArticle(t, db, "a1", "文章一", `["前端","React"," React ","React"]`)
	insertLegacyArticle(t, db, "a2", "文章二", `[]`)

	// 未审批：必须拒绝执行 0001，且旧列仍在。
	if _, err := Apply(db); err == nil || !strings.Contains(err.Error(), "标签映射未审批") {
		t.Fatalf("migrate without approval: err=%v", err)
	}

	f, err := ExportTagMap(db)
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	if len(f.Articles) != 2 {
		t.Fatalf("export articles=%d", len(f.Articles))
	}
	if f.Articles[1].PrimaryName != "未分类" {
		t.Fatalf("empty tags should map to 未分类, got %q", f.Articles[1].PrimaryName)
	}

	if problems := ValidateTagMap(db, f); len(problems) == 0 {
		t.Fatal("未填写 approvedBy 的文件不应通过校验")
	}
	f.ApprovedBy = "站长"
	f.ApprovedAt = time.Now().Format(time.RFC3339)
	if problems := ValidateTagMap(db, f); len(problems) > 0 {
		t.Fatalf("approved map should validate: %v", problems)
	}

	if err := ApplyTagMap(db, f); err != nil {
		t.Fatalf("apply map: %v", err)
	}
	applied, err := Apply(db)
	if err != nil {
		t.Fatalf("migrate after approval: %v", err)
	}
	if len(applied) < 2 {
		t.Fatalf("applied=%v，期望 0001 与 0002", applied)
	}

	var subs string
	if err := db.Raw("SELECT `subTags` FROM `articles` WHERE `id`='a1'").Scan(&subs).Error; err != nil {
		t.Fatalf("read subtags: %v", err)
	}
	if subs != `["React"]` {
		t.Fatalf("subTags=%s，期望去重且 trim 后为 [\"React\"]", subs)
	}

	var primary string
	if err := db.Raw("SELECT t.`name` FROM `articles` a JOIN `tags` t ON t.`id`=a.`primaryTagId` WHERE a.`id`='a1'").
		Scan(&primary).Error; err != nil {
		t.Fatalf("read primary: %v", err)
	}
	if primary != "前端" {
		t.Fatalf("primary=%q", primary)
	}

	// 重复执行无副作用。
	if again, err := Apply(db); err != nil || len(again) != 0 {
		t.Fatalf("second migrate: applied=%v err=%v", again, err)
	}
}

func TestNormalizeSubtagsMigrationIsIdempotent(t *testing.T) {
	db := tagmapDB(t)
	applyLegacyBaseline(t, db)
	insertLegacyArticle(t, db, "b1", "文章", `["后端"]`)
	f, err := ExportTagMap(db)
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	f.ApprovedBy = "站长"
	f.ApprovedAt = time.Now().Format(time.RFC3339)
	if err := ApplyTagMap(db, f); err != nil {
		t.Fatalf("apply: %v", err)
	}
	if _, err := Apply(db); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	// 人为写入脏数据，再跑 0002 的语句，应恢复为去重后的顺序。
	if err := db.Exec("UPDATE `articles` SET `subTags` = JSON_ARRAY('A',' A ','B','A','') WHERE `id`='b1'").Error; err != nil {
		t.Fatalf("dirty subtags: %v", err)
	}
	body, err := migrations.FS.ReadFile("0002_normalize_subtags.sql")
	if err != nil {
		t.Fatalf("read 0002: %v", err)
	}
	tx := db.Begin()
	for _, stmt := range splitStatements(string(body)) {
		if err := tx.Exec(stmt).Error; err != nil {
			tx.Rollback()
			t.Fatalf("run 0002: %v", err)
		}
	}
	if err := tx.Commit().Error; err != nil {
		t.Fatalf("commit 0002: %v", err)
	}
	var subs string
	if err := db.Raw("SELECT `subTags` FROM `articles` WHERE `id`='b1'").Scan(&subs).Error; err != nil {
		t.Fatalf("read subtags: %v", err)
	}
	if subs != `["A", "B"]` && subs != `["A","B"]` {
		t.Fatalf("subTags=%s，期望 [A,B]", subs)
	}
}
