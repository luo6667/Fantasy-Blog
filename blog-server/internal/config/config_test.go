package config

import (
	"strings"
	"testing"
)

func TestLoadRequiresMySQLPasswordInProduction(t *testing.T) {
	t.Setenv("NODE_ENV", "production")
	t.Setenv("JWT_SECRET", "0123456789abcdef")
	t.Setenv("MYSQL_PASSWORD", "")

	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "MYSQL_PASSWORD") {
		t.Fatalf("production without MYSQL_PASSWORD should fail, got %v", err)
	}
}

func TestLoadKeepsDevFallbackPassword(t *testing.T) {
	t.Setenv("NODE_ENV", "development")
	t.Setenv("JWT_SECRET", "0123456789abcdef")
	t.Setenv("MYSQL_PASSWORD", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("development fallback should load: %v", err)
	}
	if cfg.MySQLPass != "1234" {
		t.Fatalf("development fallback password = %q", cfg.MySQLPass)
	}
}
