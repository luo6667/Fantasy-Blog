package service

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"gorm.io/gorm"

	"blog-server/internal/httpx"
	"blog-server/internal/model"
)

// AISettingsView 是对外暴露的 AI 配置（不含密钥）。
type AISettingsView struct {
	BaseURL string `json:"baseURL"`
	Model   string `json:"model"`
	HasKey  bool   `json:"hasKey"`
}

// AIMessage 是 OpenAI 兼容的对话消息。
type AIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// loadAIConfig 读取唯一一条配置，并在配置了主密钥时把历史明文惰性迁移为密文。
func loadAIConfig(db *gorm.DB, encKey []byte) (*model.AIConfig, error) {
	var cfg model.AIConfig
	err := db.Order("createdAt ASC").Take(&cfg).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if cfg.APIKey != "" && !IsEncryptedSecret(cfg.APIKey) && len(encKey) == 32 {
		if encrypted, encErr := EncryptSecret(encKey, cfg.APIKey); encErr == nil {
			cfg.APIKey = encrypted
			if saveErr := db.Save(&cfg).Error; saveErr != nil {
				logWarn("migrate ai key: %v", saveErr)
			}
		}
	}
	return &cfg, nil
}

// GetAISettings 返回可公开的配置视图。
func GetAISettings(db *gorm.DB, encKey []byte) (*AISettingsView, error) {
	cfg, err := loadAIConfig(db, encKey)
	if err != nil {
		return nil, err
	}
	if cfg == nil {
		return &AISettingsView{}, nil
	}
	return &AISettingsView{BaseURL: cfg.BaseURL, Model: cfg.ModelName, HasKey: cfg.APIKey != ""}, nil
}

// SaveAISettings 保存配置；apiKey 为空表示保留旧值。
func SaveAISettings(db *gorm.DB, encKey []byte, baseURL string, apiKey *string, modelName string) (*AISettingsView, error) {
	cfg, err := loadAIConfig(db, encKey)
	if err != nil {
		return nil, err
	}
	if cfg == nil {
		cfg = &model.AIConfig{ID: NewID(), BaseURL: "", APIKey: "", ModelName: ""}
	}
	cfg.BaseURL = strings.TrimSpace(baseURL)
	cfg.ModelName = strings.TrimSpace(modelName)
	if apiKey != nil {
		if trimmed := strings.TrimSpace(*apiKey); trimmed != "" {
			if len(encKey) == 32 {
				encrypted, encErr := EncryptSecret(encKey, trimmed)
				if encErr != nil {
					return nil, encErr
				}
				cfg.APIKey = encrypted
			} else {
				logWarn("AI_CONFIG_ENC_KEY not configured; storing ai api key as plaintext")
				cfg.APIKey = trimmed
			}
		}
	}
	if err := db.Save(cfg).Error; err != nil {
		return nil, err
	}
	return &AISettingsView{BaseURL: cfg.BaseURL, Model: cfg.ModelName, HasKey: cfg.APIKey != ""}, nil
}

// NormalizeBaseURL 规范化接口地址：去尾部斜杠并补 /chat/completions。
func NormalizeBaseURL(base string) string {
	b := strings.TrimRight(strings.TrimSpace(base), "/")
	if strings.HasSuffix(b, "/chat/completions") {
		return b
	}
	return b + "/chat/completions"
}

// ChatUpstream 打开上游 SSE 流；调用方负责关闭响应体。
func ChatUpstream(db *gorm.DB, encKey []byte, messages []AIMessage) (*http.Response, error) {
	cfg, err := loadAIConfig(db, encKey)
	if err != nil {
		return nil, err
	}
	if cfg == nil || cfg.APIKey == "" {
		return nil, httpx.BadRequest("请先在管理后台「AI 设置」中配置接口地址与密钥")
	}
	apiKey, err := DecryptSecret(encKey, cfg.APIKey)
	if err != nil {
		return nil, err
	}

	body, err := json.Marshal(map[string]any{
		"model":    cfg.ModelName,
		"messages": messages,
		"stream":   true,
	})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPost, NormalizeBaseURL(cfg.BaseURL), strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 || resp.Body == nil {
		text, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		_ = resp.Body.Close()
		return nil, httpx.NewError(502, "上游 AI 服务错误（HTTP "+strconv.Itoa(resp.StatusCode)+"）："+truncate(string(text), 200))
	}
	return resp, nil
}

// MigrateAIKeys 把库中历史的明文 API Key 一次性加密，返回迁移条数。
//
// 用于任务书要求的 `migrate-ai-keys` 子命令；已加密的记录会被跳过，可重复执行。
func MigrateAIKeys(db *gorm.DB, encKey []byte) (int, error) {
	if len(encKey) != 32 {
		return 0, errors.New("AI_CONFIG_ENC_KEY 必须是 base64 编码的 32 字节密钥")
	}
	var rows []model.AIConfig
	if err := db.Order("createdAt ASC").Find(&rows).Error; err != nil {
		return 0, err
	}
	migrated := 0
	for i := range rows {
		key := rows[i].APIKey
		if key == "" || IsEncryptedSecret(key) {
			continue
		}
		encrypted, err := EncryptSecret(encKey, key)
		if err != nil {
			return migrated, err
		}
		if err := db.Model(&model.AIConfig{}).Where("id = ?", rows[i].ID).Update("apiKey", encrypted).Error; err != nil {
			return migrated, err
		}
		migrated++
	}
	return migrated, nil
}

// truncate 按字符截断到 limit 个字符。
func truncate(s string, limit int) string {
	runes := []rune(s)
	if len(runes) <= limit {
		return s
	}
	return string(runes[:limit])
}
