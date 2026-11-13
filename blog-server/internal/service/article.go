package service

import (
	"errors"

	"gorm.io/gorm"

	"blog-server/internal/httpx"
	"blog-server/internal/model"
)

// ArticleListQuery 是文章列表查询参数。Tag 为主标签名。
type ArticleListQuery struct {
	Page     int
	PageSize int
	Tag      string
	Search   string
}

// PrimaryTag 是文章所属的主标签。
type PrimaryTag struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// ArticleListItem 是列表视图（不含正文）。
type ArticleListItem struct {
	ID         string     `json:"id"`
	Title      string     `json:"title"`
	Excerpt    string     `json:"excerpt"`
	PrimaryTag PrimaryTag `json:"primaryTag"`
	SubTags    []string   `json:"subTags"`
	Cover      string     `json:"cover,omitempty"`
	Date       string     `json:"date"`
	CreatedAt  httpx.Time `json:"createdAt"`
	UpdatedAt  httpx.Time `json:"updatedAt"`
}

// ArticleDetail 是详情视图：列表字段 + 正文。
type ArticleDetail struct {
	ArticleListItem
	Content     string    `json:"content"`
	ContentHTML string    `json:"contentHtml"`
	TOC         []Heading `json:"toc"`
}

// ArticlePage 是分页结果。
type ArticlePage struct {
	List     []ArticleListItem `json:"list"`
	Total    int64             `json:"total"`
	Page     int               `json:"page"`
	PageSize int               `json:"pageSize"`
}

// articleRow 是列表/详情查询的联表结果。
type articleRow struct {
	model.Article
	TagName string `gorm:"column:tagName"`
}

const articleListColumns = "articles.id, articles.title, articles.excerpt, articles.cover, " +
	"articles.primaryTagId, articles.subTags, articles.createdAt, articles.updatedAt, tags.name AS tagName"

const articleDetailColumns = articleListColumns + ", articles.content, articles.contentHtml"

func toListItem(a *articleRow) ArticleListItem {
	subs := []string(a.SubTags)
	if subs == nil {
		subs = []string{}
	}
	return ArticleListItem{
		ID:         a.ID,
		Title:      a.Title,
		Excerpt:    a.Excerpt,
		PrimaryTag: PrimaryTag{ID: a.PrimaryTagID, Name: a.TagName},
		SubTags:    subs,
		Cover:      a.Cover,
		Date:       httpx.Date(a.CreatedAt),
		CreatedAt:  httpx.Time(a.CreatedAt),
		UpdatedAt:  httpx.Time(a.UpdatedAt),
	}
}

func toDetail(a *articleRow) ArticleDetail {
	contentHTML, toc := BuildTableOfContents(a.ContentHTML)
	return ArticleDetail{
		ArticleListItem: toListItem(a),
		Content:         a.Content,
		ContentHTML:     contentHTML,
		TOC:             toc,
	}
}

func baseArticleQuery(db *gorm.DB) *gorm.DB {
	return db.Table("articles").Joins("JOIN tags ON tags.id = articles.primaryTagId")
}

// ListArticles 分页查询文章，只按主标签筛选。
func ListArticles(db *gorm.DB, q ArticleListQuery) (*ArticlePage, error) {
	base := baseArticleQuery(db)
	if q.Tag != "" {
		base = base.Where("tags.name = ?", q.Tag)
	}
	if search := q.Search; search != "" {
		kw := "%" + EscapeLike(search) + "%"
		base = base.Where("(articles.title LIKE ? OR articles.excerpt LIKE ? OR articles.content LIKE ?)", kw, kw, kw)
	}

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, err
	}

	var rows []articleRow
	err := base.Select(articleListColumns).
		Order("articles.createdAt DESC, articles.id ASC").
		Offset((q.Page - 1) * q.PageSize).
		Limit(q.PageSize).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	list := make([]ArticleListItem, 0, len(rows))
	for i := range rows {
		list = append(list, toListItem(&rows[i]))
	}
	return &ArticlePage{List: list, Total: total, Page: q.Page, PageSize: q.PageSize}, nil
}

// GetArticle 返回文章详情。
func GetArticle(db *gorm.DB, id string) (*ArticleDetail, error) {
	var row articleRow
	err := baseArticleQuery(db).Select(articleDetailColumns).Where("articles.id = ?", id).Limit(1).Scan(&row).Error
	if err != nil {
		return nil, err
	}
	if row.ID == "" {
		return nil, httpx.NotFound("Article not found")
	}
	detail := toDetail(&row)
	return &detail, nil
}

// CreateArticleInput 是已校验的创建入参。
type CreateArticleInput struct {
	Title        string
	Excerpt      string
	Content      string
	Cover        string
	PrimaryTagID string
	SubTags      []string
}

// UpdateArticleInput 是部分更新入参；nil 表示该字段不更新。
type UpdateArticleInput struct {
	Title        *string
	Excerpt      *string
	Content      *string
	Cover        *string
	PrimaryTagID *string
	SubTags      *[]string
}

// CreateArticle 编译并消毒 Markdown、校验主标签后落库。
func CreateArticle(db *gorm.DB, in CreateArticleInput) (*ArticleDetail, error) {
	if _, err := FindPrimaryTag(db, in.PrimaryTagID); err != nil {
		return nil, err
	}
	html, err := RenderMarkdown(in.Content)
	if err != nil {
		return nil, err
	}
	doc := model.Article{
		ID:           NewID(),
		Title:        in.Title,
		Excerpt:      in.Excerpt,
		Content:      in.Content,
		ContentHTML:  html,
		PrimaryTagID: in.PrimaryTagID,
		SubTags:      NormalizeSubTags(in.SubTags),
		Cover:        in.Cover,
	}
	if err := db.Create(&doc).Error; err != nil {
		if isMySQLErr(err, 1452) {
			return nil, httpx.BadRequest("请选择有效的主标签")
		}
		return nil, err
	}
	triggerRevalidate([]string{"/blog", "/blog/[id]"})
	return GetArticle(db, doc.ID)
}

// UpdateArticle 局部更新文章；正文变更时重新编译，主标签变更时校验存在性。
func UpdateArticle(db *gorm.DB, id string, in UpdateArticleInput) (*ArticleDetail, error) {
	var doc model.Article
	if err := db.Where("id = ?", id).Take(&doc).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, httpx.NotFound("Article not found")
		}
		return nil, err
	}

	updates := map[string]any{}
	if in.Title != nil {
		updates["title"] = *in.Title
	}
	if in.Excerpt != nil {
		updates["excerpt"] = *in.Excerpt
	}
	if in.Cover != nil {
		updates["cover"] = *in.Cover
	}
	if in.Content != nil {
		html, err := RenderMarkdown(*in.Content)
		if err != nil {
			return nil, err
		}
		updates["content"] = *in.Content
		updates["contentHtml"] = html
	}
	if in.PrimaryTagID != nil {
		if _, err := FindPrimaryTag(db, *in.PrimaryTagID); err != nil {
			return nil, err
		}
		updates["primaryTagId"] = *in.PrimaryTagID
	}
	if in.SubTags != nil {
		updates["subTags"] = model.StringList(NormalizeSubTags(*in.SubTags))
	}

	if len(updates) > 0 {
		if err := db.Model(&model.Article{}).Where("id = ?", id).Updates(updates).Error; err != nil {
			if isMySQLErr(err, 1452) {
				return nil, httpx.BadRequest("请选择有效的主标签")
			}
			return nil, err
		}
		triggerRevalidate([]string{"/blog", "/blog/[id]"})
	}
	return GetArticle(db, id)
}

// DeleteArticle 删除文章。
func DeleteArticle(db *gorm.DB, id string) (map[string]string, error) {
	var doc model.Article
	if err := db.Select("id").Where("id = ?", id).Take(&doc).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, httpx.NotFound("Article not found")
		}
		return nil, err
	}
	if err := db.Where("id = ?", id).Delete(&model.Article{}).Error; err != nil {
		return nil, err
	}
	triggerRevalidate([]string{"/blog", "/blog/[id]"})
	return map[string]string{"id": id}, nil
}
