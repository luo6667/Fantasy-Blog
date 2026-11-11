package migrate

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

// TagMapVersion 是与标签映射审批绑定的迁移版本。
const TagMapVersion = "0001_blog_redesign"

const createApprovalsTable = "CREATE TABLE IF NOT EXISTS `migration_approvals` (" +
	"`version` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL," +
	"`approvedBy` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL," +
	"`approvedAt` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL," +
	"`checksum` char(64) COLLATE utf8mb4_unicode_ci NOT NULL," +
	"`sourceDigest` char(64) COLLATE utf8mb4_unicode_ci NOT NULL," +
	"`appliedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP," +
	"PRIMARY KEY (`version`)" +
	") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"

const createTagMapTable = "CREATE TABLE IF NOT EXISTS `tmp_tag_map` (" +
	"`articleId` VARCHAR(24) COLLATE utf8mb4_unicode_ci NOT NULL," +
	"`primaryName` VARCHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL," +
	"`subTags` JSON NOT NULL," +
	"PRIMARY KEY (`articleId`)" +
	") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"

// TagMapArticle 是映射文件中的单篇文章。
type TagMapArticle struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	LegacyTags  []string `json:"legacyTags"`
	PrimaryName string   `json:"primaryName"`
	SubTags     []string `json:"subTags"`
}

// TagMapFile 是可在仓库外编辑、审核的标签映射文件。
//
// 导出后由站长修改 primaryName / subTags，并填写 approvedBy / approvedAt；
// 只有通过 verify 的文件才能被 migrate-tags apply 接受。
type TagMapFile struct {
	Version      int             `json:"version"`
	SourceDigest string          `json:"sourceDigest"`
	Articles     []TagMapArticle `json:"articles"`
	ApprovedBy   string          `json:"approvedBy"`
	ApprovedAt   string          `json:"approvedAt"`
}

// legacyTagsColumn 判断库里是否仍是旧结构（articles.tags 数组）。
func legacyTagsColumn(db *gorm.DB) (bool, error) {
	var count int64
	err := db.Raw("SELECT COUNT(*) FROM information_schema.columns " +
		"WHERE table_schema = DATABASE() AND table_name = 'articles' AND column_name = 'tags'").
		Scan(&count).Error
	return count > 0, err
}

// SourceDigest 计算当前旧版标签数据的摘要（按 articleId 排序）。
func SourceDigest(db *gorm.DB) (string, error) {
	rows, err := legacyRows(db)
	if err != nil {
		return "", err
	}
	h := sha256.New()
	for _, r := range rows {
		h.Write([]byte(r.id))
		h.Write([]byte{'\t'})
		h.Write([]byte(r.tags))
		h.Write([]byte{'\n'})
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

type legacyRow struct {
	id    string
	title string
	tags  string
}

func legacyRows(db *gorm.DB) ([]legacyRow, error) {
	var raw []struct {
		ID    string         `gorm:"column:id"`
		Title string         `gorm:"column:title"`
		Tags  sql.NullString `gorm:"column:tags"`
	}
	if err := db.Raw("SELECT `id`, `title`, `tags` FROM `articles` ORDER BY `id` ASC").Scan(&raw).Error; err != nil {
		return nil, err
	}
	out := make([]legacyRow, 0, len(raw))
	for _, r := range raw {
		tags := "[]"
		if r.Tags.Valid && strings.TrimSpace(r.Tags.String) != "" {
			tags = compactJSON(r.Tags.String)
		}
		out = append(out, legacyRow{id: r.ID, title: r.Title, tags: tags})
	}
	return out, nil
}

func compactJSON(s string) string {
	var buf strings.Builder
	dec := json.NewDecoder(strings.NewReader(s))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return strings.TrimSpace(s)
	}
	encoded, err := json.Marshal(v)
	if err != nil {
		return strings.TrimSpace(s)
	}
	buf.Write(encoded)
	return buf.String()
}

// ExportTagMap 从旧结构导出逐篇映射，默认值可直接作为审核起点。
func ExportTagMap(db *gorm.DB) (*TagMapFile, error) {
	ok, err := legacyTagsColumn(db)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, errors.New("当前库已是主标签结构（articles.tags 不存在），无需再导出映射")
	}
	rows, err := legacyRows(db)
	if err != nil {
		return nil, err
	}
	items := make([]TagMapArticle, 0, len(rows))
	for _, r := range rows {
		var legacy []string
		_ = json.Unmarshal([]byte(r.tags), &legacy)
		primary, subs := splitLegacyTags(legacy)
		items = append(items, TagMapArticle{
			ID:          r.id,
			Title:       r.title,
			LegacyTags:  legacy,
			PrimaryName: primary,
			SubTags:     subs,
		})
	}
	digest, err := SourceDigest(db)
	if err != nil {
		return nil, err
	}
	return &TagMapFile{Version: 1, SourceDigest: digest, Articles: items}, nil
}

// splitLegacyTags 把旧标签数组拆成主标签与规范化后的子标签。
func splitLegacyTags(tags []string) (string, []string) {
	clean := make([]string, 0, len(tags))
	for _, t := range tags {
		if v := strings.TrimSpace(t); v != "" {
			clean = append(clean, v)
		}
	}
	primary := "未分类"
	var subs []string
	if len(clean) > 0 {
		primary = truncateRunes(clean[0], 64)
		subs = append(subs, clean[1:]...)
	}
	return primary, NormalizeSubTags(subs)
}

func truncateRunes(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max])
}

// NormalizeSubTags 去空白、去空串、去重并保持首次出现顺序。
func NormalizeSubTags(tags []string) []string {
	seen := make(map[string]struct{}, len(tags))
	out := make([]string, 0, len(tags))
	for _, t := range tags {
		v := strings.TrimSpace(t)
		if v == "" || len([]rune(v)) > 64 {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}

// ValidateTagMap 校验映射文件：来源未变、逐篇覆盖、字段合法、已审批。
func ValidateTagMap(db *gorm.DB, f *TagMapFile) []string {
	var problems []string
	if f.Version != 1 {
		problems = append(problems, fmt.Sprintf("version 必须为 1，当前为 %d", f.Version))
	}
	if strings.TrimSpace(f.ApprovedBy) == "" {
		problems = append(problems, "approvedBy 为空：需要填写审核人")
	}
	if _, err := time.Parse(time.RFC3339, strings.TrimSpace(f.ApprovedAt)); err != nil {
		problems = append(problems, "approvedAt 必须是 RFC3339 时间，例如 2026-11-12T10:00:00+08:00")
	}
	digest, err := SourceDigest(db)
	if err != nil {
		problems = append(problems, "无法读取当前标签数据："+err.Error())
		return problems
	}
	if f.SourceDigest != digest {
		problems = append(problems, "sourceDigest 与当前数据库不一致：导出后数据又变了，请重新导出")
	}

	rows, err := legacyRows(db)
	if err != nil {
		problems = append(problems, "无法读取文章列表："+err.Error())
		return problems
	}
	want := make(map[string]struct{}, len(rows))
	for _, r := range rows {
		want[r.id] = struct{}{}
	}
	seen := make(map[string]struct{}, len(f.Articles))
	for i := range f.Articles {
		a := &f.Articles[i]
		if _, ok := seen[a.ID]; ok {
			problems = append(problems, a.ID+" 重复出现")
		}
		seen[a.ID] = struct{}{}
		if _, ok := want[a.ID]; !ok {
			problems = append(problems, a.ID+" 不存在于当前数据库")
		}
		name := strings.TrimSpace(a.PrimaryName)
		if name == "" {
			problems = append(problems, a.ID+" 的主标签为空")
		} else if len([]rune(name)) > 64 {
			problems = append(problems, a.ID+" 的主标签超过 64 字")
		}
		for _, s := range a.SubTags {
			if strings.TrimSpace(s) != s || s == "" {
				problems = append(problems, a.ID+" 的子标签需要 trim 且不能为空："+s)
			}
		}
		if len(NormalizeSubTags(a.SubTags)) != len(a.SubTags) {
			problems = append(problems, a.ID+" 的子标签有重复或超长，需先去重")
		}
	}
	for id := range want {
		if _, ok := seen[id]; !ok {
			problems = append(problems, id+" 未出现在映射文件中")
		}
	}
	sort.Strings(problems)
	return problems
}

// TagMapChecksum 计算审批内容的校验和。
func TagMapChecksum(f *TagMapFile) string {
	articles := append([]TagMapArticle(nil), f.Articles...)
	sort.Slice(articles, func(i, j int) bool { return articles[i].ID < articles[j].ID })
	canonical := struct {
		SourceDigest string          `json:"sourceDigest"`
		Articles     []TagMapArticle `json:"articles"`
	}{SourceDigest: f.SourceDigest, Articles: articles}
	raw, _ := json.Marshal(canonical)
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}

// LoadTagMap 读取映射文件。
func LoadTagMap(path string) (*TagMapFile, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var f TagMapFile
	dec := json.NewDecoder(strings.NewReader(string(raw)))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&f); err != nil {
		return nil, fmt.Errorf("解析 %s: %w", path, err)
	}
	return &f, nil
}

// ApplyTagMap 写入已审批的映射并记录审批信息（必须在 migrate 之前执行）。
func ApplyTagMap(db *gorm.DB, f *TagMapFile) error {
	if problems := ValidateTagMap(db, f); len(problems) > 0 {
		return fmt.Errorf("映射未通过校验：\n- %s", strings.Join(problems, "\n- "))
	}
	if err := db.Exec(createApprovalsTable).Error; err != nil {
		return err
	}
	if err := db.Exec(createTagMapTable).Error; err != nil {
		return err
	}
	return db.Transaction(func(tx *gorm.DB) error {
		for i := range f.Articles {
			a := &f.Articles[i]
			if err := tx.Exec("INSERT INTO `tmp_tag_map` (`articleId`, `primaryName`, `subTags`) VALUES (?, ?, ?) "+
				"ON DUPLICATE KEY UPDATE `primaryName` = VALUES(`primaryName`), `subTags` = VALUES(`subTags`)",
				a.ID, strings.TrimSpace(a.PrimaryName), mustJSON(NormalizeSubTags(a.SubTags))).Error; err != nil {
				return fmt.Errorf("写入 %s: %w", a.ID, err)
			}
		}
		return tx.Exec("INSERT INTO `migration_approvals` "+
			"(`version`, `approvedBy`, `approvedAt`, `checksum`, `sourceDigest`) VALUES (?, ?, ?, ?, ?) "+
			"ON DUPLICATE KEY UPDATE `approvedBy` = VALUES(`approvedBy`), `approvedAt` = VALUES(`approvedAt`), "+
			"`checksum` = VALUES(`checksum`), `sourceDigest` = VALUES(`sourceDigest`), `appliedAt` = CURRENT_TIMESTAMP",
			TagMapVersion, strings.TrimSpace(f.ApprovedBy), strings.TrimSpace(f.ApprovedAt),
			TagMapChecksum(f), f.SourceDigest).Error
	})
}

func mustJSON(v any) string {
	raw, err := json.Marshal(v)
	if err != nil {
		return "[]"
	}
	return string(raw)
}

// requireTagApproval 在旧库有文章时强制要求已审批的标签映射。
func requireTagApproval(db *gorm.DB) error {
	ok, err := legacyTagsColumn(db)
	if err != nil {
		return err
	}
	if !ok {
		return nil
	}
	var articles int64
	if err := db.Raw("SELECT COUNT(*) FROM `articles`").Scan(&articles).Error; err != nil {
		return err
	}
	if articles == 0 {
		return nil
	}
	var row struct {
		SourceDigest string `gorm:"column:sourceDigest"`
	}
	err = db.Table("migration_approvals").Where("version = ?", TagMapVersion).Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("检测到 %d 篇旧文章但标签映射未审批：先执行 `./bin/server migrate-tags export --out tag-map.json`，"+
			"人工核对并填写 approvedBy/approvedAt，再执行 `migrate-tags verify` 与 `migrate-tags apply`", articles)
	}
	if err != nil {
		return err
	}
	digest, err := SourceDigest(db)
	if err != nil {
		return err
	}
	if row.SourceDigest != digest {
		return errors.New("标签映射审批后旧数据又发生变化（sourceDigest 不一致）：请重新导出、审核并 apply")
	}
	return nil
}
