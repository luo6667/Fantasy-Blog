package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseDotEnvLine(t *testing.T) {
	cases := []struct {
		name      string
		line      string
		wantKey   string
		wantValue string
		wantOK    bool
	}{
		{"plain", "PORT=4000", "PORT", "4000", true},
		{"spaces", "  MYSQL_DATABASE = jianli  ", "MYSQL_DATABASE", "jianli", true},
		{"export", "export JWT_SECRET=abc", "JWT_SECRET", "abc", true},
		{"double quote", `AI_KEY="sk-with-#hash"`, "AI_KEY", "sk-with-#hash", true},
		{"double quote escape", `PATH_VALUE="a\nb"`, "PATH_VALUE", "a\nb", true},
		{"single quote", `NAME='a # b'`, "NAME", "a # b", true},
		{"inline comment", "URL=http://x # 说明", "URL", "http://x", true},
		{"hash in value", "URL=http://x#frag", "URL", "http://x#frag", true},
		{"empty value", "EMPTY=", "EMPTY", "", true},
		{"comment", "# just a comment", "", "", false},
		{"blank", "   ", "", "", false},
		{"no equals", "JUST_A_KEY", "", "", false},
		{"empty key", "=value", "", "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			key, value, ok := parseDotEnvLine(tc.line)
			if ok != tc.wantOK || key != tc.wantKey || value != tc.wantValue {
				t.Fatalf("parseDotEnvLine(%q) = (%q, %q, %v), want (%q, %q, %v)",
					tc.line, key, value, ok, tc.wantKey, tc.wantValue, tc.wantOK)
			}
		})
	}
}

func TestApplyDotEnvKeepsExistingEnv(t *testing.T) {
	t.Setenv("DOTENV_EXISTING", "from-shell")
	oldValue, hadValue := os.LookupEnv("DOTENV_NEW")
	if err := os.Unsetenv("DOTENV_NEW"); err != nil {
		t.Fatalf("unset env: %v", err)
	}
	t.Cleanup(func() {
		if hadValue {
			_ = os.Setenv("DOTENV_NEW", oldValue)
		} else {
			_ = os.Unsetenv("DOTENV_NEW")
		}
	})

	count, err := applyDotEnv(strings.NewReader("DOTENV_EXISTING=from-file\nDOTENV_NEW=from-file\n"))
	if err != nil {
		t.Fatalf("applyDotEnv: %v", err)
	}
	if count != 1 {
		t.Fatalf("injected %d vars, want 1", count)
	}
	if got := os.Getenv("DOTENV_EXISTING"); got != "from-shell" {
		t.Fatalf("existing var overwritten: %q", got)
	}
	if got := os.Getenv("DOTENV_NEW"); got != "from-file" {
		t.Fatalf("new var = %q, want from-file", got)
	}
}

func TestLoadDotEnvExplicitMissingFile(t *testing.T) {
	t.Setenv("ENV_FILE", filepath.Join(t.TempDir(), "missing.env"))
	if _, _, err := LoadDotEnv(); err == nil {
		t.Fatal("expected error for missing ENV_FILE")
	}
}

func TestLoadDotEnvReadsCwdFile(t *testing.T) {
	dir := t.TempDir()
	content := "DOTENV_CWD_VALUE=hello\n"
	if err := os.WriteFile(filepath.Join(dir, ".env"), []byte(content), 0o600); err != nil {
		t.Fatalf("write .env: %v", err)
	}

	t.Setenv("ENV_FILE", "")
	// 确保该变量不存在，才能观察到 .env 的注入。
	oldValue, hadValue := os.LookupEnv("DOTENV_CWD_VALUE")
	if err := os.Unsetenv("DOTENV_CWD_VALUE"); err != nil {
		t.Fatalf("unset env: %v", err)
	}
	t.Cleanup(func() {
		if hadValue {
			_ = os.Setenv("DOTENV_CWD_VALUE", oldValue)
		} else {
			_ = os.Unsetenv("DOTENV_CWD_VALUE")
		}
	})
	t.Chdir(dir)

	path, count, err := LoadDotEnv()
	if err != nil {
		t.Fatalf("LoadDotEnv: %v", err)
	}
	if path == "" {
		t.Fatal("expected a loaded path")
	}
	if count != 1 {
		t.Fatalf("count = %d, want 1", count)
	}
	if got := os.Getenv("DOTENV_CWD_VALUE"); got != "hello" {
		t.Fatalf("value = %q, want hello", got)
	}
}
