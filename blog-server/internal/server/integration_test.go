package server

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"gorm.io/gorm"

	"blog-server/internal/config"
	"blog-server/internal/database"
	"blog-server/internal/migrate"
	"blog-server/internal/model"
	"blog-server/internal/service"
)

const (
	testDB      = "blog_redesign_test"
	testAdmin   = "admin"
	testPass    = "Test@12345"
	testSecret  = "integration-test-secret-0123456789"
	testArticle = "集成测试文章"
)

// testConfig 构造指向独立测试库的配置。
func testConfig(t *testing.T) *config.Config {
	t.Helper()
	pass := os.Getenv("MYSQL_PASSWORD")
	if pass == "" {
		pass = "1234"
	}
	return &config.Config{
		NodeEnv:       "test",
		Port:          0,
		MySQLHost:     "127.0.0.1",
		MySQLPort:     3306,
		MySQLUser:     "root",
		MySQLPass:     pass,
		MySQLDB:       testDB,
		JWTSecret:     testSecret,
		JWTExpires:    time.Hour,
		CORSOrigins:   []string{"http://localhost:3000"},
		UploadDir:     "uploads",
		UploadDirAbs:  t.TempDir(),
		UploadMaxSize: 5 * 1024 * 1024,
	}
}

// resetTestDB 重建空库并跑迁移；MySQL 不可用时跳过。
func resetTestDB(t *testing.T, cfg *config.Config) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/?charset=utf8mb4&parseTime=true",
		cfg.MySQLUser, cfg.MySQLPass, cfg.MySQLHost, cfg.MySQLPort)
	conn, err := sql.Open("mysql", dsn)
	if err != nil {
		t.Skipf("MySQL 不可用：%v", err)
	}
	defer conn.Close()
	if err := conn.Ping(); err != nil {
		t.Skipf("MySQL 不可用：%v", err)
	}
	if _, err := conn.Exec("DROP DATABASE IF EXISTS `" + cfg.MySQLDB + "`"); err != nil {
		t.Fatalf("drop database: %v", err)
	}
	if err := database.EnsureDatabase(cfg); err != nil {
		t.Fatalf("ensure database: %v", err)
	}
	db, err := database.Open(cfg)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if _, err := migrate.Apply(db); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if _, err := service.SeedAdmin(db, testAdmin, testPass); err != nil {
		t.Fatalf("seed admin: %v", err)
	}
	if err := service.SeedSiteContent(db); err != nil {
		t.Fatalf("seed site content: %v", err)
	}
	return db
}

type envelope struct {
	Code int             `json:"code"`
	Msg  string          `json:"msg"`
	Data json.RawMessage `json:"data"`
}

type client struct {
	t     *testing.T
	srv   *httptest.Server
	token string
}

func newClient(t *testing.T, db *gorm.DB) *client {
	t.Helper()
	cfg := testConfig(t)
	app := New(cfg, db)
	return &client{t: t, srv: httptest.NewServer(app.Router())}
}

func (c *client) do(method, path, token string, body any) (int, envelope) {
	c.t.Helper()
	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		raw, err := json.Marshal(body)
		if err != nil {
			c.t.Fatalf("marshal body: %v", err)
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, c.srv.URL+path, reader)
	if err != nil {
		c.t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		c.t.Fatalf("do request: %v", err)
	}
	defer resp.Body.Close()
	var env envelope
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil && resp.StatusCode != http.StatusOK {
		c.t.Fatalf("%s %s: decode response: %v", method, path, err)
	}
	return resp.StatusCode, env
}

// login 返回管理员 token。
func (c *client) login() string {
	c.t.Helper()
	status, env := c.do(http.MethodPost, "/api/auth/login", "", map[string]string{
		"username": testAdmin,
		"password": testPass,
	})
	if status != http.StatusOK || env.Code != 0 {
		c.t.Fatalf("login: status=%d msg=%s", status, env.Msg)
	}
	var data struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(env.Data, &data); err != nil || data.Token == "" {
		c.t.Fatalf("login: bad token payload: %s", string(env.Data))
	}
	return data.Token
}

func TestHealth(t *testing.T) {
	db := resetTestDB(t, testConfig(t))
	c := newClient(t, db)
	defer c.srv.Close()

	status, env := c.do(http.MethodGet, "/api/health", "", nil)
	if status != http.StatusOK || env.Code != 0 {
		t.Fatalf("health: status=%d body=%+v", status, env)
	}
}

func TestRemovedRoutesReturn404(t *testing.T) {
	db := resetTestDB(t, testConfig(t))
	c := newClient(t, db)
	defer c.srv.Close()
	token := c.login()

	cases := []struct{ method, path string }{
		{http.MethodPost, "/api/auth/register"},
		{http.MethodPost, "/api/articles/abc/like"},
		{http.MethodGet, "/api/articles/abc/comments"},
		{http.MethodPost, "/api/comments/abc/replies"},
		{http.MethodGet, "/api/notifications"},
		{http.MethodGet, "/api/notifications/unread-count"},
		{http.MethodGet, "/api/users/manage"},
		{http.MethodGet, "/api/ai/settings"},
		{http.MethodPost, "/api/ai/chat"},
	}
	for _, tc := range cases {
		status, env := c.do(tc.method, tc.path, token, nil)
		if status != http.StatusNotFound || env.Code != http.StatusNotFound {
			t.Errorf("%s %s: status=%d body=%+v，期望 404", tc.method, tc.path, status, env)
		}
		if !strings.HasPrefix(env.Msg, "Route not found: ") {
			t.Errorf("%s %s: msg=%q，期望 Route not found 前缀", tc.method, tc.path, env.Msg)
		}
	}
}

func TestAdminLoginOnly(t *testing.T) {
	db := resetTestDB(t, testConfig(t))
	c := newClient(t, db)
	defer c.srv.Close()

	status, env := c.do(http.MethodPost, "/api/auth/login", "", map[string]string{
		"username": testAdmin,
		"password": "wrong-password",
	})
	if status != http.StatusUnauthorized {
		t.Fatalf("wrong password: status=%d body=%+v", status, env)
	}
	if env.Msg != "管理员账号或密码错误" {
		t.Fatalf("wrong password msg=%q", env.Msg)
	}

	// 旧的 role 字段已不属于登录契约：严格解码应直接拒绝，而不是静默忽略。
	status, env = c.do(http.MethodPost, "/api/auth/login", "", map[string]string{
		"username": testAdmin,
		"password": testPass,
		"role":     "user",
	})
	if status != http.StatusBadRequest {
		t.Fatalf("unknown role field: status=%d body=%+v，期望 400", status, env)
	}
	if !strings.Contains(env.Msg, "未知字段") || !strings.Contains(env.Msg, "role") {
		t.Fatalf("unknown role field msg=%q", env.Msg)
	}

	// 任意未知字段都拒绝。
	status, env = c.do(http.MethodPost, "/api/auth/login", "", map[string]string{
		"username": testAdmin,
		"password": testPass,
		"remember": "1",
	})
	if status != http.StatusBadRequest || !strings.Contains(env.Msg, "remember") {
		t.Fatalf("unknown field: status=%d msg=%q", status, env.Msg)
	}

	token := c.login()
	status, env = c.do(http.MethodGet, "/api/auth/me", token, nil)
	if status != http.StatusOK || env.Code != 0 {
		t.Fatalf("me: status=%d body=%+v", status, env)
	}
	var me service.AuthUser
	if err := json.Unmarshal(env.Data, &me); err != nil || me.Role != "admin" {
		t.Fatalf("me payload: %s", string(env.Data))
	}
}

func TestUnknownFieldsRejected(t *testing.T) {
	db := resetTestDB(t, testConfig(t))
	c := newClient(t, db)
	defer c.srv.Close()
	token := c.login()

	// 写接口同样严格：未知字段不能被静默丢弃。
	status, env := c.do(http.MethodPost, "/api/tags", token, map[string]string{
		"name":  "严格解码标签",
		"color": "red",
	})
	if status != http.StatusBadRequest || !strings.Contains(env.Msg, "color") {
		t.Fatalf("tag unknown field: status=%d msg=%q", status, env.Msg)
	}

	// 已删除的注册路由仍然 404，不受严格解码影响。
	status, env = c.do(http.MethodPost, "/api/auth/register", "", map[string]string{
		"username": "someone",
		"password": "whatever",
	})
	if status != http.StatusNotFound {
		t.Fatalf("register: status=%d body=%+v，期望 404", status, env)
	}
}

func TestPrimaryTagCRUD(t *testing.T) {
	db := resetTestDB(t, testConfig(t))
	c := newClient(t, db)
	defer c.srv.Close()
	token := c.login()

	status, env := c.do(http.MethodPost, "/api/tags", token, map[string]string{"name": "测试标签"})
	if status != http.StatusCreated {
		t.Fatalf("create tag: status=%d body=%+v", status, env)
	}
	var tag model.Tag
	if err := json.Unmarshal(env.Data, &tag); err != nil || tag.ID == "" {
		t.Fatalf("create tag payload: %s", string(env.Data))
	}

	status, env = c.do(http.MethodPost, "/api/tags", token, map[string]string{"name": "测试标签"})
	if status != http.StatusConflict || !strings.Contains(env.Msg, "已存在") {
		t.Fatalf("duplicate tag: status=%d msg=%q", status, env.Msg)
	}

	status, env = c.do(http.MethodPut, "/api/tags/"+tag.ID, token, map[string]string{"name": "重命名标签"})
	if status != http.StatusOK {
		t.Fatalf("rename tag: status=%d body=%+v", status, env)
	}

	status, env = c.do(http.MethodGet, "/api/tags", "", nil)
	if status != http.StatusOK {
		t.Fatalf("list tags: status=%d body=%+v", status, env)
	}
	var tags []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if err := json.Unmarshal(env.Data, &tags); err != nil || len(tags) != 1 || tags[0].Name != "重命名标签" {
		t.Fatalf("list tags payload: %s", string(env.Data))
	}
}

func TestArticlePrimaryAndSubTags(t *testing.T) {
	db := resetTestDB(t, testConfig(t))
	c := newClient(t, db)
	defer c.srv.Close()
	token := c.login()

	// 建两个主标签
	var tagIDs []string
	for _, name := range []string{"主标签甲", "主标签乙"} {
		status, env := c.do(http.MethodPost, "/api/tags", token, map[string]string{"name": name})
		if status != http.StatusCreated {
			t.Fatalf("seed tag %s: status=%d body=%+v", name, status, env)
		}
		var tag model.Tag
		if err := json.Unmarshal(env.Data, &tag); err != nil {
			t.Fatalf("tag payload: %s", string(env.Data))
		}
		tagIDs = append(tagIDs, tag.ID)
	}

	// 缺主标签
	status, env := c.do(http.MethodPost, "/api/articles", token, map[string]any{
		"title": testArticle, "excerpt": "摘要", "content": "# 正文", "subTags": []string{},
	})
	if status != http.StatusBadRequest || !strings.Contains(env.Msg, "请选择主标签") {
		t.Fatalf("missing primary tag: status=%d msg=%q", status, env.Msg)
	}

	// 不存在的主标签
	status, env = c.do(http.MethodPost, "/api/articles", token, map[string]any{
		"title": testArticle, "excerpt": "摘要", "content": "# 正文",
		"primaryTagId": "000000000000000000000000", "subTags": []string{},
	})
	if status != http.StatusBadRequest || !strings.Contains(env.Msg, "请选择有效的主标签") {
		t.Fatalf("invalid primary tag: status=%d msg=%q", status, env.Msg)
	}

	// 子标签去重 + 去空
	status, env = c.do(http.MethodPost, "/api/articles", token, map[string]any{
		"title": testArticle, "excerpt": "摘要", "content": "# 正文",
		"primaryTagId": tagIDs[0],
		"subTags":      []string{"Go", " Go ", "", "  ", "Gin", "Go"},
	})
	if status != http.StatusCreated {
		t.Fatalf("create article: status=%d msg=%q", status, env.Msg)
	}
	var created struct {
		ID         string `json:"id"`
		PrimaryTag struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"primaryTag"`
		SubTags []string `json:"subTags"`
	}
	if err := json.Unmarshal(env.Data, &created); err != nil {
		t.Fatalf("article payload: %s", string(env.Data))
	}
	if created.PrimaryTag.ID != tagIDs[0] {
		t.Fatalf("primaryTag=%+v，期望 id=%s", created.PrimaryTag, tagIDs[0])
	}
	gotSub := strings.Join(created.SubTags, ",")
	if gotSub != "Go,Gin" {
		t.Fatalf("subTags=%v，期望 [Go Gin]", created.SubTags)
	}

	// 按主标签筛选
	status, env = c.do(http.MethodGet, "/api/articles?tag="+created.PrimaryTag.Name, "", nil)
	if status != http.StatusOK {
		t.Fatalf("list by tag: status=%d body=%+v", status, env)
	}
	var page struct {
		Total int `json:"total"`
	}
	if err := json.Unmarshal(env.Data, &page); err != nil || page.Total != 1 {
		t.Fatalf("list by tag payload: %s", string(env.Data))
	}

	status, env = c.do(http.MethodGet, "/api/articles?tag=主标签乙", "", nil)
	if err := json.Unmarshal(env.Data, &page); err != nil || page.Total != 0 {
		t.Fatalf("empty tag filter payload: %s", string(env.Data))
	}

	// 被引用的主标签不能删除
	status, env = c.do(http.MethodDelete, "/api/tags/"+tagIDs[0], token, nil)
	if status != http.StatusConflict || !strings.Contains(env.Msg, "仍有文章") {
		t.Fatalf("delete used tag: status=%d msg=%q", status, env.Msg)
	}

	// 未被引用的主标签可以删除
	status, env = c.do(http.MethodDelete, "/api/tags/"+tagIDs[1], token, nil)
	if status != http.StatusOK {
		t.Fatalf("delete unused tag: status=%d msg=%q", status, env.Msg)
	}

	// 详情带主标签与子标签
	status, env = c.do(http.MethodGet, "/api/articles/"+created.ID, "", nil)
	if status != http.StatusOK {
		t.Fatalf("detail: status=%d body=%+v", status, env)
	}
	if !strings.Contains(string(env.Data), `"subTags":["Go","Gin"]`) {
		t.Fatalf("detail payload 缺少 subTags: %s", string(env.Data))
	}
}

func TestSiteContentPlan(t *testing.T) {
	db := resetTestDB(t, testConfig(t))
	c := newClient(t, db)
	defer c.srv.Close()

	status, env := c.do(http.MethodGet, "/api/site-content/plan", "", nil)
	if status != http.StatusOK || env.Code != 0 {
		t.Fatalf("plan: status=%d body=%+v", status, env)
	}
	var item struct {
		Value []struct {
			Period string `json:"period"`
			Goals  []struct {
				Title string `json:"title"`
			} `json:"goals"`
		} `json:"value"`
	}
	if err := json.Unmarshal(env.Data, &item); err != nil {
		t.Fatalf("plan payload: %s", string(env.Data))
	}
	stages := item.Value
	if len(stages) != 4 {
		t.Fatalf("plan stages=%d，期望 4", len(stages))
	}
	for _, s := range stages {
		if s.Period == "" || len(s.Goals) == 0 {
			t.Fatalf("plan stage 数据不完整: %+v", s)
		}
	}
}
