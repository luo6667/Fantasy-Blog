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

type internshipItem struct {
	Company string   `json:"company"`
	Role    string   `json:"role"`
	Period  string   `json:"period"`
	Desc    []string `json:"desc"`
}

type homeProjectItem struct {
	Name      string   `json:"name"`
	Summary   string   `json:"summary,omitempty"`
	Desc      string   `json:"desc,omitempty"`
	Category  string   `json:"category,omitempty"`
	Year      string   `json:"year,omitempty"`
	Cover     string   `json:"cover,omitempty"`
	CoverAlt  string   `json:"coverAlt,omitempty"`
	Tags      []string `json:"tags"`
	Link      *string  `json:"link,omitempty"`
	LinkLabel string   `json:"linkLabel,omitempty"`
	Featured  bool     `json:"featured"`
	Order     int      `json:"order,omitempty"`
}

type planGoal struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Desc   string `json:"desc"`
	Status string `json:"status"`
}

type planStage struct {
	ID      string     `json:"id"`
	Order   int        `json:"order"`
	Title   string     `json:"title"`
	Summary string     `json:"summary"`
	Goals   []planGoal `json:"goals"`
}

type planContent struct {
	Title   string      `json:"title"`
	Summary string      `json:"summary"`
	Stages  []planStage `json:"stages"`
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
	case "internships":
		var items []internshipItem
		if err := json.Unmarshal(raw, &items); err != nil {
			return nil, httpx.BadRequest("Invalid input")
		}
		for i := range items {
			it := &items[i]
			it.Company = strings.TrimSpace(it.Company)
			it.Role = strings.TrimSpace(it.Role)
			it.Period = strings.TrimSpace(it.Period)
			if it.Company == "" || zlen(it.Company) > 128 {
				add(i, "公司不能为空且最多 128 字")
			}
			if it.Role == "" || zlen(it.Role) > 128 {
				add(i, "岗位不能为空且最多 128 字")
			}
			if it.Period == "" || zlen(it.Period) > 64 {
				add(i, "实习时间不能为空且最多 64 字")
			}
			if len(it.Desc) == 0 || len(it.Desc) > 50 {
				add(i, "职责描述需为 1 到 50 段")
			}
			for j := range it.Desc {
				it.Desc[j] = strings.TrimSpace(it.Desc[j])
				if it.Desc[j] == "" || zlen(it.Desc[j]) > 1000 {
					issues = append(issues, httpx.Issue{Path: fmt.Sprintf("%d", i), Message: "每段职责描述不能为空且最多 1000 字"})
				}
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
		featured := 0
		for i := range items {
			it := &items[i]
			it.Name = strings.TrimSpace(it.Name)
			it.Summary = strings.TrimSpace(it.Summary)
			it.Desc = strings.TrimSpace(it.Desc)
			it.Category = strings.TrimSpace(it.Category)
			it.Year = strings.TrimSpace(it.Year)
			it.Cover = strings.TrimSpace(it.Cover)
			it.CoverAlt = strings.TrimSpace(it.CoverAlt)
			it.LinkLabel = strings.TrimSpace(it.LinkLabel)

			if it.Name == "" {
				add(i, "项目名不能为空")
			} else if zlen(it.Name) > 128 {
				add(i, fmt.Sprintf(defaultTooLong, 128))
			}
			// 旧数据只有 desc：读取时回退为 summary，前端无需感知历史结构。
			if it.Summary == "" && it.Desc != "" {
				it.Summary = it.Desc
			}
			if it.Summary == "" {
				add(i, "项目简介不能为空")
			} else if zlen(it.Summary) > 500 {
				add(i, "项目简介最多 500 字")
			}
			if zlen(it.Category) > 64 {
				add(i, "分类最多 64 字")
			}
			if zlen(it.Year) > 16 {
				add(i, "年份最多 16 字")
			}
			if zlen(it.Cover) > 500 {
				add(i, "封面链接最长 500 字")
			} else if it.Cover != "" && !hasURLPrefix(it.Cover) && !strings.HasPrefix(it.Cover, "/uploads/") {
				add(i, "封面需为 http(s):// 或 /uploads/ 路径")
			}
			if zlen(it.CoverAlt) > 200 {
				add(i, "封面描述最多 200 字")
			}
			if zlen(it.LinkLabel) > 32 {
				add(i, "链接文案最多 32 字")
			}
			if it.Order < 0 {
				it.Order = 0
			} else if it.Order > 9999 {
				add(i, "排序值不能超过 9999")
			}
			if it.Featured {
				featured++
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
		if featured > 4 {
			return nil, httpx.BadRequest("精选项目最多 4 个")
		}
		out = items
	case "plan":
		var content planContent
		if err := json.Unmarshal(raw, &content); err != nil {
			return nil, httpx.BadRequest("Invalid input")
		}
		content.Title = strings.TrimSpace(content.Title)
		content.Summary = strings.TrimSpace(content.Summary)
		if content.Title == "" || zlen(content.Title) > 64 {
			return nil, httpx.BadRequest("总目标标题不能为空且最多 64 字")
		}
		if zlen(content.Summary) > 200 {
			return nil, httpx.BadRequest("总目标简介最多 200 字")
		}
		if len(content.Stages) > 12 {
			return nil, httpx.BadRequest("最多 12 个阶段性目标")
		}
		usedOrders := make(map[int]struct{}, len(content.Stages))
		for i := range content.Stages {
			stage := &content.Stages[i]
			stage.ID = strings.TrimSpace(stage.ID)
			stage.Title = strings.TrimSpace(stage.Title)
			stage.Summary = strings.TrimSpace(stage.Summary)
			if stage.ID == "" || zlen(stage.ID) > 64 {
				add(i, "阶段标识不能为空且最多 64 字")
			}
			if stage.Order == 0 {
				stage.Order = i + 1
			} else if stage.Order < 1 || stage.Order > 9999 {
				add(i, "阶段序号必须在 1 到 9999 之间")
			}
			if _, exists := usedOrders[stage.Order]; exists {
				add(i, "阶段序号不能重复")
			}
			usedOrders[stage.Order] = struct{}{}
			if stage.Title == "" || zlen(stage.Title) > 64 {
				add(i, "阶段标题不能为空且最多 64 字")
			}
			if zlen(stage.Summary) > 200 {
				add(i, "阶段简介最多 200 字")
			}
			if len(stage.Goals) > 20 {
				add(i, "每个阶段最多 20 个子目标")
			}
			for j := range stage.Goals {
				goal := &stage.Goals[j]
				goal.ID = strings.TrimSpace(goal.ID)
				goal.Title = strings.TrimSpace(goal.Title)
				goal.Desc = strings.TrimSpace(goal.Desc)
				if goal.ID == "" || zlen(goal.ID) > 64 {
					issues = append(issues, httpx.Issue{Path: fmt.Sprintf("plan:%d:%d", i, j), Message: "目标标识不能为空且最多 64 字"})
				}
				if goal.Title == "" || zlen(goal.Title) > 64 {
					issues = append(issues, httpx.Issue{Path: fmt.Sprintf("plan:%d:%d", i, j), Message: "目标标题不能为空且最多 64 字"})
				}
				if zlen(goal.Desc) > 400 {
					issues = append(issues, httpx.Issue{Path: fmt.Sprintf("plan:%d:%d", i, j), Message: "目标描述最多 400 字"})
				}
				if !validPlanStatus(goal.Status) {
					issues = append(issues, httpx.Issue{Path: fmt.Sprintf("plan:%d:%d", i, j), Message: "状态只能是 planned / active / done"})
				}
			}
		}
		out = content
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
