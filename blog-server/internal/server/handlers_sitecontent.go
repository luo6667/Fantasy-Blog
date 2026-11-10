package server

import (
	"encoding/json"
	"fmt"
	"strings"
	"unicode/utf16"

	"github.com/gin-gonic/gin"

	"blog-server/internal/httpx"
	"blog-server/internal/service"
)

// 站点内容的规范化结构（与旧版 zod schema 一一对应，校验后回写 trim 结果）。

type educationItem struct {
	Year   string `json:"year"`
	Title  string `json:"title"`
	School string `json:"school"`
	Desc   string `json:"desc"`
}

type resumeProjectItem struct {
	Title string   `json:"title"`
	Meta  string   `json:"meta"`
	Desc  []string `json:"desc"`
}

type homeProjectItem struct {
	Name string   `json:"name"`
	Desc string   `json:"desc"`
	Tags []string `json:"tags"`
	Link *string  `json:"link,omitempty"`
}

type planGoal struct {
	Title  string   `json:"title"`
	Desc   string   `json:"desc"`
	Status string   `json:"status"`
	Tags   []string `json:"tags"`
}

type planStage struct {
	Period  string     `json:"period"`
	Title   string     `json:"title"`
	Summary string     `json:"summary"`
	Status  string     `json:"status"`
	Goals   []planGoal `json:"goals"`
}

// zlen 返回 zod 口径的字符串长度。
func zlen(s string) int { return len(utf16.Encode([]rune(s))) }

const defaultTooLong = "String must contain at most %d character(s)"

// validateSiteContent 按 key 校验并规范化 value。
func validateSiteContent(key string, raw json.RawMessage) (json.RawMessage, error) {
	var issues []httpx.Issue
	add := func(index int, msg string) {
		issues = append(issues, httpx.Issue{Path: fmt.Sprintf("%d", index), Message: msg})
	}

	var out any
	switch key {
	case "education":
		var items []educationItem
		if err := json.Unmarshal(raw, &items); err != nil {
			return nil, httpx.BadRequest("Invalid input")
		}
		for i := range items {
			it := &items[i]
			it.Year = strings.TrimSpace(it.Year)
			it.Title = strings.TrimSpace(it.Title)
			it.School = strings.TrimSpace(it.School)
			it.Desc = strings.TrimSpace(it.Desc)
			if it.Year == "" {
				add(i, "年份不能为空")
			} else if zlen(it.Year) > 64 {
				add(i, fmt.Sprintf(defaultTooLong, 64))
			}
			if it.Title == "" {
				add(i, "专业/职位不能为空")
			} else if zlen(it.Title) > 64 {
				add(i, fmt.Sprintf(defaultTooLong, 64))
			}
			if it.School == "" {
				add(i, "学校/公司不能为空")
			} else if zlen(it.School) > 64 {
				add(i, fmt.Sprintf(defaultTooLong, 64))
			}
			if zlen(it.Desc) > 200 {
				add(i, "描述最多 200 字")
			}
		}
		out = items
	case "skills":
		var items []string
		if err := json.Unmarshal(raw, &items); err != nil {
			return nil, httpx.BadRequest("Invalid input")
		}
		for i := range items {
			items[i] = strings.TrimSpace(items[i])
			if items[i] == "" {
				add(i, "String must contain at least 1 character(s)")
			} else if zlen(items[i]) > 500 {
				add(i, "单条技能最多 500 字")
			}
		}
		out = items
	case "resumeProjects":
		var items []resumeProjectItem
		if err := json.Unmarshal(raw, &items); err != nil {
			return nil, httpx.BadRequest("Invalid input")
		}
		for i := range items {
			it := &items[i]
			it.Title = strings.TrimSpace(it.Title)
			it.Meta = strings.TrimSpace(it.Meta)
			if it.Title == "" {
				add(i, "项目名不能为空")
			} else if zlen(it.Title) > 128 {
				add(i, fmt.Sprintf(defaultTooLong, 128))
			}
			if zlen(it.Meta) > 256 {
				add(i, "meta 最多 256 字")
			}
			if len(it.Desc) == 0 {
				add(i, "至少一段描述")
			} else if len(it.Desc) > 50 {
				add(i, "描述最多 50 段")
			}
			for j := range it.Desc {
				it.Desc[j] = strings.TrimSpace(it.Desc[j])
				if it.Desc[j] == "" {
					add(i, "String must contain at least 1 character(s)")
				} else if zlen(it.Desc[j]) > 1000 {
					add(i, "单段描述最多 1000 字")
				}
			}
		}
		out = items
	case "evaluation":
		var s string
		if err := json.Unmarshal(raw, &s); err != nil {
			return nil, httpx.BadRequest("Invalid input")
		}
		s = strings.TrimSpace(s)
		if s == "" {
			return nil, httpx.BadRequest("内容不能为空")
		}
		if zlen(s) > 2000 {
			return nil, httpx.BadRequest("最多 2000 字")
		}
		out = s
	case "homeProjects":
		var items []homeProjectItem
		if err := json.Unmarshal(raw, &items); err != nil {
			return nil, httpx.BadRequest("Invalid input")
		}
		for i := range items {
			it := &items[i]
			it.Name = strings.TrimSpace(it.Name)
			it.Desc = strings.TrimSpace(it.Desc)
			if it.Name == "" {
				add(i, "项目名不能为空")
			} else if zlen(it.Name) > 128 {
				add(i, fmt.Sprintf(defaultTooLong, 128))
			}
			if it.Desc == "" {
				add(i, "描述不能为空")
			} else if zlen(it.Desc) > 500 {
				add(i, "描述最多 500 字")
			}
			if len(it.Tags) > 20 {
				add(i, "最多 20 个标签")
			}
			for j := range it.Tags {
				it.Tags[j] = strings.TrimSpace(it.Tags[j])
				if it.Tags[j] == "" {
					add(i, "String must contain at least 1 character(s)")
				} else if zlen(it.Tags[j]) > 32 {
					add(i, "单个标签最多 32 字")
				}
			}
			if it.Link != nil {
				link := strings.TrimSpace(*it.Link)
				if zlen(link) > 500 {
					add(i, "链接最长 500 字")
				} else if !(link == "" || hasURLPrefix(link)) {
					add(i, "链接需以 http(s):// 或 git@ 开头")
				}
				it.Link = &link
			}
		}
		out = items
	case "plan":
		var items []planStage
		if err := json.Unmarshal(raw, &items); err != nil {
			return nil, httpx.BadRequest("Invalid input")
		}
		if len(items) > 12 {
			return nil, httpx.BadRequest("最多 12 个阶段")
		}
		for i := range items {
			st := &items[i]
			st.Period = strings.TrimSpace(st.Period)
			st.Title = strings.TrimSpace(st.Title)
			st.Summary = strings.TrimSpace(st.Summary)
			if st.Period == "" {
				add(i, "时间段不能为空")
			} else if zlen(st.Period) > 32 {
				add(i, "时间段最多 32 字")
			}
			if st.Title == "" {
				add(i, "阶段标题不能为空")
			} else if zlen(st.Title) > 64 {
				add(i, "阶段标题最多 64 字")
			}
			if zlen(st.Summary) > 200 {
				add(i, "阶段概览最多 200 字")
			}
			if !validPlanStatus(st.Status) {
				add(i, "状态只能是 planned / active / done")
			}
			if len(st.Goals) > 20 {
				add(i, "每个阶段最多 20 个目标")
			}
			for j := range st.Goals {
				g := &st.Goals[j]
				g.Title = strings.TrimSpace(g.Title)
				g.Desc = strings.TrimSpace(g.Desc)
				if g.Title == "" {
					issues = append(issues, httpx.Issue{Path: fmt.Sprintf("plan:%d:%d", i, j), Message: "目标标题不能为空"})
				} else if zlen(g.Title) > 64 {
					issues = append(issues, httpx.Issue{Path: fmt.Sprintf("plan:%d:%d", i, j), Message: "目标标题最多 64 字"})
				}
				if zlen(g.Desc) > 400 {
					issues = append(issues, httpx.Issue{Path: fmt.Sprintf("plan:%d:%d", i, j), Message: "目标描述最多 400 字"})
				}
				if !validPlanStatus(g.Status) {
					issues = append(issues, httpx.Issue{Path: fmt.Sprintf("plan:%d:%d", i, j), Message: "状态只能是 planned / active / done"})
				}
				if len(g.Tags) > 6 {
					issues = append(issues, httpx.Issue{Path: fmt.Sprintf("plan:%d:%d", i, j), Message: "每个目标最多 6 个标签"})
				}
				for k := range g.Tags {
					g.Tags[k] = strings.TrimSpace(g.Tags[k])
					if g.Tags[k] == "" {
						issues = append(issues, httpx.Issue{Path: fmt.Sprintf("plan:%d:%d", i, j), Message: "标签不能为空"})
					} else if zlen(g.Tags[k]) > 24 {
						issues = append(issues, httpx.Issue{Path: fmt.Sprintf("plan:%d:%d", i, j), Message: "单个标签最多 24 字"})
					}
				}
			}
		}
		out = items
	default:
		return nil, httpx.BadRequest("未知的内容类型：" + key)
	}

	if len(issues) > 0 {
		parts := make([]string, 0, len(issues))
		for _, issue := range issues {
			parts = append(parts, formatSiteContentIssue(issue))
		}
		return nil, httpx.BadRequest(strings.Join(parts, "；"))
	}
	return json.Marshal(out)
}

func formatSiteContentIssue(issue httpx.Issue) string {
	if strings.HasPrefix(issue.Path, "plan:") {
		var stage, goal int
		_, _ = fmt.Sscanf(issue.Path, "plan:%d:%d", &stage, &goal)
		return fmt.Sprintf("第 %d 个阶段第 %d 个目标：%s", stage+1, goal+1, issue.Message)
	}
	var idx int
	if _, err := fmt.Sscanf(issue.Path, "%d", &idx); err == nil {
		return fmt.Sprintf("第 %d 项：%s", idx+1, issue.Message)
	}
	return issue.Message
}

func validPlanStatus(s string) bool {
	return s == "planned" || s == "active" || s == "done"
}

func hasURLPrefix(s string) bool {
	lower := strings.ToLower(s)
	return strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") || strings.HasPrefix(s, "git@")
}

type siteContentRequest struct {
	Value json.RawMessage `json:"value"`
}

// listSiteContents 全部站点内容（管理员）。
func (a *App) listSiteContents(c *gin.Context) error {
	items, err := service.ListSiteContents(a.DB)
	if err != nil {
		return err
	}
	httpx.Success(c, items)
	return nil
}

// getSiteContent 单个站点内容（公开）。
func (a *App) getSiteContent(c *gin.Context) error {
	item, err := service.GetSiteContent(a.DB, c.Param("key"))
	if err != nil {
		return err
	}
	httpx.Success(c, item)
	return nil
}

// updateSiteContent 更新站点内容（管理员）。
func (a *App) updateSiteContent(c *gin.Context) error {
	key := c.Param("key")
	if !service.IsSiteContentKey(key) {
		return httpx.BadRequest("未知的内容类型：" + key)
	}
	var req siteContentRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		return err
	}
	value, err := validateSiteContent(key, req.Value)
	if err != nil {
		return err
	}
	item, err := service.UpdateSiteContent(a.DB, key, value)
	if err != nil {
		return err
	}
	httpx.SuccessMsg(c, 200, "Content updated", item)
	return nil
}
