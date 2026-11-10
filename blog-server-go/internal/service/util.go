// Package service 承载业务逻辑：与旧 Node 版 services 一一对应，
// 直接使用 GORM 访问数据库，不引入额外仓储抽象。
package service

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log"
	"strings"

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

// LikeKey 返回点赞/收藏数组中的主体标识 "role:id"。
func LikeKey(role, id string) string { return role + ":" + id }

// EscapeLike 转义 LIKE 通配符（\ % _），避免用户输入被当成模式。
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

// NormalizeTags 去空白、去重并保持首次出现顺序。
func NormalizeTags(tags []string) []string {
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

// Recipient 是通知接收者。
type Recipient struct {
	Role string
	ID   string
}

// ResolveArticleRecipient 优先返回文章作者；旧数据无作者时回退到第一个管理员。
func ResolveArticleRecipient(db *gorm.DB, article *model.Article) (*Recipient, error) {
	if article.AuthorID != nil && article.AuthorType != nil && *article.AuthorID != "" && *article.AuthorType != "" {
		return &Recipient{Role: *article.AuthorType, ID: *article.AuthorID}, nil
	}
	var admin model.Admin
	err := db.Select("id").Order("createdAt ASC").Take(&admin).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &Recipient{Role: "admin", ID: admin.ID}, nil
}

// NotificationInput 是创建通知的入参。
type NotificationInput struct {
	Recipient      Recipient
	Actor          Actor
	Type           string
	ArticleID      string
	ArticleTitle   string
	CommentID      string
	CommentContent string
}

// Actor 是当前操作主体（与 auth.Actor 字段一致，避免循环依赖）。
type Actor struct {
	ID       string
	Username string
	Role     string
}

// CreateNotification 落库一条通知。
func CreateNotification(db *gorm.DB, in NotificationInput) error {
	n := model.Notification{
		ID:            NewID(),
		RecipientType: in.Recipient.Role,
		RecipientID:   in.Recipient.ID,
		Type:          in.Type,
		ActorType:     in.Actor.Role,
		ActorID:       in.Actor.ID,
		ActorName:     in.Actor.Username,
	}
	if in.ArticleID != "" {
		v := in.ArticleID
		n.ArticleID = &v
	}
	if in.ArticleTitle != "" {
		v := in.ArticleTitle
		n.ArticleTitle = &v
	}
	if in.CommentID != "" {
		v := in.CommentID
		n.CommentID = &v
	}
	if in.CommentContent != "" {
		v := in.CommentContent
		n.CommentContent = &v
	}
	if err := db.Create(&n).Error; err != nil {
		return err
	}
	return nil
}

// assertTagsExist 校验标签都存在于标签库。
func assertTagsExist(db *gorm.DB, tags []string) error {
	var found []string
	if err := db.Model(&model.Tag{}).Where("name IN ?", tags).Pluck("name", &found).Error; err != nil {
		return err
	}
	have := make(map[string]struct{}, len(found))
	for _, name := range found {
		have[name] = struct{}{}
	}
	missing := make([]string, 0)
	for _, t := range tags {
		if _, ok := have[t]; !ok {
			missing = append(missing, t)
		}
	}
	if len(missing) > 0 {
		return httpx.BadRequest("标签「" + strings.Join(missing, "、") + "」不存在，请先在标签库中添加")
	}
	return nil
}

// logWarn 输出诊断日志，不包含敏感信息。
func logWarn(format string, args ...any) { log.Printf("[warn] "+format, args...) }
