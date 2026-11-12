// Package service 承载业务逻辑：直接使用 GORM 访问数据库，不引入额外仓储抽象。
package service

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log"
	"strings"

	"github.com/go-sql-driver/mysql"
	"gorm.io/gorm"

	"blog-server/internal/httpx"
	"blog-server/internal/model"
)

// NewID 生成 24 位十六进制主键（与旧版 randomBytes(12).toString('hex') 一致）。
func NewID() string {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		panic(err)
	}
	return hex.EncodeToString(buf)
}

// EscapeLike 转义 LIKE 通配符（\\ % _），避免用户输入被当成模式。
func EscapeLike(s string) string {
	var b strings.Builder
	for _, r := range s {
		switch r {
		case '\\', '%', '_':
			b.WriteByte('\\')
		}
		b.WriteRune(r)
	}
	return b.String()
}

// NormalizeSubTags 去空白、去空串、去重，并保持首次出现顺序。
func NormalizeSubTags(tags []string) []string {
	seen := make(map[string]struct{}, len(tags))
	out := make([]string, 0, len(tags))
	for _, t := range tags {
		t = strings.TrimSpace(t)
		if t == "" {
			continue
		}
		if _, ok := seen[t]; ok {
			continue
		}
		seen[t] = struct{}{}
		out = append(out, t)
	}
	return out
}

// isMySQLErr 判断是否为指定编号的 MySQL 错误。
// 1451：父表行仍被子表引用（删除被拒）；1452：子表引用的父表行不存在。
func isMySQLErr(err error, number uint16) bool {
	var me *mysql.MySQLError
	return errors.As(err, &me) && me.Number == number
}

// FindPrimaryTag 按 id 查主标签，不存在时返回 400。
func FindPrimaryTag(db *gorm.DB, id string) (*model.Tag, error) {
	var tag model.Tag
	err := db.Where("id = ?", id).Take(&tag).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, httpx.BadRequest("请选择有效的主标签")
		}
		return nil, err
	}
	return &tag, nil
}

// logWarn 输出诊断日志，不包含敏感信息。
func logWarn(format string, args ...any) { log.Printf("[warn] "+format, args...) }

// isRecordNotFound 判断 GORM 未命中记录。
func isRecordNotFound(err error) bool { return errors.Is(err, gorm.ErrRecordNotFound) }
