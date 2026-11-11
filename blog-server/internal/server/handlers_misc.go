package server

import (
	"regexp"

	"github.com/gin-gonic/gin"

	"blog-server/internal/httpx"
	"blog-server/internal/service"
)

var whitespaceRe = regexp.MustCompile(`\s+`)

type tagRequest struct {
	Name *string `json:"name"`
}

// validateTagName 校验并规范化主标签名：去首尾空白、去所有内部空白。
func validateTagName(raw *string) (string, error) {
	name, issue := requiredString(raw, "name", "标签名不能为空", 32, "标签名最多 32 个字符")
	if err := issuesError(oneIssue(issue)); err != nil {
		return "", err
	}
	name = whitespaceRe.ReplaceAllString(name, "")
	if name == "" {
		return "", httpx.Validation(httpx.Issue{Path: "name", Message: "标签名不能为空"})
	}
	return name, nil
}

// listTags 主标签库列表（含文章数）。
func (a *App) listTags(c *gin.Context) error {
	tags, err := service.ListTags(a.DB)
	if err != nil {
		return err
	}
	httpx.Success(c, tags)
	return nil
}

// createTag 新增主标签。
func (a *App) createTag(c *gin.Context) error {
	var req tagRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		return err
	}
	name, err := validateTagName(req.Name)
	if err != nil {
		return err
	}
	item, err := service.CreateTag(a.DB, name)
	if err != nil {
		return err
	}
	httpx.SuccessMsg(c, 201, "Tag created", item)
	return nil
}

// updateTag 修改主标签名称。
func (a *App) updateTag(c *gin.Context) error {
	var req tagRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		return err
	}
	name, err := validateTagName(req.Name)
	if err != nil {
		return err
	}
	item, err := service.RenameTag(a.DB, c.Param("id"), name)
	if err != nil {
		return err
	}
	httpx.SuccessMsg(c, 200, "Tag updated", item)
	return nil
}

// deleteTag 删除未被引用的主标签。
func (a *App) deleteTag(c *gin.Context) error {
	data, err := service.DeleteTag(a.DB, c.Param("id"))
	if err != nil {
		return err
	}
	httpx.SuccessMsg(c, 200, "Tag deleted", data)
	return nil
}
