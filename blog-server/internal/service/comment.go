package service

import (
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"blog-server/internal/httpx"
	"blog-server/internal/model"
)

// CommentItem 是对外的评论视图（扁平结构，parentId 表示层级）。
type CommentItem struct {
	ID          string     `json:"id"`
	ArticleID   string     `json:"articleId"`
	ParentID    *string    `json:"parentId"`
	AuthorName  string     `json:"authorName"`
	AuthorType  string     `json:"authorType"`
	Content     string     `json:"content"`
	Likes       int        `json:"likes"`
	LikedByMe   bool       `json:"likedByMe"`
	Mine        bool       `json:"mine"`
	ReplyToName *string    `json:"replyToName"`
	CreatedAt   httpx.Time `json:"createdAt"`
}

func toCommentItem(c *model.Comment, likedByMe, mine bool, replyToName *string) CommentItem {
	return CommentItem{
		ID:          c.ID,
		ArticleID:   c.ArticleID,
		ParentID:    c.ParentID,
		AuthorName:  c.AuthorName,
		AuthorType:  c.AuthorType,
		Content:     c.Content,
		Likes:       len(c.LikedBy),
		LikedByMe:   likedByMe,
		Mine:        mine,
		ReplyToName: replyToName,
		CreatedAt:   httpx.Time(c.CreatedAt),
	}
}

// ListComments 返回文章下全部评论（时间升序），可选当前用户。
func ListComments(db *gorm.DB, articleID string, user *Actor) ([]CommentItem, error) {
	var count int64
	if err := db.Model(&model.Article{}).Where("id = ?", articleID).Count(&count).Error; err != nil {
		return nil, err
	}
	if count == 0 {
		return nil, httpx.NotFound("文章不存在")
	}

	var docs []model.Comment
	if err := db.Where("articleId = ?", articleID).Order("createdAt ASC").Find(&docs).Error; err != nil {
		return nil, err
	}

	names := make(map[string]string, len(docs))
	for i := range docs {
		names[docs[i].ID] = docs[i].AuthorName
	}
	meKey := ""
	if user != nil {
		meKey = LikeKey(user.Role, user.ID)
	}

	out := make([]CommentItem, 0, len(docs))
	for i := range docs {
		c := &docs[i]
		var replyTo *string
		if c.ParentID != nil {
			if name, ok := names[*c.ParentID]; ok {
				v := name
				replyTo = &v
			}
		}
		mine := user != nil && c.AuthorType == user.Role && c.AuthorID == user.ID
		out = append(out, toCommentItem(c, meKey != "" && contains(c.LikedBy, meKey), mine, replyTo))
	}
	return out, nil
}

// CreateComment 发表一级评论并通知文章作者。
func CreateComment(db *gorm.DB, articleID string, user Actor, content string) (*CommentItem, error) {
	var article model.Article
	if err := db.Select("id", "authorType", "authorId", "title").Where("id = ?", articleID).Take(&article).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, httpx.NotFound("文章不存在")
		}
		return nil, err
	}

	doc := model.Comment{
		ID:         NewID(),
		ArticleID:  articleID,
		AuthorType: user.Role,
		AuthorID:   user.ID,
		AuthorName: user.Username,
		Content:    content,
		LikedBy:    model.StringList{},
	}
	if err := db.Create(&doc).Error; err != nil {
		return nil, err
	}

	if !(article.AuthorType != nil && article.AuthorID != nil &&
		*article.AuthorType == user.Role && *article.AuthorID == user.ID) {
		recipient, err := ResolveArticleRecipient(db, &article)
		if err != nil {
			return nil, err
		}
		if recipient != nil {
			if err := CreateNotification(db, NotificationInput{
				Recipient:      *recipient,
				Actor:          user,
				Type:           "comment",
				ArticleID:      article.ID,
				ArticleTitle:   article.Title,
				CommentID:      doc.ID,
				CommentContent: content,
			}); err != nil {
				return nil, err
			}
		}
	}

	item := toCommentItem(&doc, false, true, nil)
	return &item, nil
}

// CreateReply 回复任意评论（支持无限嵌套）并通知被回复者。
func CreateReply(db *gorm.DB, commentID string, user Actor, content string) (*CommentItem, error) {
	var parent model.Comment
	if err := db.Where("id = ?", commentID).Take(&parent).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, httpx.NotFound("评论不存在")
		}
		return nil, err
	}

	parentID := parent.ID
	doc := model.Comment{
		ID:         NewID(),
		ArticleID:  parent.ArticleID,
		ParentID:   &parentID,
		AuthorType: user.Role,
		AuthorID:   user.ID,
		AuthorName: user.Username,
		Content:    content,
		LikedBy:    model.StringList{},
	}
	if err := db.Create(&doc).Error; err != nil {
		return nil, err
	}

	if !(parent.AuthorType == user.Role && parent.AuthorID == user.ID) {
		var article model.Article
		_ = db.Select("id", "title").Where("id = ?", parent.ArticleID).Take(&article).Error
		if err := CreateNotification(db, NotificationInput{
			Recipient:      Recipient{Role: parent.AuthorType, ID: parent.AuthorID},
			Actor:          user,
			Type:           "reply",
			ArticleID:      parent.ArticleID,
			ArticleTitle:   article.Title,
			CommentID:      doc.ID,
			CommentContent: content,
		}); err != nil {
			return nil, err
		}
	}

	replyTo := parent.AuthorName
	item := toCommentItem(&doc, false, true, &replyTo)
	return &item, nil
}

// ToggleCommentLike 点赞/取消点赞（事务 + 行锁）。
func ToggleCommentLike(db *gorm.DB, commentID string, user Actor) (map[string]any, error) {
	var liked bool
	var likes int

	err := db.Transaction(func(tx *gorm.DB) error {
		var c model.Comment
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", commentID).Take(&c).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return httpx.NotFound("评论不存在")
			}
			return err
		}
		key := LikeKey(user.Role, user.ID)
		if contains(c.LikedBy, key) {
			c.LikedBy = remove(c.LikedBy, key)
			liked = false
		} else {
			c.LikedBy = append(append(model.StringList{}, c.LikedBy...), key)
			liked = true
		}
		likes = len(c.LikedBy)
		return tx.Save(&c).Error
	})
	if err != nil {
		return nil, err
	}
	return map[string]any{"liked": liked, "likes": likes}, nil
}

// DeleteComment 删除评论及其全部子孙回复（作者本人或管理员）。
func DeleteComment(db *gorm.DB, commentID string, user Actor) (map[string]string, error) {
	var c model.Comment
	if err := db.Where("id = ?", commentID).Take(&c).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, httpx.NotFound("评论不存在")
		}
		return nil, err
	}
	isAuthor := c.AuthorType == user.Role && c.AuthorID == user.ID
	if !isAuthor && user.Role != "admin" {
		return nil, httpx.Forbidden("无权删除该评论")
	}

	ids := []string{c.ID}
	frontier := []string{c.ID}
	for len(frontier) > 0 {
		var childIDs []string
		if err := db.Model(&model.Comment{}).Where("parentId IN ?", frontier).Pluck("id", &childIDs).Error; err != nil {
			return nil, err
		}
		if len(childIDs) == 0 {
			break
		}
		ids = append(ids, childIDs...)
		frontier = childIDs
	}
	if err := db.Where("id IN ?", ids).Delete(&model.Comment{}).Error; err != nil {
		return nil, err
	}
	return map[string]string{"id": commentID}, nil
}
