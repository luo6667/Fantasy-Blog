// Package httpx 提供统一响应信封、时间序列化与业务错误类型。
//
// 信封与旧 Node 实现完全一致：
//   - 成功 {code:0, msg:'success', data}
//   - 失败 {code:<status>, msg, data:null}
package httpx

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// Envelope 是全局响应结构。
type Envelope struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data any    `json:"data"`
}

// Success 写出 200 成功响应。
func Success(c *gin.Context, data any) {
	c.JSON(200, Envelope{Code: 0, Msg: "success", Data: data})
}

// SuccessMsg 写出指定状态码与消息的成功响应。
func SuccessMsg(c *gin.Context, status int, msg string, data any) {
	c.JSON(status, Envelope{Code: 0, Msg: msg, Data: data})
}

// Fail 写出失败响应，data 固定为 null。
func Fail(c *gin.Context, status int, msg string) {
	c.JSON(status, Envelope{Code: status, Msg: msg, Data: nil})
}

// Error 是带 HTTP 状态码的业务错误。
type Error struct {
	Status int
	Msg    string
}

func (e *Error) Error() string { return e.Msg }

// NewError 构造业务错误。
func NewError(status int, msg string) *Error { return &Error{Status: status, Msg: msg} }

// BadRequest 400。
func BadRequest(msg string) *Error { return NewError(400, msg) }

// Unauthorized 401。
func Unauthorized(msg string) *Error { return NewError(401, msg) }

// Forbidden 403。
func Forbidden(msg string) *Error { return NewError(403, msg) }

// NotFound 404。
func NotFound(msg string) *Error { return NewError(404, msg) }

// Conflict 409。
func Conflict(msg string) *Error { return NewError(409, msg) }

// ValidationError 表示请求体校验失败（对应旧实现的 ZodError 文案格式）。
type ValidationError struct {
	Issues []Issue
}

// Issue 是单个字段的校验问题。
type Issue struct {
	Path    string
	Message string
}

func (e *ValidationError) Error() string { return e.Join() }

// Join 按旧实现格式拼接：`path: message; path2: message2`。
func (e *ValidationError) Join() string {
	out := ""
	for i, issue := range e.Issues {
		if i > 0 {
			out += "; "
		}
		path := issue.Path
		if path == "" {
			path = "body"
		}
		out += path + ": " + issue.Message
	}
	return out
}

// Validation 构造字段校验错误。
func Validation(issues ...Issue) *ValidationError { return &ValidationError{Issues: issues} }

// Time 是以毫秒精度序列化为 ISO-8601 UTC 的时间类型（与 JS Date#toISOString 一致）。
type Time time.Time

// MarshalJSON 输出 2006-01-02T15:04:05.000Z。
func (t Time) MarshalJSON() ([]byte, error) {
	utc := time.Time(t).UTC()
	return []byte(`"` + utc.Format("2006-01-02T15:04:05.000Z") + `"`), nil
}

// isoTime 序列化任意 time.Time。
func isoTime(t time.Time) string { return t.UTC().Format("2006-01-02T15:04:05.000Z") }

// ISO 返回 ISO 时间字符串。
func ISO(t time.Time) string { return isoTime(t) }

// Now 返回当前时间（保持原精度）。
func Now() time.Time { return time.Now() }

// Date 返回 UTC 日期 YYYY-MM-DD。
func Date(t time.Time) string { return t.UTC().Format("2006-01-02") }

// DecodeJSON 解析 JSON 请求体。
//
// 与 body-parser 对齐：空 body 视为 {}；未知字段一律 400，避免客户端字段拼错被静默忽略。
func DecodeJSON(c *gin.Context, dst any) error {
	dec := json.NewDecoder(c.Request.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		if errors.Is(err, io.EOF) {
			return nil
		}
		if field, ok := unknownJSONField(err); ok {
			return NewError(400, "请求体包含未知字段："+field)
		}
		return NewError(400, "请求体格式错误")
	}
	return nil
}

// unknownJSONField 从 encoding/json 的未知字段错误中取出字段名。
func unknownJSONField(err error) (string, bool) {
	const prefix = `json: unknown field "`
	msg := err.Error()
	if !strings.HasPrefix(msg, prefix) || !strings.HasSuffix(msg, `"`) {
		return "", false
	}
	return msg[len(prefix) : len(msg)-1], true
}

// WriteError 把错误转换为统一失败响应。
func WriteError(c *gin.Context, err error) {
	var herr *Error
	if errors.As(err, &herr) {
		Fail(c, herr.Status, herr.Msg)
		return
	}
	var verr *ValidationError
	if errors.As(err, &verr) {
		Fail(c, 400, verr.Join())
		return
	}
	log.Printf("unhandled error: %v", err)
	Fail(c, 500, "Internal server error")
}

// AsError 尝试把任意错误转为 *Error，便于测试。
func AsError(err error) (*Error, bool) {
	var herr *Error
	ok := errors.As(err, &herr)
	return herr, ok
}

// Sprintf 便捷格式化（用于构造动态消息）。
func Sprintf(format string, args ...any) string { return fmt.Sprintf(format, args...) }
