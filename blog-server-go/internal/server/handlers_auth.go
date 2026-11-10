package server

import (
	"github.com/gin-gonic/gin"

	"blog-server/internal/httpx"
	"blog-server/internal/middleware"
	"blog-server/internal/service"
)

type registerRequest struct {
	Username *string `json:"username"`
	Password *string `json:"password"`
}

type loginRequest struct {
	Username *string `json:"username"`
	Password *string `json:"password"`
	Role     *string `json:"role"`
}

// register 注册普通用户。
func (a *App) register(c *gin.Context) error {
	var req registerRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		return err
	}
	var issues []httpx.Issue
	username, issue := requiredString(req.Username, "username", "用户名至少 2 个字符", 32, "用户名最多 32 个字符")
	if issue != nil {
		issues = append(issues, *issue)
	} else if jsLen(username) < 2 {
		issues = append(issues, httpx.Issue{Path: "username", Message: "用户名至少 2 个字符"})
	}
	password, issue := plainString(req.Password, "password", "密码至少 8 个字符", 72, "密码最多 72 个字符")
	if issue != nil {
		issues = append(issues, *issue)
	} else if jsLen(password) < 8 {
		issues = append(issues, httpx.Issue{Path: "password", Message: "密码至少 8 个字符"})
	}
	if err := issuesError(issues); err != nil {
		return err
	}

	user, err := service.Register(a.DB, username, password)
	if err != nil {
		return err
	}
	httpx.SuccessMsg(c, 201, "注册成功", user)
	return nil
}

// login 登录（body.role 决定普通用户或管理员）。
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
	role := "user"
	if req.Role != nil {
		if *req.Role != "user" && *req.Role != "admin" {
			issues = append(issues, httpx.Issue{
				Path:    "role",
				Message: "Invalid enum value. Expected 'user' | 'admin', received '" + *req.Role + "'",
			})
		} else {
			role = *req.Role
		}
	}
	if err := issuesError(issues); err != nil {
		return err
	}

	var (
		user *service.AuthUser
		err  error
	)
	if role == "admin" {
		user, err = service.LoginAdmin(a.DB, username, password)
	} else {
		user, err = service.LoginUser(a.DB, username, password)
	}
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
