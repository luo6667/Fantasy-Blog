package server

import (
	"bufio"
	"strings"

	"github.com/gin-gonic/gin"

	"blog-server/internal/httpx"
	"blog-server/internal/service"
)

type aiSettingsRequest struct {
	BaseURL *string `json:"baseURL"`
	APIKey  *string `json:"apiKey"`
	Model   *string `json:"model"`
}

type chatRequest struct {
	Messages []service.AIMessage `json:"messages"`
}

// getAISettings 读取 AI 配置（管理员，不含密钥）。
func (a *App) getAISettings(c *gin.Context) error {
	view, err := service.GetAISettings(a.DB, a.encKey())
	if err != nil {
		return err
	}
	httpx.Success(c, view)
	return nil
}

// saveAISettings 保存 AI 配置（管理员）。
func (a *App) saveAISettings(c *gin.Context) error {
	var req aiSettingsRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		return err
	}
	var issues []httpx.Issue
	baseURL, issue := requiredString(req.BaseURL, "baseURL", "接口地址不能为空", 500, "接口地址过长")
	if issue != nil {
		issues = append(issues, *issue)
	}
	model, issue := requiredString(req.Model, "model", "模型名不能为空", 100, "模型名过长")
	if issue != nil {
		issues = append(issues, *issue)
	}
	if req.APIKey != nil && zlen(*req.APIKey) > 500 {
		issues = append(issues, httpx.Issue{Path: "apiKey", Message: "密钥过长"})
	}
	if err := issuesError(issues); err != nil {
		return err
	}
	view, err := service.SaveAISettings(a.DB, a.encKey(), baseURL, req.APIKey, model)
	if err != nil {
		return err
	}
	httpx.SuccessMsg(c, 200, "AI 设置已保存", view)
	return nil
}

// aiChat 流式对话（SSE 透传）。
func (a *App) aiChat(c *gin.Context) error {
	var req chatRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		return err
	}
	var issues []httpx.Issue
	if len(req.Messages) == 0 {
		issues = append(issues, httpx.Issue{Path: "messages", Message: "消息不能为空"})
	} else if len(req.Messages) > 50 {
		issues = append(issues, httpx.Issue{Path: "messages", Message: "消息条数过多"})
	}
	for _, msg := range req.Messages {
		if !(msg.Role == "system" || msg.Role == "user" || msg.Role == "assistant") {
			issues = append(issues, httpx.Issue{Path: "messages", Message: "Invalid enum value. Expected 'system' | 'user' | 'assistant'"})
			break
		}
		if msg.Content == "" {
			issues = append(issues, httpx.Issue{Path: "messages", Message: "消息内容不能为空"})
			break
		}
		if zlen(msg.Content) > 50000 {
			issues = append(issues, httpx.Issue{Path: "messages", Message: "单条消息过长"})
			break
		}
	}
	if err := issuesError(issues); err != nil {
		return err
	}

	resp, err := service.ChatUpstream(a.DB, a.encKey(), req.Messages)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	w := c.Writer
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(200)
	flush := w.Flush

	reader := bufio.NewReader(resp.Body)
	for {
		line, readErr := reader.ReadString('\n')
		if line != "" {
			trimmed := strings.TrimSpace(line)
			if strings.HasPrefix(trimmed, "data:") {
				payload := strings.TrimSpace(strings.TrimPrefix(trimmed, "data:"))
				if payload == "[DONE]" {
					_, _ = w.WriteString("data: [DONE]\n\n")
					flush()
					return nil
				}
				_, _ = w.WriteString("data: " + payload + "\n\n")
				flush()
			}
		}
		if readErr != nil {
			break
		}
		select {
		case <-c.Request.Context().Done():
			return nil
		default:
		}
	}
	_, _ = w.WriteString("data: [DONE]\n\n")
	flush()
	return nil
}
