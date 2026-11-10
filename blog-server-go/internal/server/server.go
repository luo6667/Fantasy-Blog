// Package server 组装 gin 路由。
package server

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"blog-server/internal/auth"
	"blog-server/internal/config"
	"blog-server/internal/httpx"
	"blog-server/internal/middleware"
	"blog-server/internal/service"
)

// App 持有进程级依赖。
type App struct {
	Cfg  *config.Config
	DB   *gorm.DB
	Auth *middleware.Auth
}

// New 构造 App。
func New(cfg *config.Config, db *gorm.DB) *App {
	manager := auth.NewManager(cfg.JWTSecret, cfg.JWTExpires)
	service.RevalidateHook = func(paths []string) { service.Revalidate(cfg, paths) }
	return &App{
		Cfg:  cfg,
		DB:   db,
		Auth: &middleware.Auth{Manager: manager, DB: db},
	}
}

// encKey 返回解码后的 AI 主密钥；未配置时返回 nil（写入端会降级并告警）。
func (a *App) encKey() []byte {
	key, err := service.DecodeEncKey(a.Cfg.AIConfigEncKey)
	if err != nil {
		return nil
	}
	return key
}

// Router 组装全部中间件与路由。
func (a *App) Router() *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(middleware.Recovery(), middleware.SecurityHeaders(), middleware.CORS(a.Cfg.CORSOrigins))

	r.NoRoute(func(c *gin.Context) {
		httpx.Fail(c, 404, "Route not found: "+c.Request.Method+" "+c.Request.URL.RequestURI())
	})

	authLimiter := middleware.NewRateLimiter(20, 15*time.Minute, "尝试过于频繁，请 15 分钟后再试", "20-in-15min; q=20; w=900")
	writeLimiter := middleware.NewRateLimiter(30, time.Minute, "操作过于频繁，请稍后再试", "30-in-1min; q=30; w=60")

	api := r.Group("/api")
	api.Use(middleware.JSONBodyGuard())
	api.GET("/health", func(c *gin.Context) {
		httpx.Success(c, gin.H{"status": "up", "timestamp": httpx.ISO(time.Now())})
	})

	api.POST("/auth/register", authLimiter.Handler(), wrap(a.register))
	api.POST("/auth/login", authLimiter.Handler(), wrap(a.login))
	api.GET("/auth/me", a.Auth.RequireAuth(), wrap(a.me))

	optional := a.Auth.OptionalAuth()
	api.GET("/articles", optional, wrap(a.listArticles))
	api.GET("/articles/tags", wrap(a.articleTags))
	api.GET("/articles/:id", optional, wrap(a.articleDetail))
	api.GET("/articles/:id/comments", optional, wrap(a.listComments))
	api.POST("/articles/:id/comments", writeLimiter.Handler(), a.Auth.RequireAuth(), wrap(a.createComment))
	api.POST("/articles/:id/like", writeLimiter.Handler(), a.Auth.RequireAuth(), wrap(a.likeArticle))
	api.POST("/articles", a.Auth.RequireAdmin(), wrap(a.createArticle))
	api.PUT("/articles/:id", a.Auth.RequireAdmin(), wrap(a.updateArticle))
	api.DELETE("/articles/:id", a.Auth.RequireAdmin(), wrap(a.deleteArticle))

	api.POST("/comments/:id/replies", writeLimiter.Handler(), a.Auth.RequireAuth(), wrap(a.createReply))
	api.POST("/comments/:id/like", writeLimiter.Handler(), a.Auth.RequireAuth(), wrap(a.likeComment))
	api.DELETE("/comments/:id", a.Auth.RequireAuth(), wrap(a.deleteComment))

	api.GET("/tags", wrap(a.listTags))
	api.POST("/tags", a.Auth.RequireAdmin(), wrap(a.createTag))
	api.DELETE("/tags/:name", a.Auth.RequireAdmin(), wrap(a.deleteTag))

	api.GET("/notifications", a.Auth.RequireAuth(), wrap(a.listNotifications))
	api.GET("/notifications/unread-count", a.Auth.RequireAuth(), wrap(a.unreadCount))
	api.POST("/notifications/read", a.Auth.RequireAuth(), wrap(a.markRead))

	api.GET("/users/manage", a.Auth.RequireAdmin(), wrap(a.listUsers))
	api.DELETE("/users/:id", a.Auth.RequireAdmin(), wrap(a.deleteUser))

	api.POST("/upload", a.Auth.RequireAdmin(), wrap(a.uploadImage))

	api.GET("/site-content", a.Auth.RequireAdmin(), wrap(a.listSiteContents))
	api.GET("/site-content/:key", wrap(a.getSiteContent))
	api.PUT("/site-content/:key", a.Auth.RequireAdmin(), wrap(a.updateSiteContent))

	api.GET("/ai/settings", a.Auth.RequireAdmin(), wrap(a.getAISettings))
	api.PUT("/ai/settings", a.Auth.RequireAdmin(), wrap(a.saveAISettings))
	api.POST("/ai/chat", a.Auth.RequireAuth(), wrap(a.aiChat))

	a.uploads(r)
	return r
}

// wrap 把返回 error 的 handler 转成 gin.HandlerFunc。
func wrap(h func(*gin.Context) error) gin.HandlerFunc {
	return func(c *gin.Context) {
		if err := h(c); err != nil {
			httpx.WriteError(c, err)
		}
	}
}

// uploads 以 immutable 缓存头提供 /uploads 静态文件；未命中交给 404 兜底。
func (a *App) uploads(r *gin.Engine) {
	serve := func(c *gin.Context) {
		rel := strings.TrimPrefix(c.Param("filepath"), "/")
		// 阻止路径穿越：只允许普通文件名/子路径，且解析后必须仍在上传目录内。
		clean := filepath.Clean("/" + rel)
		full := filepath.Join(a.Cfg.UploadDirAbs, clean)
		absRoot, err1 := filepath.Abs(a.Cfg.UploadDirAbs)
		absFull, err2 := filepath.Abs(full)
		if err1 != nil || err2 != nil || !strings.HasPrefix(absFull, absRoot+string(os.PathSeparator)) {
			httpx.Fail(c, 404, "Route not found: "+c.Request.Method+" "+c.Request.URL.RequestURI())
			return
		}
		info, statErr := os.Stat(absFull)
		if statErr != nil || info.IsDir() {
			httpx.Fail(c, 404, "Route not found: "+c.Request.Method+" "+c.Request.URL.RequestURI())
			return
		}
		c.Header("Cache-Control", "public, max-age=31536000, immutable")
		c.Header("X-Content-Type-Options", "nosniff")
		if c.Request.Method == http.MethodHead {
			c.Status(http.StatusOK)
			return
		}
		c.File(absFull)
	}
	r.GET("/uploads/*filepath", serve)
	r.HEAD("/uploads/*filepath", serve)
}
