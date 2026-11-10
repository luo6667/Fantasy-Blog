package service

import (
	"gorm.io/gorm"

	"blog-server/internal/httpx"
	"blog-server/internal/model"
)

// TagItem 是标签库条目（含文章数）。
type TagItem struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Count int64  `json:"count"`
}

// ListTagLibrary 返回标签库全部标签及文章数。
func ListTagLibrary(db *gorm.DB) ([]TagItem, error) {
	var tags []model.Tag
	if err := db.Order("createdAt ASC").Find(&tags).Error; err != nil {
		return nil, err
	}

	var rows []TagCount
	err := db.Raw(`SELECT jt.tag AS name, COUNT(*) AS count
		FROM articles, JSON_TABLE(articles.tags, '$[*]' COLUMNS (tag VARCHAR(64) PATH '$')) AS jt
		GROUP BY jt.tag`).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	counts := make(map[string]int64, len(rows))
	for _, r := range rows {
		counts[r.Name] = r.Count
	}

	out := make([]TagItem, 0, len(tags))
	for _, t := range tags {
		out = append(out, TagItem{ID: t.ID, Name: t.Name, Count: counts[t.Name]})
	}
	return out, nil
}

// CreateTag 新增标签（重名返回 409）。
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

// DeleteTag 删除标签并从所有文章中移除该标签。
func DeleteTag(db *gorm.DB, name string) (map[string]string, error) {
	res := db.Where("name = ?", name).Delete(&model.Tag{})
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, httpx.NotFound("标签「" + name + "」不存在")
	}

	var articles []model.Article
	if err := db.Where("JSON_CONTAINS(tags, JSON_QUOTE(?))", name).Find(&articles).Error; err != nil {
		return nil, err
	}
	for i := range articles {
		a := &articles[i]
		kept := make(model.StringList, 0, len(a.Tags))
		for _, t := range a.Tags {
			if t != name {
				kept = append(kept, t)
			}
		}
		a.Tags = kept
		if err := db.Save(a).Error; err != nil {
			return nil, err
		}
	}

	triggerRevalidate([]string{"/blog", "/blog/[id]"})
	return map[string]string{"name": name}, nil
}
