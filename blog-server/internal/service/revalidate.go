package service

import (
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"blog-server/internal/config"
)

// revalidateClient 复用连接；单次请求 5 秒超时（与旧版一致）。
var revalidateClient = &http.Client{Timeout: 5 * time.Second}

// RevalidateHook 由 main 注入，避免 service 依赖进程级配置。
var RevalidateHook func(paths []string)

// triggerRevalidate 异步触发（fire-and-forget），失败不影响业务写入。
func triggerRevalidate(paths []string) {
	if RevalidateHook == nil {
		return
	}
	go RevalidateHook(paths)
}

// Revalidate 请求 Next.js 按需重建静态页。
//
// 两个环境变量缺一即静默跳过；失败只记 warn，绝不阻塞业务写入。
func Revalidate(cfg *config.Config, paths []string) {
	base := strings.TrimSpace(cfg.NextRevalidateURL)
	secret := strings.TrimSpace(cfg.RevalidateSecret)
	if base == "" || secret == "" {
		return
	}
	endpoint := strings.TrimRight(base, "/") + "/api/revalidate"
	for _, p := range paths {
		q := url.Values{}
		q.Set("secret", secret)
		q.Set("path", p)
		req, err := http.NewRequest(http.MethodPost, endpoint+"?"+q.Encode(), nil)
		if err != nil {
			logWarn("revalidate %s: %v", p, err)
			continue
		}
		resp, err := revalidateClient.Do(req)
		if err != nil {
			logWarn("revalidate %s: %v", p, err)
			continue
		}
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		_ = resp.Body.Close()
		if resp.StatusCode >= 400 {
			logWarn("revalidate %s: HTTP %d", p, resp.StatusCode)
		}
	}
}
