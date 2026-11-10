// Package middleware 提供安全头、CORS、限流与鉴权中间件。
package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"blog-server/internal/auth"
	"blog-server/internal/httpx"
	"blog-server/internal/model"
)

// ActorKey 是 gin.Context 中保存请求主体的键。
const ActorKey = "actor"

// Actor 读取当前请求主体。
func ActorFrom(c *gin.Context) *auth.Actor {
	v, ok := c.Get(ActorKey)
	if !ok {
		return nil
	}
	a, _ := v.(*auth.Actor)
	return a
}

// SecurityHeaders 复刻 helmet 默认头。
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.Writer.Header()
		h.Set("Content-Security-Policy", "default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests")
		h.Set("Cross-Origin-Opener-Policy", "same-origin")
		h.Set("Cross-Origin-Resource-Policy", "same-origin")
		h.Set("Origin-Agent-Cluster", "?1")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Strict-Transport-Security", "max-age=15552000; includeSubDomains")
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-DNS-Prefetch-Control", "off")
		h.Set("X-Download-Options", "noopen")
		h.Set("X-Frame-Options", "SAMEORIGIN")
		h.Set("X-Permitted-Cross-Domain-Policies", "none")
		h.Set("X-XSS-Protection", "0")
		c.Next()
	}
}

// CORS 按白名单回写跨域头（与旧版 cors({credentials:true}) 行为一致）。
func CORS(origins []string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(origins))
	for _, o := range origins {
		allowed[strings.TrimSpace(o)] = struct{}{}
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" {
			if _, ok := allowed[origin]; ok {
				h := c.Writer.Header()
				h.Set("Access-Control-Allow-Origin", origin)
				h.Set("Access-Control-Allow-Credentials", "true")
				h.Add("Vary", "Origin")
				if c.Request.Method == http.MethodOptions {
					h.Set("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE")
					if reqHeaders := c.GetHeader("Access-Control-Request-Headers"); reqHeaders != "" {
						h.Set("Access-Control-Allow-Headers", reqHeaders)
					}
					c.AbortWithStatus(204)
					return
				}
			}
		}
		c.Next()
	}
}

// ClientIP 取客户端 IP（trust proxy 1：X-Forwarded-For 的最后一跳）。
func ClientIP(c *gin.Context) string {
	if xff := c.GetHeader("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if ip := strings.TrimSpace(parts[len(parts)-1]); ip != "" {
			return ip
		}
	}
	host, _, err := net.SplitHostPort(c.Request.RemoteAddr)
	if err != nil {
		return c.Request.RemoteAddr
	}
	return host
}

type rateEntry struct {
	windowStart time.Time
	count       int
}

// JSONBodyGuard 复刻 express.json 的解析语义：只处理 JSON 请求体，
// 语法错误在进入业务路由与限流之前返回 400，与旧实现保持一致。
func JSONBodyGuard() gin.HandlerFunc {
	const maxBody = 1 << 20
	return func(c *gin.Context) {
		if c.Request.Body == nil || c.Request.ContentLength == 0 ||
			!strings.Contains(strings.ToLower(c.ContentType()), "application/json") {
			c.Next()
			return
		}
		raw, err := io.ReadAll(io.LimitReader(c.Request.Body, maxBody+1))
		if err != nil {
			httpx.Fail(c, 400, "请求体格式错误")
			c.Abort()
			return
		}
		if len(raw) > maxBody {
			httpx.Fail(c, 413, "request entity too large")
			c.Abort()
			return
		}
		if len(bytes.TrimSpace(raw)) > 0 && !json.Valid(raw) {
			httpx.Fail(c, 400, "请求体格式错误")
			c.Abort()
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewReader(raw))
		c.Next()
	}
}

// RateLimiter 是固定窗口内存限流器（单进程，与 express-rate-limit 默认 MemoryStore 等价）。
type RateLimiter struct {
	mu      sync.Mutex
	entries map[string]*rateEntry
	limit   int
	window  time.Duration
	msg     string
	// policy 用于 draft-8 头，例如 "20-in-15min"; q=20; w=900。
	policy string
}

// NewRateLimiter 构造限流中间件。
func NewRateLimiter(limit int, window time.Duration, msg, policy string) *RateLimiter {
	return &RateLimiter{
		entries: make(map[string]*rateEntry),
		limit:   limit,
		window:  window,
		msg:     msg,
		policy:  policy,
	}
}

// Handler 返回 gin 中间件。
func (rl *RateLimiter) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := ClientIP(c) + "|" + rl.policy
		now := time.Now()

		rl.mu.Lock()
		e, ok := rl.entries[key]
		if !ok || now.Sub(e.windowStart) >= rl.window {
			e = &rateEntry{windowStart: now}
			rl.entries[key] = e
		}
		e.count++
		count := e.count
		remaining := rl.limit - count
		if remaining < 0 {
			remaining = 0
		}
		reset := int(e.windowStart.Add(rl.window).Sub(now).Seconds())
		if reset < 0 {
			reset = 0
		}
		rl.mu.Unlock()

		h := c.Writer.Header()
		h.Set("RateLimit-Policy", rl.policy)
		h.Set("RateLimit", fmt.Sprintf("\"%s\"; q=%d; w=%d; pk=:%s:", rl.policy, rl.limit, int(rl.window.Seconds()), "local"))
		h.Set("RateLimit-Limit", fmt.Sprintf("%d", rl.limit))
		h.Set("RateLimit-Remaining", fmt.Sprintf("%d", remaining))
		h.Set("RateLimit-Reset", fmt.Sprintf("%d", reset))

		if count > rl.limit {
			httpx.Fail(c, 429, rl.msg)
			c.Abort()
			return
		}
		c.Next()
	}
}

// Auth 封装 JWT 校验与数据库回查。
type Auth struct {
	Manager *auth.Manager
	DB      *gorm.DB
}

// verify 校验 token 并回查数据库，返回当前主体。
func (a *Auth) verify(token string) (*auth.Actor, error) {
	claims, err := a.Manager.Parse(token)
	if err != nil {
		return nil, httpx.Unauthorized("登录已过期，请重新登录")
	}
	switch claims.Role {
	case "admin":
		var admin model.Admin
		if err := a.DB.Select("id", "username").Where("id = ?", claims.Subject).Take(&admin).Error; err != nil {
			return nil, httpx.Unauthorized("管理员不存在")
		}
		return &auth.Actor{ID: admin.ID, Username: admin.Username, Role: "admin"}, nil
	case "user":
		var user model.User
		if err := a.DB.Select("id", "username").Where("id = ?", claims.Subject).Take(&user).Error; err != nil {
			return nil, httpx.Unauthorized("用户不存在")
		}
		return &auth.Actor{ID: user.ID, Username: user.Username, Role: "user"}, nil
	default:
		return nil, httpx.Unauthorized("登录已过期，请重新登录")
	}
}

// RequireAuth 要求有效登录态。
func (a *Auth) RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			httpx.Fail(c, 401, "请先登录")
			c.Abort()
			return
		}
		actor, err := a.verify(strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			httpx.WriteError(c, err)
			c.Abort()
			return
		}
		c.Set(ActorKey, actor)
		c.Next()
	}
}

// RequireAdmin 要求管理员。
func (a *Auth) RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			httpx.Fail(c, 401, "请先登录")
			c.Abort()
			return
		}
		actor, err := a.verify(strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			httpx.WriteError(c, err)
			c.Abort()
			return
		}
		if actor.Role != "admin" {
			httpx.Fail(c, 403, "需要管理员权限")
			c.Abort()
			return
		}
		c.Set(ActorKey, actor)
		c.Next()
	}
}

// OptionalAuth 解析登录态但不强制（公开接口读取 likedByMe/mine 用）。
func (a *Auth) OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if strings.HasPrefix(header, "Bearer ") {
			if actor, err := a.verify(strings.TrimPrefix(header, "Bearer ")); err == nil {
				c.Set(ActorKey, actor)
			}
		}
		c.Next()
	}
}

// Recovery 捕获 panic 并返回 500 信封。
func Recovery() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, _ any) {
		httpx.Fail(c, 500, "Internal server error")
		c.Abort()
	})
}
