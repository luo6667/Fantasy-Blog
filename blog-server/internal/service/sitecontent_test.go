package service

import (
	"reflect"
	"testing"
)

func TestSiteContentRevalidatePaths(t *testing.T) {
	cases := []struct {
		key  string
		want []string
	}{
		{"plan", []string{"/plan"}},
		{"education", []string{"/resume"}},
		{"skills", []string{"/resume"}},
		{"resumeProjects", []string{"/resume"}},
		{"evaluation", []string{"/resume"}},
		{"homeProjects", []string{"/home"}},
		{"unknown", nil},
	}
	for _, c := range cases {
		got := SiteContentRevalidatePaths(c.key)
		if !reflect.DeepEqual(got, c.want) {
			t.Fatalf("%s: got %v, want %v", c.key, got, c.want)
		}
	}
}

// 每个合法 key 都必须映射到至少一个公开页，避免新增 key 后忘记接重建。
func TestEverySiteContentKeyHasRevalidatePath(t *testing.T) {
	for _, key := range SiteContentKeys {
		if len(SiteContentRevalidatePaths(key)) == 0 {
			t.Fatalf("key %q has no revalidate path", key)
		}
	}
}

// 不同 key 更新的路径互不影响，避免重复重建无关页面。
func TestSiteContentRevalidatePathsAreScoped(t *testing.T) {
	if got := SiteContentRevalidatePaths("homeProjects"); !reflect.DeepEqual(got, []string{"/home"}) {
		t.Fatalf("homeProjects: got %v", got)
	}
	if got := SiteContentRevalidatePaths("plan"); !reflect.DeepEqual(got, []string{"/plan"}) {
		t.Fatalf("plan: got %v", got)
	}
}
