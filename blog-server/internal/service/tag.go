package service

import (
	"gorm.io/gorm"

	"blog-server/internal/httpx"
	"blog-server/internal/model"
)

// TagItem 是主标签库条目（含引用该标签的文章数）。
type TagItem struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Count int64  `json:"count"`
}

// ListTags 返回主标签库全部标签及文章数，按创建时间升序。
func ListTags(db *gorm.DB) ([]TagItem, error) {
	var rows []TagItem
	err := db.Table("tags").
		Select("tags.id, tags.name, COUNT(articles.id) AS count").
		Joins("LEFT JOIN articles ON articles.primaryTagId = tags.id").
		Group("tags.id, tags.name, tags.createdAt").
		Order("tags.createdAt ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []TagItem{}
	}
	return rows, nil
}

// CreateTag 新增主标签（重名返回 409）。
func CreateTag(db *gorm.DB, name string) (*TagItem, error) {
	doc := model.Tag{ID: NewID(), Name: name}
	if err := db.Create(&doc).Error; err != nil {
		if IsDuplicateKey(err) {
			return nil, httpx.Conflict("标签「" + name + "」已存在")
		}
		return nil, err
	}
	return &TagItem{ID: doc.ID, Name: doc.Name, Count: 0}, nil
}

// RenameTag 修改主标签名称（重名返回 409）。
func RenameTag(db *gorm.DB, id, name string) (*TagItem, error) {
	var doc model.Tag
	if err := db.Where("id = ?", id).Take(&doc).Error; err != nil {
		if isRecordNotFound(err) {
			return nil, httpx.NotFound("标签不存在")
		}
		return nil, err
	}
	if doc.Name != name {
		if err := db.Model(&doc).Update("name", name).Error; err != nil {
			if IsDuplicateKey(err) {
				return nil, httpx.Conflict("标签「" + name + "」已存在")
			}
			return nil, err
		}
	}
	triggerRevalidate([]string{"/blog", "/blog/[id]"})
	return tagWithCount(db, id)
}

// DeleteTag 删除未被引用的主标签；仍有文章引用时返回 409。
func DeleteTag(db *gorm.DB, id string) (map[string]string, error) {
	var doc model.Tag
	if err := db.Where("id = ?", id).Take(&doc).Error; err != nil {
		if isRecordNotFound(err) {
			return nil, httpx.NotFound("标签不存在")
		}
		return nil, err
	}
	var count int64
	if err := db.Model(&model.Article{}).Where("primaryTagId = ?", id).Count(&count).Error; err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, httpx.Conflict("该主标签下仍有文章，请先调整文章分类")
	}
	if err := db.Where("id = ?", id).Delete(&model.Tag{}).Error; err != nil {
		return nil, err
	}
	triggerRevalidate([]string{"/blog", "/blog/[id]"})
	return map[string]string{"id": id, "name": doc.Name}, nil
}

func tagWithCount(db *gorm.DB, id string) (*TagItem, error) {
	var item TagItem
	err := db.Table("tags").
		Select("tags.id, tags.name, COUNT(articles.id) AS count").
		Joins("LEFT JOIN articles ON articles.primaryTagId = tags.id").
		Where("tags.id = ?", id).
		Group("tags.id, tags.name").
		Take(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}
