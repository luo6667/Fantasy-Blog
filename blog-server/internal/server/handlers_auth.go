package server

import (
	"github.com/gin-gonic/gin"

	"blog-server/internal/httpx"
	"blog-server/internal/middleware"
	"blog-server/internal/service"
)

type loginRequest struct {
	Username *string `json:"username"`
	Password *string `json:"password"`
}

// login 管理员登录（系统只保留管理员账号）。
func (a *App) login(c *gin.Context) error {
	var req loginRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		return err
	}
	var issues []httpx.Issue
	username, issue := plainString(req.Username, "username", "用户名不能为空", 32, "用户名最多 32 个字符")
	if issue != nil {
		issues = append(issues, *issue)
	}
	password, issue := plainString(req.Password, "password", "密码不能为空", 72, "密码最多 72 个字符")
	if issue != nil {
		issues = append(issues, *issue)
	}
	if err := issuesError(issues); err != nil {
		return err
	}

	user, err := service.LoginAdmin(a.DB, username, password)
	if err != nil {
		return err
	}
	token, err := a.Auth.Manager.Sign(user.ID, user.Username, user.Role)
	if err != nil {
		return err
	}
	httpx.SuccessMsg(c, 200, "登录成功", gin.H{
		"token": token,
		"user":  user,
	})
	return nil
}

// me 返回当前登录主体。
func (a *App) me(c *gin.Context) error {
	actor := middleware.ActorFrom(c)
	if actor == nil {
		return httpx.Unauthorized("登录已过期，请重新登录")
	}
	httpx.Success(c, service.AuthUser{ID: actor.ID, Username: actor.Username, Role: actor.Role})
	return nil
}
