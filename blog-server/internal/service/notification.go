package service

import (
	"gorm.io/gorm"

	"blog-server/internal/httpx"
	"blog-server/internal/model"
)

// NotificationItem 是通知视图（空字段省略）。
type NotificationItem struct {
	ID             string     `json:"id"`
	Type           string     `json:"type"`
	ActorName      string     `json:"actorName"`
	ActorType      string     `json:"actorType"`
	ArticleID      *string    `json:"articleId,omitempty"`
	ArticleTitle   *string    `json:"articleTitle,omitempty"`
	CommentContent *string    `json:"commentContent,omitempty"`
	Read           bool       `json:"read"`
	CreatedAt      httpx.Time `json:"createdAt"`
}

// ListNotifications 当前用户通知（倒序，最多 50 条）。
func ListNotifications(db *gorm.DB, role, id string) ([]NotificationItem, error) {
	var docs []model.Notification
	err := db.Where("recipientType = ? AND recipientId = ?", role, id).
		Order("createdAt DESC").
		Limit(50).
		Find(&docs).Error
	if err != nil {
		return nil, err
	}
	out := make([]NotificationItem, 0, len(docs))
	for i := range docs {
		d := &docs[i]
		out = append(out, NotificationItem{
			ID:             d.ID,
			Type:           d.Type,
			ActorName:      d.ActorName,
			ActorType:      d.ActorType,
			ArticleID:      d.ArticleID,
			ArticleTitle:   d.ArticleTitle,
			CommentContent: d.CommentContent,
			Read:           d.Read,
			CreatedAt:      httpx.Time(d.CreatedAt),
		})
	}
	return out, nil
}

// UnreadNotificationCount 返回未读数。
func UnreadNotificationCount(db *gorm.DB, role, id string) (int64, error) {
	var count int64
	err := db.Model(&model.Notification{}).
		Where("recipientType = ? AND recipientId = ? AND `read` = ?", role, id, false).
		Count(&count).Error
	return count, err
}

// MarkNotificationsRead 标记已读（ids 为空表示全部）。
func MarkNotificationsRead(db *gorm.DB, role, id string, ids []string) error {
	q := db.Model(&model.Notification{}).Where("recipientType = ? AND recipientId = ?", role, id)
	if len(ids) > 0 {
		q = q.Where("id IN ?", ids)
	}
	return q.Updates(map[string]any{"read": true}).Error
}
