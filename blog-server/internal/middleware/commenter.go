package middleware

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"blog-server/internal/auth"
	"blog-server/internal/httpx"
	"blog-server/internal/model"
)

const (
	// CommenterKey 是 Gin context 中的 GitHub 评论者身份。
	CommenterKey         = "commenter"
	commentSessionCookie = "comment_session"
)

// CommenterAuth 验证独立于管理员 JWT 的 GitHub 评论会话。
type CommenterAuth struct {
	Manager *auth.Manager
	DB      *gorm.DB
}

func NewCommenterAuth(secret string, ttl time.Duration, db *gorm.DB) *CommenterAuth {
	if secret == "" {
		return nil
	}
	return &CommenterAuth{Manager: auth.NewManager(secret, ttl), DB: db}
}

// Commenter 是允许公开互动的最小公开资料。
type Commenter struct {
	ID         string `json:"id"`
	Login      string `json:"login"`
	Name       string `json:"name"`
	AvatarURL  string `json:"avatarUrl"`
	ProfileURL string `json:"profileUrl"`
}

func commenterFrom(c *gin.Context) *Commenter {
	v, ok := c.Get(CommenterKey)
	if !ok {
		return nil
	}
	commenter, _ := v.(*Commenter)
	return commenter
}

// CommenterFrom 返回已验证的 GitHub 评论者；无 Cookie 或 Cookie 无效时返回 nil。
func CommenterFrom(c *gin.Context) *Commenter { return commenterFrom(c) }

func (a *CommenterAuth) verifyCookie(c *gin.Context) (*Commenter, error) {
	if a == nil || a.Manager == nil {
		return nil, httpx.NewError(http.StatusServiceUnavailable, "GitHub 评论登录尚未配置")
	}
	token, err := c.Cookie(commentSessionCookie)
	if err != nil || token == "" {
		return nil, httpx.Unauthorized("请先使用 GitHub 登录")
	}
	claims, err := a.Manager.Parse(token)
	if err != nil || claims.Role != "commenter" {
		return nil, httpx.Unauthorized("GitHub 登录已过期，请重新登录")
	}
	var record model.GitHubCommenter
	if err := a.DB.Where("id = ?", claims.Subject).Take(&record).Error; err != nil {
		return nil, httpx.Unauthorized("GitHub 评论账号不存在")
	}
	return &Commenter{ID: record.ID, Login: record.Login, Name: record.Name, AvatarURL: record.AvatarURL, ProfileURL: record.ProfileURL}, nil
}

// Optional 将有效评论者写入 context；无登录态不报错，供公开汇总接口使用。
func (a *CommenterAuth) Optional() gin.HandlerFunc {
	return func(c *gin.Context) {
		commenter, err := a.verifyCookie(c)
		if err == nil {
			c.Set(CommenterKey, commenter)
		}
		c.Next()
	}
}

// Require 限制写操作仅能由 GitHub 评论者发起。
func (a *CommenterAuth) Require() gin.HandlerFunc {
	return func(c *gin.Context) {
		commenter, err := a.verifyCookie(c)
		if err != nil {
			httpx.WriteError(c, err)
			c.Abort()
			return
		}
		c.Set(CommenterKey, commenter)
		c.Next()
	}
}

// SetCommentSession 写入仅供浏览器自动携带的评论会话 Cookie。
func SetCommentSession(c *gin.Context, token string, expires time.Duration, secure bool) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(commentSessionCookie, token, int(expires.Seconds()), "/", "", secure, true)
}

// ClearCommentSession 清除评论会话。
func ClearCommentSession(c *gin.Context, secure bool) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(commentSessionCookie, "", -1, "/", "", secure, true)
}
