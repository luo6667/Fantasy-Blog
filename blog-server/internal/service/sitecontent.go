package service

import (
	_ "embed"
	"encoding/json"
	"errors"
	"time"

	"gorm.io/gorm"

	"blog-server/internal/httpx"
	"blog-server/internal/model"
)

//go:embed sitecontent_defaults.json
var siteContentDefaultsJSON []byte

// SiteContentKeys 是站点内容 key 的固定顺序（与旧版 SITE_CONTENT_KEYS 一致）。
var SiteContentKeys = []string{
	"education",
	"skills",
	"resumeProjects",
	"evaluation",
	"homeProjects",
	"plan",
}

// siteContentDefaults 保存每个 key 的默认 JSON。
var siteContentDefaults = func() map[string]json.RawMessage {
	var out map[string]json.RawMessage
	if err := json.Unmarshal(siteContentDefaultsJSON, &out); err != nil {
		panic("site content defaults: " + err.Error())
	}
	return out
}()

// DefaultSiteContent 返回某 key 的默认值（深拷贝由调用方保证）。
func DefaultSiteContent(key string) (json.RawMessage, bool) {
	v, ok := siteContentDefaults[key]
	if !ok {
		return nil, false
	}
	dup := make(json.RawMessage, len(v))
	copy(dup, v)
	return dup, true
}

// IsSiteContentKey 判断 key 是否合法。
func IsSiteContentKey(key string) bool {
	for _, k := range SiteContentKeys {
		if k == key {
			return true
		}
	}
	return false
}

// SiteContentItem 是对外的站点内容视图。
type SiteContentItem struct {
	ID        string          `json:"id"`
	Key       string          `json:"key"`
	Value     json.RawMessage `json:"value"`
	UpdatedAt httpx.Time      `json:"updatedAt"`
}

func siteContentItem(doc *model.SiteContent) SiteContentItem {
	value := json.RawMessage(doc.Value)
	if len(value) == 0 {
		value = json.RawMessage("null")
	}
	return SiteContentItem{
		ID:        doc.ID,
		Key:       doc.Key,
		Value:     value,
		UpdatedAt: httpx.Time(doc.UpdatedAt),
	}
}

// SeedSiteContent 补齐缺失 key 的默认值（幂等）。
func SeedSiteContent(db *gorm.DB) error {
	var keys []string
	if err := db.Model(&model.SiteContent{}).Pluck("key", &keys).Error; err != nil {
		return err
	}
	have := make(map[string]struct{}, len(keys))
	for _, k := range keys {
		have[k] = struct{}{}
	}
	for _, key := range SiteContentKeys {
		if _, ok := have[key]; ok {
			continue
		}
		value, _ := DefaultSiteContent(key)
		doc := model.SiteContent{ID: NewID(), Key: key, Value: model.JSONValue(value)}
		if err := db.Create(&doc).Error; err != nil {
			return err
		}
	}
	return nil
}

// ListSiteContents 返回全部内容（按 key 升序，缺失先补齐）。
func ListSiteContents(db *gorm.DB) ([]SiteContentItem, error) {
	if err := SeedSiteContent(db); err != nil {
		return nil, err
	}
	var docs []model.SiteContent
	if err := db.Where("`key` IN ?", SiteContentKeys).Order("`key` ASC").Find(&docs).Error; err != nil {
		return nil, err
	}
	items := make([]SiteContentItem, 0, len(docs))
	for i := range docs {
		items = append(items, siteContentItem(&docs[i]))
	}
	return items, nil
}

// GetSiteContent 读取单个内容；缺失时懒写入默认值。
func GetSiteContent(db *gorm.DB, key string) (*SiteContentItem, error) {
	if !IsSiteContentKey(key) {
		return nil, httpx.BadRequest("SiteContent.value cannot be null")
	}
	var doc model.SiteContent
	err := db.Where("`key` = ?", key).Take(&doc).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		value, _ := DefaultSiteContent(key)
		doc = model.SiteContent{ID: NewID(), Key: key, Value: model.JSONValue(value)}
		if err := db.Create(&doc).Error; err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}
	item := siteContentItem(&doc)
	return &item, nil
}

// UpdateSiteContent 整体替换某 key 的 value 并触发静态页重建。
func UpdateSiteContent(db *gorm.DB, key string, value json.RawMessage) (*SiteContentItem, error) {
	var doc model.SiteContent
	err := db.Where("`key` = ?", key).Take(&doc).Error
	now := time.Now()
	if errors.Is(err, gorm.ErrRecordNotFound) {
		doc = model.SiteContent{ID: NewID(), Key: key, Value: model.JSONValue(value), UpdatedAt: now}
		if err := db.Create(&doc).Error; err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	} else {
		doc.Value = model.JSONValue(value)
		doc.UpdatedAt = now
		if err := db.Save(&doc).Error; err != nil {
			return nil, err
		}
	}
	item := siteContentItem(&doc)
	return &item, nil
}
