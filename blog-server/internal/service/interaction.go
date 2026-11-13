package service

import (
	"errors"
	"strings"

	"gorm.io/gorm"

	"blog-server/internal/httpx"
	"blog-server/internal/model"
)

const (
	ReactionLove       = "love"
	ReactionConfused   = "confused"
	ReactionCorrection = "correction"
)

// PublicCommenter 是评论和当前登录态中可公开展示的 GitHub 信息。
type PublicCommenter struct {
	ID         string `json:"id"`
	Login      string `json:"login"`
	Name       string `json:"name"`
	AvatarURL  string `json:"avatarUrl"`
	ProfileURL string `json:"profileUrl"`
}

// Comment 是文章下的单层公开评论。
type Comment struct {
	ID        string          `json:"id"`
	ArticleID string          `json:"articleId"`
	Author    PublicCommenter `json:"author"`
	Content   string          `json:"content"`
	CreatedAt httpx.Time      `json:"createdAt"`
	UpdatedAt httpx.Time      `json:"updatedAt"`
}

// AdminComment 是后台列表使用的评论，额外包含文章标题。
type AdminComment struct {
	Comment
	ArticleTitle string `json:"articleTitle"`
}

type commentRow struct {
	model.ArticleComment
	Login      string `gorm:"column:login"`
	Name       string `gorm:"column:name"`
	AvatarURL  string `gorm:"column:avatarUrl"`
	ProfileURL string `gorm:"column:profileUrl"`
}

func toComment(row *commentRow) Comment {
	return Comment{
		ID: row.ID, ArticleID: row.ArticleID, Content: row.Content,
		Author:    PublicCommenter{ID: row.CommenterID, Login: row.Login, Name: row.Name, AvatarURL: row.AvatarURL, ProfileURL: row.ProfileURL},
		CreatedAt: httpx.Time(row.CreatedAt), UpdatedAt: httpx.Time(row.UpdatedAt),
	}
}

func articleExists(db *gorm.DB, articleID string) (bool, error) {
	var count int64
	err := db.Model(&model.Article{}).Where("id = ?", articleID).Count(&count).Error
	return count > 0, err
}

// ListComments 按最早优先返回一篇文章的公开评论。
func ListComments(db *gorm.DB, articleID string) ([]Comment, error) {
	exists, err := articleExists(db, articleID)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, httpx.NotFound("Article not found")
	}
	var rows []commentRow
	err = db.Table("article_comments").
		Select("article_comments.*, github_commenters.login, github_commenters.name, github_commenters.avatarUrl, github_commenters.profileUrl").
		Joins("JOIN github_commenters ON github_commenters.id = article_comments.commenterId").
		Where("article_comments.articleId = ?", articleID).
		Order("article_comments.createdAt ASC, article_comments.id ASC").Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]Comment, 0, len(rows))
	for i := range rows {
		out = append(out, toComment(&rows[i]))
	}
	return out, nil
}

// ListAdminComments 返回最近的 200 条评论，供文章管理页删除垃圾评论。
func ListAdminComments(db *gorm.DB) ([]AdminComment, error) {
	var rows []struct {
		commentRow
		ArticleTitle string `gorm:"column:articleTitle"`
	}
	err := db.Table("article_comments").
		Select("article_comments.*, github_commenters.login, github_commenters.name, github_commenters.avatarUrl, github_commenters.profileUrl, articles.title AS articleTitle").
		Joins("JOIN github_commenters ON github_commenters.id = article_comments.commenterId").
		Joins("JOIN articles ON articles.id = article_comments.articleId").
		Order("article_comments.createdAt DESC, article_comments.id DESC").Limit(200).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]AdminComment, 0, len(rows))
	for i := range rows {
		out = append(out, AdminComment{Comment: toComment(&rows[i].commentRow), ArticleTitle: rows[i].ArticleTitle})
	}
	return out, nil
}

// CreateComment 验证文章与评论者后写入纯文本评论。
func CreateComment(db *gorm.DB, articleID, commenterID, content string) (*Comment, error) {
	exists, err := articleExists(db, articleID)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, httpx.NotFound("Article not found")
	}
	doc := model.ArticleComment{ID: NewID(), ArticleID: articleID, CommenterID: commenterID, Content: content}
	if err := db.Create(&doc).Error; err != nil {
		return nil, err
	}
	var row commentRow
	err = db.Table("article_comments").
		Select("article_comments.*, github_commenters.login, github_commenters.name, github_commenters.avatarUrl, github_commenters.profileUrl").
		Joins("JOIN github_commenters ON github_commenters.id = article_comments.commenterId").
		Where("article_comments.id = ?", doc.ID).Take(&row).Error
	if err != nil {
		return nil, err
	}
	result := toComment(&row)
	return &result, nil
}

// DeleteComment 仅允许评论作者或管理员删除。
func DeleteComment(db *gorm.DB, id, commenterID string, admin bool) error {
	var doc model.ArticleComment
	if err := db.Where("id = ?", id).Take(&doc).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return httpx.NotFound("Comment not found")
		}
		return err
	}
	if !admin && doc.CommenterID != commenterID {
		return httpx.Forbidden("只能删除自己的评论")
	}
	return db.Delete(&doc).Error
}

// ReactionSummary 是三个表情的公开计数及当前评论者选择。
type ReactionSummary struct {
	Love       int64   `json:"love"`
	Confused   int64   `json:"confused"`
	Correction int64   `json:"correction"`
	Current    *string `json:"current"`
}

func validReaction(reaction string) bool {
	return reaction == ReactionLove || reaction == ReactionConfused || reaction == ReactionCorrection
}

// GetReactions 返回某文章的表情汇总；commenterID 为空时不返回当前选择。
func GetReactions(db *gorm.DB, articleID, commenterID string) (*ReactionSummary, error) {
	exists, err := articleExists(db, articleID)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, httpx.NotFound("Article not found")
	}
	var rows []struct {
		Type  string `gorm:"column:type"`
		Count int64  `gorm:"column:count"`
	}
	if err := db.Model(&model.ArticleReaction{}).Select("type, COUNT(*) AS count").Where("articleId = ?", articleID).Group("type").Scan(&rows).Error; err != nil {
		return nil, err
	}
	result := &ReactionSummary{}
	for _, row := range rows {
		switch row.Type {
		case ReactionLove:
			result.Love = row.Count
		case ReactionConfused:
			result.Confused = row.Count
		case ReactionCorrection:
			result.Correction = row.Count
		}
	}
	if commenterID != "" {
		var reaction model.ArticleReaction
		if err := db.Where("articleId = ? AND commenterId = ?", articleID, commenterID).Take(&reaction).Error; err == nil {
			value := reaction.Type
			result.Current = &value
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}
	return result, nil
}

// SetReaction 插入或切换同一评论者的唯一表情。
func SetReaction(db *gorm.DB, articleID, commenterID, reaction string) (*ReactionSummary, error) {
	if !validReaction(reaction) {
		return nil, httpx.BadRequest("不支持的表情类型")
	}
	exists, err := articleExists(db, articleID)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, httpx.NotFound("Article not found")
	}
	entry := model.ArticleReaction{ArticleID: articleID, CommenterID: commenterID, Type: reaction}
	if err := db.Where("articleId = ? AND commenterId = ?", articleID, commenterID).
		Assign(map[string]any{"type": reaction}).FirstOrCreate(&entry).Error; err != nil {
		return nil, err
	}
	return GetReactions(db, articleID, commenterID)
}

// RemoveReaction 取消当前评论者在文章下的表情。
func RemoveReaction(db *gorm.DB, articleID, commenterID string) (*ReactionSummary, error) {
	if err := db.Where("articleId = ? AND commenterId = ?", articleID, commenterID).Delete(&model.ArticleReaction{}).Error; err != nil {
		return nil, err
	}
	return GetReactions(db, articleID, commenterID)
}

// UpsertGitHubCommenter 以不可变 GitHub ID 识别评论者，并刷新公开资料。
func UpsertGitHubCommenter(db *gorm.DB, githubID, login, name, avatarURL, profileURL string) (*model.GitHubCommenter, error) {
	githubID = strings.TrimSpace(githubID)
	if githubID == "" || strings.TrimSpace(login) == "" {
		return nil, httpx.BadRequest("GitHub 账号信息不完整")
	}
	var record model.GitHubCommenter
	err := db.Where("githubId = ?", githubID).Take(&record).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		record = model.GitHubCommenter{ID: NewID(), GitHubID: githubID, Login: login, Name: name, AvatarURL: avatarURL, ProfileURL: profileURL}
		if err := db.Create(&record).Error; err != nil {
			return nil, err
		}
		return &record, nil
	}
	if err != nil {
		return nil, err
	}
	if err := db.Model(&record).Updates(map[string]any{"login": login, "name": name, "avatarUrl": avatarURL, "profileUrl": profileURL}).Error; err != nil {
		return nil, err
	}
	record.Login, record.Name, record.AvatarURL, record.ProfileURL = login, name, avatarURL, profileURL
	return &record, nil
}
