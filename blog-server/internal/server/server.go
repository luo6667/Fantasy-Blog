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

// New 构造 App；配置非法（如 TRUSTED_PROXIES 写错）时返回错误。
func New(cfg *config.Config, db *gorm.DB) (*App, error) {
	if err := middleware.ConfigureTrustedProxies(cfg.TrustedProxies); err != nil {
		return nil, err
	}
	manager := auth.NewManager(cfg.JWTSecret, cfg.JWTExpires)
	service.RevalidateHook = func(paths []string) { service.Revalidate(cfg, paths) }
	return &App{
		Cfg:  cfg,
		DB:   db,
		Auth: &middleware.Auth{Manager: manager, DB: db},
	}, nil
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
	contributionsLimiter := middleware.NewRateLimiter(60, time.Minute, "请求过于频繁，请稍后再试", "60-in-1min; q=60; w=60")

	api := r.Group("/api")
	api.Use(middleware.JSONBodyGuard())
	api.GET("/health", func(c *gin.Context) {
		httpx.Success(c, gin.H{"status": "up", "timestamp": httpx.ISO(time.Now())})
	})
	api.GET("/contributions", contributionsLimiter.Handler(), wrap(a.contributions))

	api.POST("/auth/login", authLimiter.Handler(), wrap(a.login))
	api.GET("/auth/me", a.Auth.RequireAuth(), wrap(a.me))

	api.GET("/articles", wrap(a.listArticles))
	api.GET("/articles/:id", wrap(a.articleDetail))
	api.POST("/articles", a.Auth.RequireAdmin(), wrap(a.createArticle))
	api.PUT("/articles/:id", a.Auth.RequireAdmin(), wrap(a.updateArticle))
	api.DELETE("/articles/:id", a.Auth.RequireAdmin(), wrap(a.deleteArticle))

	api.GET("/tags", wrap(a.listTags))
	api.POST("/tags", a.Auth.RequireAdmin(), wrap(a.createTag))
	api.PUT("/tags/:id", a.Auth.RequireAdmin(), wrap(a.updateTag))
	api.DELETE("/tags/:id", a.Auth.RequireAdmin(), wrap(a.deleteTag))

	api.POST("/upload", a.Auth.RequireAdmin(), wrap(a.uploadImage))

	api.GET("/site-content", a.Auth.RequireAdmin(), wrap(a.listSiteContents))
	api.GET("/site-content/:key", wrap(a.getSiteContent))
	api.PUT("/site-content/:key", a.Auth.RequireAdmin(), wrap(a.updateSiteContent))

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
