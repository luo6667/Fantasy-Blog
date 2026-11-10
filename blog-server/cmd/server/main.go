// Command server 是博客后端（Go 重写版）的入口。
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"blog-server/internal/config"
	"blog-server/internal/database"
	"blog-server/internal/migrate"
	"blog-server/internal/server"
	"blog-server/internal/service"

	"gorm.io/gorm"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	if path, count, err := config.LoadDotEnv(); err != nil {
		logger.Warn("load env file failed", "error", err)
	} else if path != "" {
		logger.Info("env file loaded", "path", path, "vars", count)
	}

	cfg, err := config.Load()
	if err != nil {
		logger.Error("invalid environment variables", "error", err)
		os.Exit(1)
	}

	if err := database.EnsureDatabase(cfg); err != nil {
		logger.Error("ensure database failed", "error", err)
		os.Exit(1)
	}
	db, err := database.Open(cfg)
	if err != nil {
		logger.Error("connect database failed", "error", err)
		os.Exit(1)
	}

	switch command() {
	case "migrate":
		applied, err := migrate.Apply(db)
		if err != nil {
			logger.Error("migrate failed", "error", err)
			os.Exit(1)
		}
		logger.Info("migrate done", "applied", applied)
		return
	case "migrate-ai-keys":
		encKey, err := service.DecodeEncKey(cfg.AIConfigEncKey)
		if err != nil {
			logger.Error("invalid AI_CONFIG_ENC_KEY", "error", err)
			os.Exit(1)
		}
		count, err := service.MigrateAIKeys(db, encKey)
		if err != nil {
			logger.Error("migrate ai keys failed", "error", err)
			os.Exit(1)
		}
		logger.Info("migrate ai keys done", "migrated", count)
		return
	case "seed-admin":
		if len(cfg.AdminInitialPassword) < 8 {
			logger.Error("ADMIN_INITIAL_PASSWORD is required (at least 8 characters)")
			os.Exit(1)
		}
		username := envOr("ADMIN_USERNAME", "admin")
		action, err := service.SeedAdmin(db, username, cfg.AdminInitialPassword)
		if err != nil {
			logger.Error("seed admin failed", "error", err)
			os.Exit(1)
		}
		logger.Info("seed admin done", "action", action, "username", username)
		return
	}

	serve(logger, cfg, db)
}

// command 返回子命令（默认空字符串表示启动 HTTP 服务）。
func command() string {
	if len(os.Args) < 2 {
		return ""
	}
	return os.Args[1]
}

// envOr 返回环境变量值，未设置时使用默认值。
func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func serve(logger *slog.Logger, cfg *config.Config, db *gorm.DB) {
	app := server.New(cfg, db)
	handler := app.Router()

	srv := &http.Server{
		Addr:              cfg.ServerAddr(),
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		logger.Info("server listening", "addr", cfg.ServerAddr(), "env", cfg.NodeEnv)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("listen failed", "error", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("shutdown failed", "error", err)
	}
	logger.Info("server stopped")
}
