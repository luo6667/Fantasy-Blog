// Package migrations 内嵌版本化的 SQL 迁移文件。
//
// 迁移文件按文件名升序执行，文件名前缀即版本号；生产环境只通过
// `server migrate` 应用迁移，绝不使用 GORM AutoMigrate。
package migrations

import "embed"

// FS 是内嵌的迁移脚本集合。
//
//go:embed *.sql
var FS embed.FS
