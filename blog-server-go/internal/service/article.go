package service

import (
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"blog-server/internal/httpx"
	"blog-server/internal/model"
)

// ArticleListQuery 是文章列表查询参数。
type ArticleListQuery struct {
	Page     int
	PageSize int
	Tag      string
	Search   string
}

// ArticleListItem 是列表视图（不含正文与大数组）。
type ArticleListItem struct {
	ID            string     `json:"id"`
	Title         string     `json:"title"`
	Excerpt       string     `json:"excerpt"`
	Tags          []string   `json:"tags"`
	Cover         string     `json:"cover,omitempty"`
	Date          string     `json:"date"`
	CreatedAt     httpx.Time `json:"createdAt"`
	UpdatedAt     httpx.Time `json:"updatedAt"`
	Likes         int        `json:"likes"`
	Favorites     int        `json:"favorites"`
	LikedByMe     bool       `json:"likedByMe"`
	FavoritedByMe bool       `json:"favoritedByMe"`
}

// ArticleDetail 是详情视图：列表字段 + 正文。
type ArticleDetail struct {
	ArticleListItem
	Content     string `json:"content"`
	ContentHTML string `json:"contentHtml"`
}

// ArticlePage 是分页结果。
type ArticlePage struct {
	List     []ArticleListItem `json:"list"`
	Total    int64             `json:"total"`
	Page     int               `json:"page"`
	PageSize int               `json:"pageSize"`
}

// TagCount 是文章标签聚合项。
type TagCount struct {
	Name  string `json:"name"`
	Count int64  `json:"count"`
}

func toListItem(a *model.Article, meKey string) ArticleListItem {
	tags := []string(a.Tags)
	if tags == nil {
		tags = []string{}
	}
	likedByMe := false
	favoritedByMe := false
	if meKey != "" {
		likedByMe = contains(a.LikedBy, meKey)
		favoritedByMe = contains(a.FavoritedBy, meKey)
	}
	return ArticleListItem{
		ID:            a.ID,
		Title:         a.Title,
		Excerpt:       a.Excerpt,
		Tags:          tags,
		Cover:         a.Cover,
		Date:          httpx.Date(a.CreatedAt),
		CreatedAt:     httpx.Time(a.CreatedAt),
		UpdatedAt:     httpx.Time(a.UpdatedAt),
		Likes:         a.Likes,
		Favorites:     a.Favorites,
		LikedByMe:     likedByMe,
		FavoritedByMe: favoritedByMe,
	}
}

func toDetail(a *model.Article, meKey string) ArticleDetail {
	return ArticleDetail{
		ArticleListItem: toListItem(a, meKey),
		Content:         a.Content,
		ContentHTML:     a.ContentHTML,
	}
}

func contains(list []string, want string) bool {
	for _, v := range list {
		if v == want {
			return true
		}
	}
	return false
}

// ListArticles 分页查询文章（标签筛选 + 关键字搜索），可选当前用户。
func ListArticles(db *gorm.DB, q ArticleListQuery, meKey string) (*ArticlePage, error) {
	base := db.Model(&model.Article{})
	if q.Tag != "" {
		base = base.Where("JSON_CONTAINS(tags, JSON_QUOTE(?))", q.Tag)
	}
	if search := q.Search; search != "" {
		kw := "%" + EscapeLike(search) + "%"
		base = base.Where("(title LIKE ? OR excerpt LIKE ? OR content LIKE ?)", kw, kw, kw)
	}

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, err
	}

	var docs []model.Article
	err := base.Select("id", "title", "excerpt", "tags", "cover", "likes", "favorites", "createdAt", "updatedAt").
		Order("createdAt DESC").
		Offset((q.Page - 1) * q.PageSize).
		Limit(q.PageSize).
		Find(&docs).Error
	if err != nil {
		return nil, err
	}

	list := make([]ArticleListItem, 0, len(docs))
	for i := range docs {
		list = append(list, toListItem(&docs[i], meKey))
	}
	return &ArticlePage{List: list, Total: total, Page: q.Page, PageSize: q.PageSize}, nil
}

// ListArticleTags 用 JSON_TABLE 展开 tags 列并统计文章数（与旧 SQL 完全一致）。
func ListArticleTags(db *gorm.DB) ([]TagCount, error) {
	var rows []TagCount
	err := db.Raw(`SELECT jt.tag AS name, COUNT(*) AS count
		FROM articles, JSON_TABLE(articles.tags, '$[*]' COLUMNS (tag VARCHAR(64) PATH '$')) AS jt
		GROUP BY jt.tag
		ORDER BY COUNT(*) DESC, jt.tag ASC`).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []TagCount{}
	}
	return rows, nil
}

// GetArticle 返回文章详情。
func GetArticle(db *gorm.DB, id, meKey string) (*ArticleDetail, error) {
	var a model.Article
	if err := db.Where("id = ?", id).Take(&a).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, httpx.NotFound("Article not found")
		}
		return nil, err
	}
	detail := toDetail(&a, meKey)
	return &detail, nil
}

// CreateArticleInput 是已校验的创建入参。
type CreateArticleInput struct {
	Title   string
	Excerpt string
	Content string
	Cover   string
	Tags    []string
}

// UpdateArticleInput 是部分更新入参；nil 表示该字段不更新。
type UpdateArticleInput struct {
	Title   *string
	Excerpt *string
	Content *string
	Cover   *string
	Tags    *[]string
}

// CreateArticle 编译并消毒 Markdown、校验标签、落库并通知普通用户。
func CreateArticle(db *gorm.DB, in CreateArticleInput, author Actor) (*ArticleDetail, error) {
	tags := NormalizeTags(in.Tags)
	if len(tags) == 0 {
		return nil, httpx.BadRequest("至少选择一个分类标签")
	}
	if err := assertTagsExist(db, tags); err != nil {
		return nil, err
	}
	html, err := RenderMarkdown(in.Content)
	if err != nil {
		return nil, err
	}
	authorType, authorID, authorName := author.Role, author.ID, author.Username
	doc := model.Article{
		ID:          NewID(),
		Title:       in.Title,
		Excerpt:     in.Excerpt,
		Content:     in.Content,
		ContentHTML: html,
		Tags:        model.StringList(tags),
		Cover:       in.Cover,
		AuthorType:  &authorType,
		AuthorID:    &authorID,
		AuthorName:  &authorName,
		LikedBy:     model.StringList{},
		FavoritedBy: model.StringList{},
	}
	if err := db.Create(&doc).Error; err != nil {
		return nil, err
	}

	var userIDs []string
	if err := db.Model(&model.User{}).Pluck("id", &userIDs).Error; err != nil {
		return nil, err
	}
	for _, uid := range userIDs {
		if author.Role == "user" && uid == author.ID {
			continue
		}
		if err := CreateNotification(db, NotificationInput{
			Recipient:    Recipient{Role: "user", ID: uid},
			Actor:        author,
			Type:         "article",
			ArticleID:    doc.ID,
			ArticleTitle: doc.Title,
		}); err != nil {
			return nil, err
		}
	}

	triggerRevalidate([]string{"/blog", "/blog/[id]"})
	detail := toDetail(&doc, "")
	return &detail, nil
}

// UpdateArticle 部分更新文章。
func UpdateArticle(db *gorm.DB, id string, in UpdateArticleInput) (*ArticleDetail, error) {
	var doc model.Article
	if err := db.Where("id = ?", id).Take(&doc).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, httpx.NotFound("Article not found")
		}
		return nil, err
	}

	if in.Tags != nil {
		tags := NormalizeTags(*in.Tags)
		if len(tags) == 0 {
			return nil, httpx.BadRequest("至少选择一个分类标签")
		}
		if err := assertTagsExist(db, tags); err != nil {
			return nil, err
		}
		doc.Tags = model.StringList(tags)
	}
	if in.Content != nil {
		html, err := RenderMarkdown(*in.Content)
		if err != nil {
			return nil, err
		}
		doc.Content = *in.Content
		doc.ContentHTML = html
	}
	if in.Title != nil {
		doc.Title = *in.Title
	}
	if in.Excerpt != nil {
		doc.Excerpt = *in.Excerpt
	}
	if in.Cover != nil {
		doc.Cover = *in.Cover
	}
	if err := db.Save(&doc).Error; err != nil {
		return nil, err
	}
	triggerRevalidate([]string{"/blog", "/blog/[id]"})
	detail := toDetail(&doc, "")
	return &detail, nil
}

// DeleteArticle 删除文章并级联删除其全部评论。
func DeleteArticle(db *gorm.DB, id string) (map[string]string, error) {
	var doc model.Article
	if err := db.Where("id = ?", id).Take(&doc).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, httpx.NotFound("Article not found")
		}
		return nil, err
	}
	if err := db.Where("id = ?", id).Delete(&model.Article{}).Error; err != nil {
		return nil, err
	}
	if err := db.Where("articleId = ?", id).Delete(&model.Comment{}).Error; err != nil {
		return nil, err
	}
	triggerRevalidate([]string{"/blog", "/blog/[id]"})
	return map[string]string{"id": doc.ID}, nil
}

// ToggleArticleLike 点赞/取消点赞（事务 + 行锁）。
func ToggleArticleLike(db *gorm.DB, articleID string, user Actor) (map[string]any, error) {
	var liked bool
	var likes int
	var article model.Article

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", articleID).Take(&article).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return httpx.NotFound("文章不存在")
			}
			return err
		}
		key := LikeKey(user.Role, user.ID)
		if contains(article.LikedBy, key) {
			article.LikedBy = remove(article.LikedBy, key)
			article.Likes--
			liked = false
		} else {
			article.LikedBy = append(append(model.StringList{}, article.LikedBy...), key)
			article.Likes++
			liked = true
		}
		likes = article.Likes
		return tx.Save(&article).Error
	})
	if err != nil {
		return nil, err
	}

	if liked && !(article.AuthorType != nil && article.AuthorID != nil &&
		*article.AuthorType == user.Role && *article.AuthorID == user.ID) {
		recipient, err := ResolveArticleRecipient(db, &article)
		if err != nil {
			return nil, err
		}
		if recipient != nil {
			if err := CreateNotification(db, NotificationInput{
				Recipient:    *recipient,
				Actor:        user,
				Type:         "like",
				ArticleID:    article.ID,
				ArticleTitle: article.Title,
			}); err != nil {
				return nil, err
			}
		}
	}

	return map[string]any{"liked": liked, "likes": likes}, nil
}

func remove(list []string, want string) []string {
	out := make([]string, 0, len(list))
	for _, v := range list {
		if v != want {
			out = append(out, v)
		}
	}
	return out
}
