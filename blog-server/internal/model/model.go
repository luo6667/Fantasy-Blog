// Package model 定义 GORM 映射。表名、列名、长度、默认值全部与既有库保持一致，
// 不做任何自动迁移（生产只用 migrations/ 下的版本化 SQL）。
package model

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// StringList 映射 MySQL JSON 列中的字符串数组。
type StringList []string

// Value 实现 driver.Valuer。
func (s StringList) Value() (driver.Value, error) {
	if s == nil {
		s = StringList{}
	}
	b, err := json.Marshal([]string(s))
	return string(b), err
}

// Scan 实现 sql.Scanner。
func (s *StringList) Scan(value any) error {
	if value == nil {
		*s = StringList{}
		return nil
	}
	var raw []byte
	switch v := value.(type) {
	case []byte:
		raw = v
	case string:
		raw = []byte(v)
	default:
		return fmt.Errorf("StringList: unsupported scan type %T", value)
	}
	if len(raw) == 0 {
		*s = StringList{}
		return nil
	}
	var out []string
	if err := json.Unmarshal(raw, &out); err != nil {
		return err
	}
	*s = out
	return nil
}

// JSONValue 映射 MySQL JSON 列，按原始字节保存/读取。
type JSONValue json.RawMessage

// Value 实现 driver.Valuer。
func (j JSONValue) Value() (driver.Value, error) {
	if len(j) == 0 {
		return "null", nil
	}
	return string(j), nil
}

// Scan 实现 sql.Scanner。
func (j *JSONValue) Scan(value any) error {
	switch v := value.(type) {
	case nil:
		*j = JSONValue("null")
	case []byte:
		*j = append((*j)[:0], v...)
	case string:
		*j = JSONValue(v)
	default:
		return fmt.Errorf("JSONValue: unsupported scan type %T", value)
	}
	return nil
}

// MarshalJSON 让 JSONValue 直接作为 JSON 输出。
func (j JSONValue) MarshalJSON() ([]byte, error) {
	if len(j) == 0 {
		return []byte("null"), nil
	}
	return j, nil
}

// User 对应 users 表。
type User struct {
	ID        string    `gorm:"column:id;primaryKey;size:24"`
	Username  string    `gorm:"column:username;size:32;uniqueIndex"`
	Password  string    `gorm:"column:password;size:255"`
	CreatedAt time.Time `gorm:"column:createdAt"`
	UpdatedAt time.Time `gorm:"column:updatedAt"`
}

// TableName users。
func (User) TableName() string { return "users" }

// Admin 对应 admins 表。
type Admin struct {
	ID        string    `gorm:"column:id;primaryKey;size:24"`
	Username  string    `gorm:"column:username;size:32;uniqueIndex"`
	Password  string    `gorm:"column:password;size:255"`
	CreatedAt time.Time `gorm:"column:createdAt"`
	UpdatedAt time.Time `gorm:"column:updatedAt"`
}

// TableName admins。
func (Admin) TableName() string { return "admins" }

// Article 对应 articles 表。
type Article struct {
	ID          string     `gorm:"column:id;primaryKey;size:24"`
	Title       string     `gorm:"column:title;size:200"`
	Excerpt     string     `gorm:"column:excerpt;size:500"`
	Content     string     `gorm:"column:content"`
	ContentHTML string     `gorm:"column:contentHtml"`
	Tags        StringList `gorm:"column:tags"`
	Cover       string     `gorm:"column:cover;size:2048"`
	AuthorType  *string    `gorm:"column:authorType"`
	AuthorID    *string    `gorm:"column:authorId;size:24"`
	AuthorName  *string    `gorm:"column:authorName;size:32"`
	LikedBy     StringList `gorm:"column:likedBy"`
	FavoritedBy StringList `gorm:"column:favoritedBy"`
	Likes       int        `gorm:"column:likes"`
	Favorites   int        `gorm:"column:favorites"`
	CreatedAt   time.Time  `gorm:"column:createdAt"`
	UpdatedAt   time.Time  `gorm:"column:updatedAt"`
}

// TableName articles。
func (Article) TableName() string { return "articles" }

// Comment 对应 comments 表。
type Comment struct {
	ID         string     `gorm:"column:id;primaryKey;size:24"`
	ArticleID  string     `gorm:"column:articleId;size:24"`
	ParentID   *string    `gorm:"column:parentId;size:24"`
	AuthorType string     `gorm:"column:authorType"`
	AuthorID   string     `gorm:"column:authorId;size:24"`
	AuthorName string     `gorm:"column:authorName;size:32"`
	Content    string     `gorm:"column:content;size:1000"`
	LikedBy    StringList `gorm:"column:likedBy"`
	CreatedAt  time.Time  `gorm:"column:createdAt"`
	UpdatedAt  time.Time  `gorm:"column:updatedAt"`
}

// TableName comments。
func (Comment) TableName() string { return "comments" }

// Tag 对应 tags 表。
type Tag struct {
	ID        string    `gorm:"column:id;primaryKey;size:24"`
	Name      string    `gorm:"column:name;size:32;uniqueIndex"`
	CreatedAt time.Time `gorm:"column:createdAt"`
	UpdatedAt time.Time `gorm:"column:updatedAt"`
}

// TableName tags。
func (Tag) TableName() string { return "tags" }

// Notification 对应 notifications 表。
type Notification struct {
	ID             string    `gorm:"column:id;primaryKey;size:24"`
	RecipientType  string    `gorm:"column:recipientType"`
	RecipientID    string    `gorm:"column:recipientId;size:24"`
	Type           string    `gorm:"column:type"`
	ActorType      string    `gorm:"column:actorType"`
	ActorID        string    `gorm:"column:actorId;size:24"`
	ActorName      string    `gorm:"column:actorName;size:32"`
	ArticleID      *string   `gorm:"column:articleId;size:24"`
	ArticleTitle   *string   `gorm:"column:articleTitle;size:200"`
	CommentID      *string   `gorm:"column:commentId;size:24"`
	CommentContent *string   `gorm:"column:commentContent;size:1000"`
	Read           bool      `gorm:"column:read"`
	CreatedAt      time.Time `gorm:"column:createdAt"`
	UpdatedAt      time.Time `gorm:"column:updatedAt"`
}

// TableName notifications。
func (Notification) TableName() string { return "notifications" }

// SiteContent 对应 site_contents 表。
type SiteContent struct {
	ID        string    `gorm:"column:id;primaryKey;size:24"`
	Key       string    `gorm:"column:key;size:32;uniqueIndex"`
	Value     JSONValue `gorm:"column:value"`
	CreatedAt time.Time `gorm:"column:createdAt"`
	UpdatedAt time.Time `gorm:"column:updatedAt"`
}

// TableName site_contents。
func (SiteContent) TableName() string { return "site_contents" }

// AIConfig 对应 ai_configs 表。
type AIConfig struct {
	ID        string    `gorm:"column:id;primaryKey;size:24"`
	BaseURL   string    `gorm:"column:baseURL;size:500"`
	APIKey    string    `gorm:"column:apiKey"`
	ModelName string    `gorm:"column:modelName;size:100"`
	CreatedAt time.Time `gorm:"column:createdAt"`
	UpdatedAt time.Time `gorm:"column:updatedAt"`
}

// TableName ai_configs。
func (AIConfig) TableName() string { return "ai_configs" }
