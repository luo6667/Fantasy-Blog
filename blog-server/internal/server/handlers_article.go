package server

import (
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"blog-server/internal/httpx"
	"blog-server/internal/service"
)

type articleRequest struct {
	Title        *string   `json:"title"`
	Excerpt      *string   `json:"excerpt"`
	Content      *string   `json:"content"`
	PrimaryTagID *string   `json:"primaryTagId"`
	SubTags      *[]string `json:"subTags"`
	Cover        *string   `json:"cover"`
}

// validateArticle 校验创建/更新请求体；partial 为 true 时只校验出现的字段。
func validateArticle(req *articleRequest, partial bool) (*service.CreateArticleInput, *service.UpdateArticleInput, error) {
	var issues []httpx.Issue
	out := &service.CreateArticleInput{}
	upd := &service.UpdateArticleInput{}

	if req.Title == nil {
		if !partial {
			issues = append(issues, httpx.Issue{Path: "title", Message: "Required"})
		}
	} else if title, issue := requiredString(req.Title, "title", "标题不能为空", 200, "标题最多 200 字"); issue != nil {
		issues = append(issues, *issue)
	} else {
		out.Title = title
		upd.Title = &title
	}
	if req.Excerpt == nil {
		if !partial {
			issues = append(issues, httpx.Issue{Path: "excerpt", Message: "Required"})
		}
	} else if excerpt, issue := requiredString(req.Excerpt, "excerpt", "摘要不能为空", 500, "摘要最多 500 字"); issue != nil {
		issues = append(issues, *issue)
	} else {
		out.Excerpt = excerpt
		upd.Excerpt = &excerpt
	}
	if req.Content == nil {
		if !partial {
			issues = append(issues, httpx.Issue{Path: "content", Message: "Required"})
		}
	} else {
		content := *req.Content
		if content == "" {
			issues = append(issues, httpx.Issue{Path: "content", Message: "正文不能为空"})
		} else if jsLen(content) > 200*1024 {
			issues = append(issues, httpx.Issue{Path: "content", Message: "正文最多 200KB"})
		} else {
			out.Content = content
			upd.Content = &content
		}
	}
	if req.PrimaryTagID == nil {
		if !partial {
			issues = append(issues, httpx.Issue{Path: "primaryTagId", Message: "Required"})
		}
	} else if id, issue := requiredString(req.PrimaryTagID, "primaryTagId", "请选择主标签", 24, "主标签不合法"); issue != nil {
		issues = append(issues, *issue)
	} else {
		out.PrimaryTagID = id
		upd.PrimaryTagID = &id
	}
	if req.SubTags != nil {
		subs := *req.SubTags
		if len(subs) > 20 {
			issues = append(issues, httpx.Issue{Path: "subTags", Message: "子标签最多 20 个"})
		} else {
			normalized := make([]string, 0, len(subs))
			bad := false
			for _, t := range subs {
				v := strings.TrimSpace(t)
				if v == "" {
					issues = append(issues, httpx.Issue{Path: "subTags", Message: "子标签不能为空"})
					bad = true
					continue
				}
				if jsLen(v) > 32 {
					issues = append(issues, httpx.Issue{Path: "subTags", Message: "单个子标签最多 32 个字符"})
					bad = true
					continue
				}
				normalized = append(normalized, v)
			}
			if !bad {
				out.SubTags = normalized
				upd.SubTags = &normalized
			}
		}
	}
	if req.Cover != nil {
		cover := *req.Cover
		lower := strings.ToLower(cover)
		if !(cover == "" || strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") || strings.HasPrefix(cover, "/uploads/")) {
			issues = append(issues, httpx.Issue{Path: "cover", Message: "封面图必须是合法 URL 或 /uploads/ 路径"})
		} else {
			out.Cover = cover
			upd.Cover = &cover
		}
	}
	if err := issuesError(issues); err != nil {
		return nil, nil, err
	}
	if partial {
		return nil, upd, nil
	}
	return out, nil, nil
}

// listArticles 文章列表。
func (a *App) listArticles(c *gin.Context) error {
	page := clamp(atoiDefault(c.Query("page"), 1), 1, 1<<30)
	pageSize := clamp(atoiDefault(c.Query("pageSize"), 10), 1, 50)
	q := service.ArticleListQuery{
		Page:     page,
		PageSize: pageSize,
		Tag:      c.Query("tag"),
		Search:   strings.TrimSpace(c.Query("search")),
	}
	result, err := service.ListArticles(a.DB, q)
	if err != nil {
		return err
	}
	httpx.Success(c, result)
	return nil
}

// articleDetail 文章详情。
func (a *App) articleDetail(c *gin.Context) error {
	detail, err := service.GetArticle(a.DB, c.Param("id"))
	if err != nil {
		return err
	}
	httpx.Success(c, detail)
	return nil
}

// createArticle 创建文章。
func (a *App) createArticle(c *gin.Context) error {
	var req articleRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		return err
	}
	in, _, err := validateArticle(&req, false)
	if err != nil {
		return err
	}
	detail, err := service.CreateArticle(a.DB, *in)
	if err != nil {
		return err
	}
	httpx.SuccessMsg(c, 201, "Article created", detail)
	return nil
}

// updateArticle 更新文章。
func (a *App) updateArticle(c *gin.Context) error {
	var req articleRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		return err
	}
	_, upd, err := validateArticle(&req, true)
	if err != nil {
		return err
	}
	detail, err := service.UpdateArticle(a.DB, c.Param("id"), *upd)
	if err != nil {
		return err
	}
	httpx.SuccessMsg(c, 200, "Article updated", detail)
	return nil
}

// deleteArticle 删除文章。
func (a *App) deleteArticle(c *gin.Context) error {
	data, err := service.DeleteArticle(a.DB, c.Param("id"))
	if err != nil {
		return err
	}
	httpx.SuccessMsg(c, 200, "Article deleted", data)
	return nil
}

func clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func atoiDefault(raw string, def int) int {
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return def
	}
	return n
}
