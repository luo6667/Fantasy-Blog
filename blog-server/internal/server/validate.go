package server

import (
	"strings"
	"unicode/utf16"

	"blog-server/internal/httpx"
)

// jsLen 返回 JS 字符串长度（UTF-16 code units），用于对齐 zod 的长度限制。
func jsLen(s string) int { return len(utf16.Encode([]rune(s))) }

// requiredString 校验必填字符串：缺省、修剪后的长度与上限。
//
// 返回值均已 trim；issue 为 nil 表示通过。max 为 UTF-16 长度上限。
func requiredString(raw *string, path, emptyMsg string, max int, maxMsg string) (string, *httpx.Issue) {
	if raw == nil {
		return "", &httpx.Issue{Path: path, Message: "Required"}
	}
	v := strings.TrimSpace(*raw)
	if v == "" {
		return "", &httpx.Issue{Path: path, Message: emptyMsg}
	}
	if max > 0 && jsLen(v) > max {
		return "", &httpx.Issue{Path: path, Message: maxMsg}
	}
	return v, nil
}

// plainString 校验不 trim 的字符串（登录用户名/密码）。
func plainString(raw *string, path, emptyMsg string, max int, maxMsg string) (string, *httpx.Issue) {
	if raw == nil {
		return "", &httpx.Issue{Path: path, Message: "Required"}
	}
	v := *raw
	if v == "" {
		return "", &httpx.Issue{Path: path, Message: emptyMsg}
	}
	if max > 0 && jsLen(v) > max {
		return "", &httpx.Issue{Path: path, Message: maxMsg}
	}
	return v, nil
}

// issuesError 把非空 issue 列表转成 *httpx.ValidationError。
func issuesError(issues []httpx.Issue) error {
	if len(issues) == 0 {
		return nil
	}
	return httpx.Validation(issues...)
}

// oneIssue 把可选的单个 issue 包成切片，便于复用 issuesError。
func oneIssue(issue *httpx.Issue) []httpx.Issue {
	if issue == nil {
		return nil
	}
	return []httpx.Issue{*issue}
}
