package server

import (
	"github.com/gin-gonic/gin"

	"blog-server/internal/httpx"
	"blog-server/internal/middleware"
	"blog-server/internal/service"
)

type contentRequest struct {
	Content *string `json:"content"`
}

// listComments 文章评论列表（扁平数组）。
func (a *App) listComments(c *gin.Context) error {
	actor := middleware.ActorFrom(c)
	var user *service.Actor
	if actor != nil {
		user = &service.Actor{ID: actor.ID, Username: actor.Username, Role: actor.Role}
	}
	list, err := service.ListComments(a.DB, c.Param("id"), user)
	if err != nil {
		return err
	}
	httpx.Success(c, list)
	return nil
}

// createComment 发表一级评论。
func (a *App) createComment(c *gin.Context) error {
	var req contentRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		return err
	}
	content, issue := requiredString(req.Content, "content", "评论内容不能为空", 1000, "评论最多 1000 字")
	if err := issuesError(oneIssue(issue)); err != nil {
		return err
	}
	actor := middleware.ActorFrom(c)
	if actor == nil {
		return httpx.Unauthorized("请先登录")
	}
	item, err := service.CreateComment(a.DB, c.Param("id"), service.Actor{ID: actor.ID, Username: actor.Username, Role: actor.Role}, content)
	if err != nil {
		return err
	}
	httpx.SuccessMsg(c, 201, "评论成功", item)
	return nil
}

// createReply 回复评论。
func (a *App) createReply(c *gin.Context) error {
	var req contentRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		return err
	}
	content, issue := requiredString(req.Content, "content", "回复内容不能为空", 1000, "回复最多 1000 字")
	if err := issuesError(oneIssue(issue)); err != nil {
		return err
	}
	actor := middleware.ActorFrom(c)
	if actor == nil {
		return httpx.Unauthorized("请先登录")
	}
	item, err := service.CreateReply(a.DB, c.Param("id"), service.Actor{ID: actor.ID, Username: actor.Username, Role: actor.Role}, content)
	if err != nil {
		return err
	}
	httpx.SuccessMsg(c, 201, "回复成功", item)
	return nil
}

// likeComment 评论点赞/取消点赞。
func (a *App) likeComment(c *gin.Context) error {
	actor := middleware.ActorFrom(c)
	if actor == nil {
		return httpx.Unauthorized("请先登录")
	}
	data, err := service.ToggleCommentLike(a.DB, c.Param("id"), service.Actor{ID: actor.ID, Username: actor.Username, Role: actor.Role})
	if err != nil {
		return err
	}
	httpx.Success(c, data)
	return nil
}

// deleteComment 删除评论及全部回复。
func (a *App) deleteComment(c *gin.Context) error {
	actor := middleware.ActorFrom(c)
	if actor == nil {
		return httpx.Unauthorized("请先登录")
	}
	data, err := service.DeleteComment(a.DB, c.Param("id"), service.Actor{ID: actor.ID, Username: actor.Username, Role: actor.Role})
	if err != nil {
		return err
	}
	httpx.SuccessMsg(c, 200, "评论已删除", data)
	return nil
}

// oneIssue 把可空 issue 转成切片。
func oneIssue(issue *httpx.Issue) []httpx.Issue {
	if issue == nil {
		return nil
	}
	return []httpx.Issue{*issue}
}
