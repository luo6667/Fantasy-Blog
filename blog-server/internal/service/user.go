package service

import (
	"errors"

	"gorm.io/gorm"

	"blog-server/internal/httpx"
	"blog-server/internal/model"
)

// UserManageItem 是管理端用户列表项。
type UserManageItem struct {
	ID           string     `json:"id"`
	Username     string     `json:"username"`
	CreatedAt    httpx.Time `json:"createdAt"`
	CommentCount int64      `json:"commentCount"`
}

// ListUsers 返回普通用户及其评论数（注册时间倒序）。
func ListUsers(db *gorm.DB) ([]UserManageItem, error) {
	var users []model.User
	if err := db.Order("createdAt DESC").Find(&users).Error; err != nil {
		return nil, err
	}

	type row struct {
		AuthorID string
		Count    int64
	}
	var rows []row
	err := db.Model(&model.Comment{}).
		Select("authorId AS author_id, COUNT(*) AS count").
		Where("authorType = ?", "user").
		Group("authorId").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	counts := make(map[string]int64, len(rows))
	for _, r := range rows {
		counts[r.AuthorID] = r.Count
	}

	out := make([]UserManageItem, 0, len(users))
	for _, u := range users {
		out = append(out, UserManageItem{
			ID:           u.ID,
			Username:     u.Username,
			CreatedAt:    httpx.Time(u.CreatedAt),
			CommentCount: counts[u.ID],
		})
	}
	return out, nil
}

// DeleteUser 删除用户及其评论、通知与文章。
func DeleteUser(db *gorm.DB, id string) (map[string]string, error) {
	var user model.User
	if err := db.Select("id").Where("id = ?", id).Take(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, httpx.NotFound("用户不存在")
		}
		return nil, err
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ?", id).Delete(&model.User{}).Error; err != nil {
			return err
		}
		if err := tx.Where("authorType = ? AND authorId = ?", "user", id).Delete(&model.Comment{}).Error; err != nil {
			return err
		}
		if err := tx.Where("recipientType = ? AND recipientId = ?", "user", id).Delete(&model.Notification{}).Error; err != nil {
			return err
		}
		if err := tx.Where("actorType = ? AND actorId = ?", "user", id).Delete(&model.Notification{}).Error; err != nil {
			return err
		}
		if err := tx.Where("authorType = ? AND authorId = ?", "user", id).Delete(&model.Article{}).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return map[string]string{"id": id}, nil
}
