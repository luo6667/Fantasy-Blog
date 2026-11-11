// Command server 是博客后端（Go 重写版）的入口。
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
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
	case "migrate-tags":
		if err := runMigrateTags(logger, db, os.Args[2:]); err != nil {
			logger.Error("migrate-tags failed", "error", err)
			os.Exit(1)
		}
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

// runMigrateTags 执行标签映射的导出 / 校验 / 审批写入。
//
// 流程：export 导出 → 人工修改并填写 approvedBy/approvedAt → verify → apply → migrate。
func runMigrateTags(logger *slog.Logger, db *gorm.DB, args []string) error {
	if len(args) == 0 {
		return errors.New("用法：migrate-tags export --out <file> | verify --file <file> | apply --file <file>")
	}
	action := args[0]
	fs := flag.NewFlagSet(action, flag.ContinueOnError)
	out := fs.String("out", "", "export 的输出路径")
	file := fs.String("file", "", "映射文件路径")
	approveBy := fs.String("approve-by", "", "apply 时写入审批人（映射文件未填写时）")
	if err := fs.Parse(args[1:]); err != nil {
		return err
	}

	switch action {
	case "export":
		if *out == "" {
			return errors.New("export 需要 --out <file>")
		}
		f, err := migrate.ExportTagMap(db)
		if err != nil {
			return err
		}
		raw, err := json.MarshalIndent(f, "", "  ")
		if err != nil {
			return err
		}
		if err := os.WriteFile(*out, append(raw, '\n'), 0o600); err != nil {
			return err
		}
		logger.Info("tag map exported", "file", *out, "articles", len(f.Articles), "sourceDigest", f.SourceDigest)
		logger.Info("下一步：人工核对 primaryName/subTags，填写 approvedBy 与 approvedAt，再执行 migrate-tags verify")
		return nil
	case "verify":
		if *file == "" {
			return errors.New("verify 需要 --file <file>")
		}
		f, err := migrate.LoadTagMap(*file)
		if err != nil {
			return err
		}
		problems := migrate.ValidateTagMap(db, f)
		if len(problems) > 0 {
			return fmt.Errorf("校验未通过：\n- %s", strings.Join(problems, "\n- "))
		}
		logger.Info("tag map verified", "file", *file, "articles", len(f.Articles),
			"approvedBy", f.ApprovedBy, "checksum", migrate.TagMapChecksum(f))
		return nil
	case "apply":
		if *file == "" {
			return errors.New("apply 需要 --file <file>")
		}
		f, err := migrate.LoadTagMap(*file)
		if err != nil {
			return err
		}
		if f.ApprovedBy == "" && *approveBy != "" {
			f.ApprovedBy = *approveBy
			f.ApprovedAt = time.Now().UTC().Format(time.RFC3339)
			logger.Info("approval recorded", "approvedBy", f.ApprovedBy, "approvedAt", f.ApprovedAt)
		}
		if err := migrate.ApplyTagMap(db, f); err != nil {
			return err
		}
		logger.Info("tag map applied", "file", *file, "articles", len(f.Articles),
			"checksum", migrate.TagMapChecksum(f))
		logger.Info("下一步：执行 migrate 应用结构迁移")
		return nil
	default:
		return fmt.Errorf("未知子命令 %q（可用：export / verify / apply）", action)
	}
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
