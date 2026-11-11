// Package migrate 提供版本化 SQL 迁移的执行器。
//
// 设计约束（与任务书一致）：
//   - 生产环境不使用 GORM AutoMigrate，表结构只由 migrations/*.sql 演进；
//   - 每个迁移只在首次出现时执行一次，记录在 schema_migrations；
//   - 0000_legacy_schema.sql 是既有生产库的基线，若库中已存在业务表，
//     只登记版本而不执行（避免 DROP TABLE 破坏线上数据）。
package migrate

import (
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"gorm.io/gorm"

	"blog-server/migrations"
)

const createSchemaTable = "CREATE TABLE IF NOT EXISTS `schema_migrations` (" +
	"`version` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL," +
	"`appliedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP," +
	"PRIMARY KEY (`version`)" +
	") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"

// legacyBaseline 是既有生产库的基线版本号。
const legacyBaseline = "0000_legacy_schema"

// Apply 依次应用尚未执行的迁移，返回本次新应用的版本列表。
func Apply(db *gorm.DB) ([]string, error) {
	if err := db.Exec(createSchemaTable).Error; err != nil {
		return nil, fmt.Errorf("create schema_migrations: %w", err)
	}
	if err := db.Exec(createApprovalsTable).Error; err != nil {
		return nil, fmt.Errorf("create migration_approvals: %w", err)
	}
	names, err := migrationFiles()
	if err != nil {
		return nil, err
	}

	applied := make([]string, 0, len(names))
	for _, name := range names {
		version := strings.TrimSuffix(name, ".sql")
		done, err := isApplied(db, version)
		if err != nil {
			return applied, err
		}
		if done {
			continue
		}
		if version == legacyBaseline && legacySchemaPresent(db) {
			if err := record(db, version); err != nil {
				return applied, err
			}
			applied = append(applied, version)
			continue
		}
		if version == TagMapVersion {
			if err := requireTagApproval(db); err != nil {
				return applied, err
			}
		}
		body, err := migrations.FS.ReadFile(name)
		if err != nil {
			return applied, fmt.Errorf("read %s: %w", name, err)
		}
		if err := applyFile(db, version, string(body)); err != nil {
			return applied, fmt.Errorf("apply %s: %w", name, err)
		}
		applied = append(applied, version)
	}
	return applied, nil
}

func migrationFiles() ([]string, error) {
	entries, err := fs.ReadDir(migrations.FS, ".")
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		names = append(names, e.Name())
	}
	sort.Strings(names)
	return names, nil
}

func isApplied(db *gorm.DB, version string) (bool, error) {
	var count int64
	if err := db.Table("schema_migrations").Where("version = ?", version).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func record(tx *gorm.DB, version string) error {
	return tx.Exec("INSERT INTO `schema_migrations` (`version`) VALUES (?)", version).Error
}

// legacySchemaPresent 判断库里是否已经存在旧版业务表（用于基线登记）。
func legacySchemaPresent(db *gorm.DB) bool {
	m := db.Migrator()
	return m.HasTable("admins") || m.HasTable("articles")
}

func applyFile(db *gorm.DB, version, body string) error {
	statements := splitStatements(body)
	if len(statements) == 0 {
		return record(db, version)
	}
	return db.Transaction(func(tx *gorm.DB) error {
		for i, stmt := range statements {
			if err := tx.Exec(stmt).Error; err != nil {
				return fmt.Errorf("statement %d: %w", i+1, err)
			}
		}
		return record(tx, version)
	})
}

// splitStatements 按行尾分号切分 SQL。
//
// 迁移文件由 mysqldump 生成，语句之间只有换行与注释，不含带分号的字符串字面量，
// 因此按「整行以分号结尾」切分即可覆盖当前全部脚本。
func splitStatements(body string) []string {
	var out []string
	var cur strings.Builder
	for _, line := range strings.Split(body, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		cur.WriteString(line)
		cur.WriteString("\n")
		if strings.HasSuffix(trimmed, ";") {
			stmt := strings.TrimSpace(cur.String())
			stmt = strings.TrimSuffix(stmt, ";")
			if strings.TrimSpace(stmt) != "" {
				out = append(out, stmt)
			}
			cur.Reset()
		}
	}
	if rest := strings.TrimSpace(cur.String()); rest != "" {
		out = append(out, strings.TrimSuffix(rest, ";"))
	}
	return out
}
