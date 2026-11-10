package server

import (
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"blog-server/internal/httpx"
	"blog-server/internal/middleware"
	"blog-server/internal/service"
)

type articleRequest struct {
	Title   *string   `json:"title"`
	Excerpt *string   `json:"excerpt"`
	Content *string   `json:"content"`
	Tags    *[]string `json:"tags"`
	Cover   *string   `json:"cover"`
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
	if req.Tags == nil {
		if !partial {
			issues = append(issues, httpx.Issue{Path: "tags", Message: "Required"})
		}
	} else {
		tags := *req.Tags
		if len(tags) == 0 {
			issues = append(issues, httpx.Issue{Path: "tags", Message: "至少选择一个分类标签"})
		} else if len(tags) > 20 {
			issues = append(issues, httpx.Issue{Path: "tags", Message: "标签最多 20 个"})
		} else {
			normalized := make([]string, 0, len(tags))
			bad := false
			for _, t := range tags {
				v := strings.TrimSpace(t)
				if v == "" {
					issues = append(issues, httpx.Issue{Path: "tags", Message: "标签不能为空"})
					bad = true
					continue
				}
				if jsLen(v) > 32 {
					issues = append(issues, httpx.Issue{Path: "tags", Message: "单个标签最多 32 个字符"})
					bad = true
					continue
				}
				normalized = append(normalized, v)
			}
			if !bad {
				out.Tags = normalized
				upd.Tags = &normalized
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
	result, err := service.ListArticles(a.DB, q, currentKey(c))
	if err != nil {
		return err
	}
	httpx.Success(c, result)
	return nil
}

// articleTags 标签聚合。
func (a *App) articleTags(c *gin.Context) error {
	tags, err := service.ListArticleTags(a.DB)
	if err != nil {
		return err
	}
	httpx.Success(c, tags)
	return nil
}

// articleDetail 文章详情。
func (a *App) articleDetail(c *gin.Context) error {
	detail, err := service.GetArticle(a.DB, c.Param("id"), currentKey(c))
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
	actor := middleware.ActorFrom(c)
	if actor == nil {
		return httpx.Unauthorized("请先登录")
	}
	detail, err := service.CreateArticle(a.DB, *in, service.Actor{ID: actor.ID, Username: actor.Username, Role: actor.Role})
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

// likeArticle 点赞/取消点赞。
func (a *App) likeArticle(c *gin.Context) error {
	actor := middleware.ActorFrom(c)
	if actor == nil {
		return httpx.Unauthorized("请先登录")
	}
	data, err := service.ToggleArticleLike(a.DB, c.Param("id"), service.Actor{ID: actor.ID, Username: actor.Username, Role: actor.Role})
	if err != nil {
		return err
	}
	httpx.Success(c, data)
	return nil
}

// currentKey 返回可选登录主体的 "role:id"。
func currentKey(c *gin.Context) string {
	actor := middleware.ActorFrom(c)
	if actor == nil {
		return ""
	}
	return service.LikeKey(actor.Role, actor.ID)
}

// atoiDefault 解析整数，失败时返回默认值（对齐 Number(x) || d）。
func atoiDefault(raw string, fallback int) int {
	if raw == "" {
		return fallback
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return n
}

// clamp 限制范围。
func clamp(v, min, max int) int {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
