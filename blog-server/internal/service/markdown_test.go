package service

import (
	"strings"
	"testing"
)

func TestRenderMarkdownSanitizesScripts(t *testing.T) {
	html, err := RenderMarkdown("# 标题\n\n正文 **加粗** 与 `code`。\n\n<script>alert(1)</script>\n")
	if err != nil {
		t.Fatalf("RenderMarkdown: %v", err)
	}
	if strings.Contains(html, "<script") {
		t.Fatalf("script must be sanitized: %q", html)
	}
	if !strings.Contains(html, "<strong>加粗</strong>") {
		t.Fatalf("expected strong emphasis: %q", html)
	}
	if !strings.Contains(html, "<code>code</code>") {
		t.Fatalf("expected inline code: %q", html)
	}
	if strings.HasSuffix(html, "\n") {
		t.Fatalf("trailing newline must be trimmed: %q", html)
	}
}

func TestRenderMarkdownKeepsGFMTable(t *testing.T) {
	html, err := RenderMarkdown("| a | b |\n| - | - |\n| 1 | 2 |\n")
	if err != nil {
		t.Fatalf("RenderMarkdown: %v", err)
	}
	if !strings.Contains(html, "<table>") || !strings.Contains(html, "<td>1</td>") {
		t.Fatalf("GFM table should render: %q", html)
	}
}

func TestRenderMarkdownStripsEventHandlers(t *testing.T) {
	html, err := RenderMarkdown("[x](https://example.com) <img src=x onerror=alert(1)>")
	if err != nil {
		t.Fatalf("RenderMarkdown: %v", err)
	}
	if strings.Contains(html, "onerror") {
		t.Fatalf("event handlers must be stripped: %q", html)
	}
}

func TestBuildTableOfContentsAddsStableAnchors(t *testing.T) {
	body, toc := BuildTableOfContents("<h1>文章标题</h1><h2>第一节</h2><p>正文</p><h3>细节</h3><h2>第二节</h2>")
	if len(toc) != 3 {
		t.Fatalf("toc length = %d, want 3", len(toc))
	}
	if toc[0].Level != 2 || toc[1].Level != 3 || toc[0].Text != "第一节" {
		t.Fatalf("unexpected toc: %+v", toc)
	}
	for _, heading := range toc {
		if !strings.Contains(body, `id="`+heading.ID+`"`) {
			t.Fatalf("body missing anchor %q: %s", heading.ID, body)
		}
	}
}
