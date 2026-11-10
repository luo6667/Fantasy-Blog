package migrate

import (
	"reflect"
	"strings"
	"testing"

	"blog-server/migrations"
)

func TestSplitStatements(t *testing.T) {
	sql := "-- comment\nCREATE TABLE `a` (\n  `id` varchar(24) NOT NULL\n);\nDROP TABLE IF EXISTS `b`;\n"
	got := splitStatements(sql)
	want := []string{
		"-- comment\nCREATE TABLE `a` (\n  `id` varchar(24) NOT NULL\n)",
		"DROP TABLE IF EXISTS `b`",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("splitStatements() = %#v, want %#v", got, want)
	}
}

func TestSplitStatementsHandlesTrailingFragment(t *testing.T) {
	got := splitStatements("SELECT 1;")
	if len(got) != 1 || got[0] != "SELECT 1" {
		t.Fatalf("unexpected statements: %#v", got)
	}
}

func TestEmbeddedMigrationsSorted(t *testing.T) {
	names, err := migrationFiles()
	if err != nil {
		t.Fatalf("migrationFiles: %v", err)
	}
	if len(names) == 0 {
		t.Fatal("expected embedded migrations")
	}
	if names[0] != "0000_legacy_schema.sql" {
		t.Fatalf("unexpected first migration: %v", names)
	}
	for i := 1; i < len(names); i++ {
		if strings.Compare(names[i-1], names[i]) > 0 {
			t.Fatalf("migrations must be sorted: %v", names)
		}
	}
}

func TestLegacyBaselineStatementsExecutable(t *testing.T) {
	body := mustReadMigration(t, "0000_legacy_schema.sql")
	statements := splitStatements(body)
	if len(statements) < 20 {
		t.Fatalf("expected many statements, got %d", len(statements))
	}
	for _, stmt := range statements {
		if strings.TrimSpace(stmt) == "" {
			t.Fatal("empty statement produced")
		}
	}
}

func mustReadMigration(t *testing.T, name string) string {
	t.Helper()
	body, err := migrations.FS.ReadFile(name)
	if err != nil {
		t.Fatalf("read %s: %v", name, err)
	}
	return string(body)
}
