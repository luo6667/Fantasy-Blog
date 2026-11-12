// Package config 载入并校验环境变量。
//
// 与旧 Node 实现（src/config/env.ts）保持同名变量、同默认值、同 fail-fast 语义：
// 缺少 JWT_SECRET 或长度不足时直接返回错误，由 main 打印后退出。
package config

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// Config 是进程运行所需的全部配置。
type Config struct {
	NodeEnv     string
	Port        int
	MySQLHost   string
	MySQLPort   int
	MySQLUser   string
	MySQLPass   string
	MySQLDB     string
	JWTSecret   string
	JWTExpires  time.Duration
	CORSOrigins []string
	// TrustedProxies 是允许携带 X-Forwarded-For 的代理地址（IP 或 CIDR）。
	TrustedProxies []string

	AdminInitialPassword string

	UploadDir     string
	UploadDirAbs  string
	UploadMaxSize int64

	NextRevalidateURL string
	RevalidateSecret  string
	GitHubToken       string
}

// Load 从环境变量读取配置，缺省值与 Node 版一致。
func Load() (*Config, error) {
	c := &Config{
		NodeEnv:       envString("NODE_ENV", "development"),
		MySQLHost:     envString("MYSQL_HOST", "127.0.0.1"),
		MySQLUser:     envString("MYSQL_USER", "root"),
		MySQLPass:     os.Getenv("MYSQL_PASSWORD"),
		MySQLDB:       envString("MYSQL_DATABASE", "jianli"),
		JWTSecret:     os.Getenv("JWT_SECRET"),
		UploadDir:     envString("UPLOAD_DIR", "uploads"),
		UploadMaxSize: int64(envInt("UPLOAD_MAX_SIZE", 5*1024*1024)),

		AdminInitialPassword: os.Getenv("ADMIN_INITIAL_PASSWORD"),
		NextRevalidateURL:    os.Getenv("NEXT_REVALIDATE_URL"),
		RevalidateSecret:     os.Getenv("REVALIDATE_SECRET"),
		GitHubToken:          os.Getenv("GITHUB_TOKEN"),
		TrustedProxies:       splitOrigins(envString("TRUSTED_PROXIES", "127.0.0.1,::1")),
	}

	if c.MySQLPass == "" {
		if c.NodeEnv == "production" {
			return nil, fmt.Errorf("MYSQL_PASSWORD must be set in production")
		}
		c.MySQLPass = "1234"
	}

	var err error
	if c.Port, err = parseIntEnv("PORT", 4000); err != nil {
		return nil, err
	}
	if c.MySQLPort, err = parseIntEnv("MYSQL_PORT", 3306); err != nil {
		return nil, err
	}

	if len(c.JWTSecret) < 16 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 16 characters")
	}
	if c.NodeEnv != "development" && c.NodeEnv != "production" && c.NodeEnv != "test" {
		return nil, fmt.Errorf("NODE_ENV must be one of development, production, test")
	}
	if c.UploadMaxSize <= 0 {
		return nil, fmt.Errorf("UPLOAD_MAX_SIZE must be positive")
	}
	if c.NextRevalidateURL != "" {
		if u, perr := url.Parse(c.NextRevalidateURL); perr != nil || u.Scheme == "" || u.Host == "" {
			return nil, fmt.Errorf("NEXT_REVALIDATE_URL must be a valid URL")
		}
	}
	if c.RevalidateSecret != "" && len(c.RevalidateSecret) < 8 {
		return nil, fmt.Errorf("REVALIDATE_SECRET must be at least 8 characters")
	}

	c.JWTExpires, err = parseDuration(envString("JWT_EXPIRES_IN", "7d"))
	if err != nil {
		return nil, fmt.Errorf("JWT_EXPIRES_IN: %w", err)
	}

	c.CORSOrigins = splitOrigins(envString("CORS_ORIGIN", "http://localhost:3000"))

	// UPLOAD_DIR 为相对路径时按进程工作目录解析；生产部署由 systemd 指定
	// WorkingDirectory 并使用绝对路径，行为与旧版“固定相对项目根”一致。
	if filepath.IsAbs(c.UploadDir) {
		c.UploadDirAbs = filepath.Clean(c.UploadDir)
	} else {
		cwd, cerr := os.Getwd()
		if cerr != nil {
			return nil, cerr
		}
		c.UploadDirAbs = filepath.Join(cwd, c.UploadDir)
	}

	return c, nil
}

// MySQLDSN 返回 gorm mysql 驱动使用的 DSN。
//
// 关键参数与 Sequelize 的 timezone '+08:00' 对齐：loc=Asia/Shanghai 让
// DATETIME 的读写都按东八区解释，parseTime=true 直接扫描为 time.Time。
func (c *Config) MySQLDSN() string {
	loc := url.QueryEscape("Asia/Shanghai")
	return fmt.Sprintf(
		"%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=true&loc=%s",
		c.MySQLUser, c.MySQLPass, c.MySQLHost, c.MySQLPort, c.MySQLDB, loc,
	)
}

// ServerAddr 返回监听地址。
func (c *Config) ServerAddr() string {
	return fmt.Sprintf(":%d", c.Port)
}

func envString(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func parseIntEnv(key string, fallback int) (int, error) {
	v := os.Getenv(key)
	if v == "" {
		return fallback, nil
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return 0, fmt.Errorf("%s must be a positive integer", key)
	}
	return n, nil
}

// splitOrigins 按逗号分割并 trim，空项丢弃。
func splitOrigins(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// parseDuration 支持 Go 原生写法（7d 除外）与纯秒数。
func parseDuration(raw string) (time.Duration, error) {
	if n, err := strconv.Atoi(raw); err == nil {
		if n > 0 {
			return time.Duration(n) * time.Second, nil
		}
		return 0, fmt.Errorf("must be positive")
	}
	if strings.HasSuffix(raw, "d") {
		days, err := strconv.Atoi(strings.TrimSuffix(raw, "d"))
		if err != nil || days <= 0 {
			return 0, fmt.Errorf("invalid duration %q", raw)
		}
		return time.Duration(days) * 24 * time.Hour, nil
	}
	d, err := time.ParseDuration(raw)
	if err != nil {
		return 0, err
	}
	if d <= 0 {
		return 0, fmt.Errorf("must be positive")
	}
	return d, nil
}
