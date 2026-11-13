package service

import (
	"bytes"
	"regexp"
	"strconv"
	"strings"

	"github.com/microcosm-cc/bluemonday"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	xhtml "golang.org/x/net/html"
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

// Heading 是文章正文目录的一项；仅包含正文 H2/H3，不重复文章的 H1 标题。
type Heading struct {
	ID    string `json:"id"`
	Level int    `json:"level"`
	Text  string `json:"text"`
}

// BuildTableOfContents 为已消毒 HTML 的 H2/H3 注入确定性锚点并提取目录。
// 该步骤发生在读取详情时，因此历史文章不必重新保存也能拥有目录。
func BuildTableOfContents(source string) (string, []Heading) {
	doc, err := xhtml.Parse(strings.NewReader("<!doctype html><html><body>" + source + "</body></html>"))
	if err != nil {
		return source, []Heading{}
	}
	body := findElement(doc, "body")
	if body == nil {
		return source, []Heading{}
	}
	toc := make([]Heading, 0)
	index := 0
	var visit func(*xhtml.Node)
	visit = func(node *xhtml.Node) {
		if node.Type == xhtml.ElementNode && (node.Data == "h2" || node.Data == "h3") {
			index++
			level := 2
			if node.Data == "h3" {
				level = 3
			}
			id := "section-" + strconv.Itoa(index)
			setHTMLAttr(node, "id", id)
			toc = append(toc, Heading{ID: id, Level: level, Text: strings.TrimSpace(nodeText(node))})
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			visit(child)
		}
	}
	visit(body)
	var out bytes.Buffer
	for child := body.FirstChild; child != nil; child = child.NextSibling {
		if err := xhtml.Render(&out, child); err != nil {
			return source, toc
		}
	}
	return strings.TrimSpace(out.String()), toc
}

func findElement(node *xhtml.Node, name string) *xhtml.Node {
	if node.Type == xhtml.ElementNode && node.Data == name {
		return node
	}
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		if found := findElement(child, name); found != nil {
			return found
		}
	}
	return nil
}

func nodeText(node *xhtml.Node) string {
	var out strings.Builder
	var visit func(*xhtml.Node)
	visit = func(current *xhtml.Node) {
		if current.Type == xhtml.TextNode {
			out.WriteString(current.Data)
		}
		for child := current.FirstChild; child != nil; child = child.NextSibling {
			visit(child)
		}
	}
	visit(node)
	return out.String()
}

func setHTMLAttr(node *xhtml.Node, key, value string) {
	for i := range node.Attr {
		if node.Attr[i].Key == key {
			node.Attr[i].Val = value
			return
		}
	}
	node.Attr = append(node.Attr, xhtml.Attribute{Key: key, Val: value})
}
