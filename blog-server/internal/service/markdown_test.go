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
