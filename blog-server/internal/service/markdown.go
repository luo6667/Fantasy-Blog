package service

import (
	"bytes"
	"regexp"
	"strings"

	"github.com/microcosm-cc/bluemonday"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
)

// md 渲染 GFM：表格、删除线、自动链接、任务列表。
var md = goldmark.New(goldmark.WithExtensions(extension.GFM))

// sanitizer 按白名单过滤渲染结果，语义对齐旧版 rehype-sanitize 默认 schema。
// 允许的标签/属性覆盖 GitHub 常用 Markdown 输出；链接不加 rel（保持与旧输出一致）。
var sanitizer = newSanitizer()

func newSanitizer() *bluemonday.Policy {
	p := bluemonday.NewPolicy()
	p.AllowStandardURLs()
	p.AllowURLSchemes("http", "https", "mailto")

	p.AllowElements(
		"p", "br", "hr", "blockquote",
		"h1", "h2", "h3", "h4", "h5", "h6",
		"ul", "ol", "li",
		"pre", "code",
		"em", "strong", "del", "s", "sub", "sup",
		"img",
		"table", "thead", "tbody", "tfoot", "tr", "th", "td",
		"input",
	)
	p.AllowAttrs("href", "title").OnElements("a")
	p.AllowAttrs("src", "alt", "title", "width", "height").OnElements("img")
	p.AllowAttrs("align", "colspan", "rowspan").OnElements("th", "td")
	p.AllowAttrs("type", "checked", "disabled").OnElements("input")
	p.AllowAttrs("class").Matching(regexp.MustCompile(`^language-[A-Za-z0-9_+-]+$`)).OnElements("code")
	p.AllowAttrs("id").Matching(regexp.MustCompile(`^[A-Za-z0-9_-]+$`)).OnElements("h1", "h2", "h3", "h4", "h5", "h6")
	return p
}

// RenderMarkdown 把 Markdown 编译为净化后的 HTML。
//
// 与旧版 unified 管线语义等价：GFM 解析 → HTML → 白名单过滤。
// 允许的差异：空元素写法、属性顺序、代码块 class 细节、实体编码。
func RenderMarkdown(source string) (string, error) {
	var buf bytes.Buffer
	if err := md.Convert([]byte(source), &buf); err != nil {
		return "", err
	}
	out := sanitizer.Sanitize(buf.String())
	return strings.TrimRight(out, "\n"), nil
}
