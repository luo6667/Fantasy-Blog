package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"blog-server/internal/httpx"
)

const githubUser = "luo6667"
const giteeUser = "fantasyluo66"
const contributionCacheTTL = 6 * time.Hour

type contributionDay struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
	Level int    `json:"level"`
}
type contributionSource struct {
	Status string            `json:"status"`
	Total  int               `json:"total"`
	Days   []contributionDay `json:"days"`
}
type contributionData struct {
	GitHub contributionSource `json:"github"`
	Gitee  contributionSource `json:"gitee"`
}
type contributionCache struct {
	value contributionSource
	at    time.Time
}

var contributionState struct {
	sync.Mutex
	github, gitee contributionCache
	refreshing    bool
	loading       chan struct{}
}
var contributionClient = &http.Client{Timeout: 6 * time.Second}
var giteeDayPattern = regexp.MustCompile(`data-content=\\?'([0-9]+)个贡献：[0-9]{4}-[0-9]{2}-[0-9]{2}\\?'.*?date=\\?'([0-9]{8})\\?'`)

func (a *App) contributions(c *gin.Context) error {
	if cached, exists, fresh := cachedContributions(); exists {
		if !fresh {
			go a.refreshContributions()
		}
		c.Header("Cache-Control", "public, max-age=300")
		httpx.Success(c, cached)
		return nil
	}
	c.Header("Cache-Control", "public, max-age=300")
	httpx.Success(c, a.loadContributions(c.Request.Context()))
	return nil
}

// loadContributions 合并冷启动时的并发请求：只有第一个请求拉取上游，
// 其余请求等待同一次结果，避免同时打满 GitHub/Gitee。
func (a *App) loadContributions(ctx context.Context) contributionData {
	contributionState.Lock()
	if waiting := contributionState.loading; waiting != nil {
		contributionState.Unlock()
		select {
		case <-waiting:
		case <-ctx.Done():
		}
		if data, exists, _ := cachedContributions(); exists {
			return data
		}
		return unavailableContributions()
	}
	done := make(chan struct{})
	contributionState.loading = done
	contributionState.Unlock()

	defer func() {
		contributionState.Lock()
		contributionState.loading = nil
		close(done)
		contributionState.Unlock()
	}()
	return a.fetchContributions(ctx)
}

func unavailableContributions() contributionData {
	return contributionData{
		GitHub: contributionSource{Status: "unavailable"},
		Gitee:  contributionSource{Status: "unavailable"},
	}
}

func (a *App) refreshContributions() {
	contributionState.Lock()
	if contributionState.refreshing {
		contributionState.Unlock()
		return
	}
	contributionState.refreshing = true
	contributionState.Unlock()
	defer func() { contributionState.Lock(); contributionState.refreshing = false; contributionState.Unlock() }()
	ctx, cancel := context.WithTimeout(context.Background(), 7*time.Second)
	defer cancel()
	a.fetchContributions(ctx)
}

func (a *App) fetchContributions(parent context.Context) contributionData {
	ctx, cancel := context.WithTimeout(parent, 7*time.Second)
	defer cancel()
	var wg sync.WaitGroup
	var gh, gt contributionSource
	wg.Add(2)
	go func() { defer wg.Done(); gh = fetchGitHub(ctx, a.Cfg.GitHubToken) }()
	go func() { defer wg.Done(); gt = fetchGitee(ctx) }()
	wg.Wait()
	return contributionData{GitHub: cachedContribution("github", gh), Gitee: cachedContribution("gitee", gt)}
}

func cachedContributions() (contributionData, bool, bool) {
	contributionState.Lock()
	defer contributionState.Unlock()
	if len(contributionState.github.value.Days) == 0 && len(contributionState.gitee.value.Days) == 0 {
		return contributionData{}, false, false
	}
	data := contributionData{GitHub: contributionState.github.value, Gitee: contributionState.gitee.value}
	data.GitHub.Status = "stale"
	data.Gitee.Status = "stale"
	fresh := time.Since(contributionState.github.at) < contributionCacheTTL && time.Since(contributionState.gitee.at) < contributionCacheTTL
	if fresh {
		data.GitHub.Status = "ok"
		data.Gitee.Status = "ok"
	}
	return data, true, fresh
}

func cachedContribution(kind string, fresh contributionSource) contributionSource {
	contributionState.Lock()
	defer contributionState.Unlock()
	cache := &contributionState.github
	if kind == "gitee" {
		cache = &contributionState.gitee
	}
	if fresh.Status == "ok" {
		*cache = contributionCache{value: fresh, at: time.Now()}
		return fresh
	}
	if len(cache.value.Days) > 0 {
		cache.value.Status = "stale"
		return cache.value
	}
	return contributionSource{Status: "unavailable"}
}

func fetchGitHub(ctx context.Context, token string) contributionSource {
	if token == "" {
		return contributionSource{Status: "unavailable"}
	}
	query := fmt.Sprintf(`query { user(login: %q) { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount contributionLevel } } } } } }`, githubUser)
	body, _ := json.Marshal(map[string]string{"query": query})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.github.com/graphql", bytes.NewReader(body))
	if err != nil {
		return contributionSource{Status: "unavailable"}
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	res, err := contributionClient.Do(req)
	if err != nil || res.StatusCode != 200 {
		if res != nil {
			res.Body.Close()
		}
		return contributionSource{Status: "unavailable"}
	}
	defer res.Body.Close()
	var data struct {
		Data struct {
			User struct {
				ContributionsCollection struct {
					ContributionCalendar struct {
						Total int `json:"totalContributions"`
						Weeks []struct {
							Days []struct {
								Date  string
								Count int    `json:"contributionCount"`
								Level string `json:"contributionLevel"`
							} `json:"contributionDays"`
						} `json:"weeks"`
					} `json:"contributionCalendar"`
				} `json:"contributionsCollection"`
			} `json:"user"`
		} `json:"data"`
	}
	if json.NewDecoder(res.Body).Decode(&data) != nil {
		return contributionSource{Status: "unavailable"}
	}
	out := contributionSource{Status: "ok", Total: data.Data.User.ContributionsCollection.ContributionCalendar.Total}
	for _, w := range data.Data.User.ContributionsCollection.ContributionCalendar.Weeks {
		for _, d := range w.Days {
			out.Days = append(out.Days, contributionDay{d.Date, d.Count, map[string]int{"NONE": 0, "FIRST_QUARTILE": 1, "SECOND_QUARTILE": 2, "THIRD_QUARTILE": 3, "FOURTH_QUARTILE": 4}[d.Level]})
		}
	}
	return out
}

func fetchGitee(ctx context.Context) contributionSource {
	year := time.Now().Year()
	all := []contributionDay{}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("https://gitee.com/%s/contribution_calendar?year=%d", giteeUser, year), nil)
	if err != nil {
		return contributionSource{Status: "unavailable"}
	}
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	req.Header.Set("Referer", "https://gitee.com/"+giteeUser)
	res, err := contributionClient.Do(req)
	if err != nil || res.StatusCode != 200 {
		if res != nil {
			res.Body.Close()
		}
		return contributionSource{Status: "unavailable"}
	}
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 2<<20))
	res.Body.Close()
	for _, m := range giteeDayPattern.FindAllStringSubmatch(string(raw), -1) {
		count, _ := strconv.Atoi(m[1])
		date := m[2][:4] + "-" + m[2][4:6] + "-" + m[2][6:]
		all = append(all, contributionDay{Date: date, Count: count})
	}
	sort.Slice(all, func(i, j int) bool { return all[i].Date < all[j].Date })
	if len(all) == 0 {
		return contributionSource{Status: "unavailable"}
	}
	total := 0
	for i := range all {
		total += all[i].Count
		if all[i].Count > 0 {
			all[i].Level = 1
		}
	}
	return contributionSource{Status: "ok", Total: total, Days: all}
}
