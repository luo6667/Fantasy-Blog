package server

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"blog-server/internal/httpx"
	"blog-server/internal/middleware"
	"blog-server/internal/service"
)

const (
	githubOAuthStateCookie    = "github_oauth_state"
	githubOAuthReturnToCookie = "github_oauth_return_to"
)

type commentRequest struct {
	Content *string `json:"content"`
}

type reactionRequest struct {
	Type *string `json:"type"`
}

func (a *App) listComments(c *gin.Context) error {
	comments, err := service.ListComments(a.DB, c.Param("id"))
	if err != nil {
		return err
	}
	httpx.Success(c, comments)
	return nil
}

func (a *App) listAdminComments(c *gin.Context) error {
	comments, err := service.ListAdminComments(a.DB)
	if err != nil {
		return err
	}
	httpx.Success(c, comments)
	return nil
}

func (a *App) createComment(c *gin.Context) error {
	commenter := middleware.CommenterFrom(c)
	if commenter == nil {
		return httpx.Unauthorized("请先使用 GitHub 登录")
	}
	var req commentRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		return err
	}
	content, issue := requiredString(req.Content, "content", "评论不能为空", 1000, "评论最多 1000 个字符")
	if err := issuesError(oneIssue(issue)); err != nil {
		return err
	}
	comment, err := service.CreateComment(a.DB, c.Param("id"), commenter.ID, content)
	if err != nil {
		return err
	}
	httpx.SuccessMsg(c, http.StatusCreated, "评论已发布", comment)
	return nil
}

func (a *App) deleteComment(c *gin.Context) error {
	commenter := middleware.CommenterFrom(c)
	admin := a.Auth.OptionalAdminFrom(c)
	if commenter == nil && admin == nil {
		return httpx.Unauthorized("请先使用 GitHub 登录")
	}
	commenterID := ""
	if commenter != nil {
		commenterID = commenter.ID
	}
	if err := service.DeleteComment(a.DB, c.Param("id"), commenterID, admin != nil); err != nil {
		return err
	}
	httpx.Success(c, gin.H{"id": c.Param("id")})
	return nil
}

func (a *App) reactions(c *gin.Context) error {
	commenter := middleware.CommenterFrom(c)
	commenterID := ""
	if commenter != nil {
		commenterID = commenter.ID
	}
	result, err := service.GetReactions(a.DB, c.Param("id"), commenterID)
	if err != nil {
		return err
	}
	httpx.Success(c, result)
	return nil
}

func (a *App) setReaction(c *gin.Context) error {
	commenter := middleware.CommenterFrom(c)
	if commenter == nil {
		return httpx.Unauthorized("请先使用 GitHub 登录")
	}
	var req reactionRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		return err
	}
	reaction, issue := requiredString(req.Type, "type", "请选择表情", 16, "表情类型不合法")
	if err := issuesError(oneIssue(issue)); err != nil {
		return err
	}
	result, err := service.SetReaction(a.DB, c.Param("id"), commenter.ID, reaction)
	if err != nil {
		return err
	}
	httpx.Success(c, result)
	return nil
}

func (a *App) removeReaction(c *gin.Context) error {
	commenter := middleware.CommenterFrom(c)
	if commenter == nil {
		return httpx.Unauthorized("请先使用 GitHub 登录")
	}
	result, err := service.RemoveReaction(a.DB, c.Param("id"), commenter.ID)
	if err != nil {
		return err
	}
	httpx.Success(c, result)
	return nil
}

func (a *App) githubMe(c *gin.Context) error {
	commenter := middleware.CommenterFrom(c)
	if commenter == nil {
		return httpx.Unauthorized("请先使用 GitHub 登录")
	}
	httpx.Success(c, commenter)
	return nil
}

func (a *App) githubLogout(c *gin.Context) error {
	middleware.ClearCommentSession(c, a.Cfg.NodeEnv == "production")
	httpx.Success(c, gin.H{"ok": true})
	return nil
}

func (a *App) githubStart(c *gin.Context) error {
	if !a.Cfg.GitHubOAuthEnabled() {
		return httpx.NewError(http.StatusServiceUnavailable, "GitHub 评论登录尚未配置")
	}
	state, err := randomState()
	if err != nil {
		return err
	}
	returnTo := safeReturnTo(c.Query("returnTo"))
	secure := a.Cfg.NodeEnv == "production"
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(githubOAuthStateCookie, state, 600, "/", "", secure, true)
	c.SetCookie(githubOAuthReturnToCookie, returnTo, 600, "/", "", secure, true)

	query := url.Values{
		"client_id":    {a.Cfg.GitHubOAuthClientID},
		"redirect_uri": {a.Cfg.GitHubOAuthRedirectURL},
		"scope":        {"read:user"},
		"state":        {state},
	}
	c.Redirect(http.StatusFound, "https://github.com/login/oauth/authorize?"+query.Encode())
	return nil
}

func (a *App) githubCallback(c *gin.Context) error {
	returnTo := safeReturnTo(cookieValue(c, githubOAuthReturnToCookie))
	clearOAuthCookies(c, a.Cfg.NodeEnv == "production")
	if c.Query("error") != "" {
		c.Redirect(http.StatusFound, returnTo)
		return nil
	}
	stateCookie := cookieValue(c, githubOAuthStateCookie)
	state := c.Query("state")
	if stateCookie == "" || state == "" || subtle.ConstantTimeCompare([]byte(stateCookie), []byte(state)) != 1 {
		return httpx.Unauthorized("GitHub 登录校验失败，请重新尝试")
	}
	code := c.Query("code")
	if code == "" {
		return httpx.BadRequest("GitHub 未返回授权码")
	}
	profile, err := a.fetchGitHubProfile(c.Request.Context(), code)
	if err != nil {
		return err
	}
	commenter, err := service.UpsertGitHubCommenter(a.DB, profile.ID, profile.Login, profile.Name, profile.AvatarURL, profile.ProfileURL)
	if err != nil {
		return err
	}
	token, err := a.CommentAuth.Manager.Sign(commenter.ID, commenter.Login, "commenter")
	if err != nil {
		return err
	}
	middleware.SetCommentSession(c, token, a.Cfg.CommentSessionExpires, a.Cfg.NodeEnv == "production")
	c.Redirect(http.StatusFound, returnTo)
	return nil
}

type githubProfile struct {
	ID         string `json:"id"`
	Login      string `json:"login"`
	Name       string `json:"name"`
	AvatarURL  string `json:"avatar_url"`
	ProfileURL string `json:"html_url"`
}

func (a *App) fetchGitHubProfile(ctx context.Context, code string) (*githubProfile, error) {
	form := url.Values{
		"client_id":     {a.Cfg.GitHubOAuthClientID},
		"client_secret": {a.Cfg.GitHubOAuthClientSecret},
		"code":          {code},
		"redirect_uri":  {a.Cfg.GitHubOAuthRedirectURL},
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://github.com/login/oauth/access_token", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	client := &http.Client{Timeout: 10 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return nil, httpx.NewError(http.StatusBadGateway, "GitHub 登录服务暂时不可用")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, httpx.NewError(http.StatusBadGateway, "GitHub 登录服务返回异常")
	}
	var tokenPayload struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&tokenPayload); err != nil || tokenPayload.AccessToken == "" {
		return nil, httpx.NewError(http.StatusBadGateway, "无法获取 GitHub 登录信息")
	}
	profileRequest, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/user", nil)
	if err != nil {
		return nil, err
	}
	profileRequest.Header.Set("Accept", "application/vnd.github+json")
	profileRequest.Header.Set("Authorization", "Bearer "+tokenPayload.AccessToken)
	profileResponse, err := client.Do(profileRequest)
	if err != nil {
		return nil, httpx.NewError(http.StatusBadGateway, "GitHub 用户信息暂时不可用")
	}
	defer profileResponse.Body.Close()
	if profileResponse.StatusCode != http.StatusOK {
		return nil, httpx.NewError(http.StatusBadGateway, "无法读取 GitHub 用户信息")
	}
	var raw struct {
		ID         json.Number `json:"id"`
		Login      string      `json:"login"`
		Name       string      `json:"name"`
		AvatarURL  string      `json:"avatar_url"`
		ProfileURL string      `json:"html_url"`
	}
	decoder := json.NewDecoder(io.LimitReader(profileResponse.Body, 1<<20))
	decoder.UseNumber()
	if err := decoder.Decode(&raw); err != nil || raw.ID.String() == "" || raw.Login == "" {
		return nil, httpx.NewError(http.StatusBadGateway, "GitHub 用户信息不完整")
	}
	return &githubProfile{ID: raw.ID.String(), Login: raw.Login, Name: raw.Name, AvatarURL: raw.AvatarURL, ProfileURL: raw.ProfileURL}, nil
}

func randomState() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate OAuth state: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func safeReturnTo(raw string) string {
	if strings.HasPrefix(raw, "/blog/") && !strings.HasPrefix(raw, "//") && !strings.Contains(raw, "\\") {
		return raw
	}
	return "/blog"
}

func cookieValue(c *gin.Context, key string) string {
	value, err := c.Cookie(key)
	if err != nil {
		return ""
	}
	return value
}

func clearOAuthCookies(c *gin.Context, secure bool) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(githubOAuthStateCookie, "", -1, "/", "", secure, true)
	c.SetCookie(githubOAuthReturnToCookie, "", -1, "/", "", secure, true)
}
