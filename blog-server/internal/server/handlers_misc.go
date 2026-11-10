package server

import (
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"

	"blog-server/internal/httpx"
	"blog-server/internal/middleware"
	"blog-server/internal/service"
)

var whitespaceRe = regexp.MustCompile(`\s+`)

type tagRequest struct {
	Name *string `json:"name"`
}

// listTags 标签库列表（含文章数）。
func (a *App) listTags(c *gin.Context) error {
	tags, err := service.ListTagLibrary(a.DB)
	if err != nil {
		return err
	}
	httpx.Success(c, tags)
	return nil
}

// createTag 新增标签。
func (a *App) createTag(c *gin.Context) error {
	var req tagRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		return err
	}
	name, issue := requiredString(req.Name, "name", "标签名不能为空", 32, "标签名最多 32 个字符")
	if err := issuesError(oneIssue(issue)); err != nil {
		return err
	}
	name = whitespaceRe.ReplaceAllString(name, "")
	if name == "" {
		return httpx.Validation(httpx.Issue{Path: "name", Message: "标签名不能为空"})
	}
	item, err := service.CreateTag(a.DB, name)
	if err != nil {
		return err
	}
	httpx.SuccessMsg(c, 201, "Tag created", item)
	return nil
}

// deleteTag 删除标签并从文章中移除。
func (a *App) deleteTag(c *gin.Context) error {
	name := strings.TrimSpace(c.Param("name"))
	data, err := service.DeleteTag(a.DB, name)
	if err != nil {
		return err
	}
	httpx.SuccessMsg(c, 200, "Tag deleted", data)
	return nil
}

// listNotifications 当前用户通知。
func (a *App) listNotifications(c *gin.Context) error {
	actor := middleware.ActorFrom(c)
	if actor == nil {
		return httpx.Unauthorized("请先登录")
	}
	list, err := service.ListNotifications(a.DB, actor.Role, actor.ID)
	if err != nil {
		return err
	}
	httpx.Success(c, list)
	return nil
}

// unreadCount 未读通知数。
func (a *App) unreadCount(c *gin.Context) error {
	actor := middleware.ActorFrom(c)
	if actor == nil {
		return httpx.Unauthorized("请先登录")
	}
	count, err := service.UnreadNotificationCount(a.DB, actor.Role, actor.ID)
	if err != nil {
		return err
	}
	httpx.Success(c, gin.H{"count": count})
	return nil
}

type readRequest struct {
	IDs *[]string `json:"ids"`
}

// markRead 标记通知已读。
func (a *App) markRead(c *gin.Context) error {
	var req readRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		return err
	}
	var ids []string
	if req.IDs != nil {
		ids = *req.IDs
		if len(ids) > 100 {
			return httpx.Validation(httpx.Issue{Path: "ids", Message: "单次最多标记 100 条"})
		}
		for _, id := range ids {
			if id == "" {
				return httpx.Validation(httpx.Issue{Path: "ids", Message: "String must contain at least 1 character(s)"})
			}
		}
	}
	actor := middleware.ActorFrom(c)
	if actor == nil {
		return httpx.Unauthorized("请先登录")
	}
	if err := service.MarkNotificationsRead(a.DB, actor.Role, actor.ID, ids); err != nil {
		return err
	}
	httpx.Success(c, gin.H{"ok": true})
	return nil
}

// listUsers 管理端用户列表。
func (a *App) listUsers(c *gin.Context) error {
	list, err := service.ListUsers(a.DB)
	if err != nil {
		return err
	}
	httpx.Success(c, list)
	return nil
}

// deleteUser 删除用户及级联数据。
func (a *App) deleteUser(c *gin.Context) error {
	data, err := service.DeleteUser(a.DB, c.Param("id"))
	if err != nil {
		return err
	}
	httpx.SuccessMsg(c, 200, "用户已删除", data)
	return nil
}
