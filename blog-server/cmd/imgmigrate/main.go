// Command imgmigrate 把存量文章里的 PNG / JPEG 图片迁移到 WebP。
//
// 迁移必须同时做完三件事，少任何一件都不会变快：
//  1. 为大图生成 <stem>.webp 主图与 -480 / -960 变体（参数与上传接口完全一致）；
//  2. 把正文 Markdown 里的 /uploads/xxx.png 改写成
//     /uploads/xxx.webp?optimized=1&w=<宽>&h=<高> ——
//     enhanceImage 靠 optimized=1 判断是否注入 srcset 与 width/height，漏了它等于白转；
//  3. 重新渲染并回写 contentHtml —— 详情接口直接读这一列，不改就是旧 HTML。
//
// 默认是 dry-run：只解码、只在内存里编码算体积，既不写文件也不碰数据库。
// 加 -apply 才真正落盘，且会先把原文备份成 JSON，可用 -restore 回滚。
//
// 典型用法（在服务器上，先 source 后端的环境变量文件）：
//
//	set -a; . /path/to/backend.env; set +a
//	./imgmigrate                 # 预览：哪篇文章、哪张图、从多少 KB 降到多少 KB
//	./imgmigrate -apply          # 执行
//	./imgmigrate -restore backups/images-migration-20261123-223000.json
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"blog-server/internal/config"
	"blog-server/internal/database"
	"blog-server/internal/imgproc"
	"blog-server/internal/model"
	"blog-server/internal/service"

	"gorm.io/gorm"
)

// uploadPathRe 匹配正文里的图片路径。
//
// 分组：1=协议与主机（可空，站内相对路径时为空）、2=文件名主体、3=扩展名、4=原有查询串。
// 匹配的是「路径」而不是整个 URL 结构，所以 Markdown 链接、HTML img、裸 URL 三种写法都能命中；
// 扩展名限定 png/jpg/jpeg，已经迁好的 .webp 天然不会被重复处理（幂等）。
var uploadPathRe = regexp.MustCompile(
	`(?i)(https?://[A-Za-z0-9.:-]+)?/uploads/([A-Za-z0-9._-]+)\.(png|jpe?g)(\?[^\s"'<>()]*)?`,
)

type jobStatus int

const (
	statusConvert jobStatus = iota // 需要生成 webp
	statusReuse                    // 磁盘上已有 webp，只需改写正文
	statusSkip                     // 不处理
)

// imageJob 是一张图片的迁移计划。
type imageJob struct {
	Name     string // 例：1795440831644-x.png
	Stem     string
	Ext      string
	SrcBytes int64
	DstBytes int64
	Width    int
	Height   int
	Status   jobStatus
	Reason   string
}

type articleChange struct {
	ID         string
	Title      string
	OldContent string
	NewContent string
	NewHTML    string
	Jobs       []*imageJob
}

type migrator struct {
	db        *gorm.DB
	uploadDir string
	minBytes  int64
	all       bool
	// cache 按文件名缓存处理结果：同一张图被多篇文章引用时只解码一次。
	// 存的是值拷贝而不是指针，避免多篇文章共享同一个 job 导致统计重复计数。
	cache map[string]*imageJob
}

func main() {
	// .env 存在时先加载，让下面的默认值能取到部署环境里的值；没有也不报错。
	_, _, _ = config.LoadDotEnv()

	minKB := flag.Int("min-kb", 200, "只处理大于该体积（KB）的原图；小于它的收益太低")
	all := flag.Bool("all", false, "无视 -min-kb，处理所有 PNG/JPEG")
	apply := flag.Bool("apply", false, "真正执行：写文件 + 备份 + 更新数据库（默认只预览）")
	articleID := flag.String("article", "", "只处理指定文章 ID")
	backupDir := flag.String("backup-dir", "backups", "备份文件输出目录")
	revalidate := flag.Bool("revalidate", true, "执行后触发 Next.js 页面重建")
	uploadDir := flag.String("upload-dir", env("UPLOAD_DIR", "uploads"), "图片所在目录")
	restore := flag.String("restore", "", "从备份 JSON 回滚正文（只回滚数据库，不动图片文件）")

	mysqlHost := flag.String("mysql-host", env("MYSQL_HOST", "127.0.0.1"), "MySQL 主机")
	mysqlPort := flag.Int("mysql-port", envInt("MYSQL_PORT", 3306), "MySQL 端口")
	mysqlUser := flag.String("mysql-user", env("MYSQL_USER", "root"), "MySQL 用户")
	mysqlPass := flag.String("mysql-password", os.Getenv("MYSQL_PASSWORD"), "MySQL 密码")
	mysqlDB := flag.String("mysql-database", env("MYSQL_DATABASE", "jianli"), "MySQL 库名")
	flag.Parse()

	cfg := &config.Config{
		MySQLHost:         *mysqlHost,
		MySQLPort:         *mysqlPort,
		MySQLUser:         *mysqlUser,
		MySQLPass:         *mysqlPass,
		MySQLDB:           *mysqlDB,
		UploadDir:         *uploadDir,
		NextRevalidateURL: os.Getenv("NEXT_REVALIDATE_URL"),
		RevalidateSecret:  os.Getenv("REVALIDATE_SECRET"),
	}

	db, err := database.Open(cfg)
	if err != nil {
		fail("连接数据库失败: %v", err)
	}

	if *restore != "" {
		if err := runRestore(db, cfg, *restore, *revalidate); err != nil {
			fail("回滚失败: %v", err)
		}
		return
	}

	abs, err := filepath.Abs(*uploadDir)
	if err != nil {
		fail("解析图片目录失败: %v", err)
	}
	if info, err := os.Stat(abs); err != nil || !info.IsDir() {
		fail("图片目录不存在: %s（用 -upload-dir 指定，或先 source 后端环境变量）", abs)
	}

	m := &migrator{
		db:        db,
		uploadDir: abs,
		minBytes:  int64(*minKB) * 1024,
		all:       *all,
	}

	changes, err := m.plan(*articleID)
	if err != nil {
		fail("扫描失败: %v", err)
	}
	m.report(changes)

	if len(changes) == 0 {
		fmt.Println("\n没有需要改写的文章。")
		return
	}
	if !*apply {
		fmt.Println("\n以上为 dry-run，未改动任何文件与数据库。确认无误后加 -apply 执行。")
		return
	}

	backupPath, err := m.saveBackup(*backupDir, changes)
	if err != nil {
		fail("写备份失败: %v", err)
	}
	fmt.Printf("\n已备份原文: %s\n", backupPath)

	if err := m.apply(changes); err != nil {
		fail("更新失败（备份已保留，可用 -restore 回滚）: %v", err)
	}
	if *revalidate {
		service.Revalidate(cfg, []string{"/blog", "/blog/[id]"})
		fmt.Println("已触发页面重建。")
	}
}

// plan 扫描文章，生成每篇文章的改写计划。
func (m *migrator) plan(onlyID string) ([]*articleChange, error) {
	var rows []struct {
		ID      string
		Title   string
		Content string
	}
	q := m.db.Table("articles").Select("id, title, content").Order("createdAt asc")
	if onlyID != "" {
		q = q.Where("id = ?", onlyID)
	}
	if err := q.Scan(&rows).Error; err != nil {
		return nil, err
	}

	changes := make([]*articleChange, 0, len(rows))
	for _, row := range rows {
		matches := uploadPathRe.FindAllStringSubmatch(row.Content, -1)
		if len(matches) == 0 {
			continue
		}

		// 同一张图可能在一篇文章里出现多次，按文件名去重，只解码一次。
		jobs := make(map[string]*imageJob, len(matches))
		order := make([]string, 0, len(matches))
		for _, sub := range matches {
			name := sub[2] + "." + strings.ToLower(sub[3])
			if _, seen := jobs[name]; seen {
				continue
			}
			jobs[name] = m.prepare(sub[2], sub[3])
			order = append(order, name)
		}

		newContent := m.rewrite(row.Content, jobs)
		if newContent == row.Content {
			continue
		}
		newHTML, err := service.RenderMarkdown(newContent)
		if err != nil {
			fmt.Printf("! 跳过《%s》：重新渲染失败 %v\n", row.Title, err)
			continue
		}

		change := &articleChange{
			ID:         row.ID,
			Title:      row.Title,
			OldContent: row.Content,
			NewContent: newContent,
			NewHTML:    newHTML,
		}
		for _, name := range order {
			change.Jobs = append(change.Jobs, jobs[name])
		}
		changes = append(changes, change)
	}
	return changes, nil
}

// prepare 决定一张图的处理方式：转换 / 复用已有 webp / 跳过。
func (m *migrator) prepare(stem, ext string) *imageJob {
	ext = strings.ToLower(ext)
	name := stem + "." + ext
	if cached, ok := m.cache[name]; ok {
		clone := *cached
		return &clone
	}
	job := m.inspect(stem, ext)
	if m.cache == nil {
		m.cache = make(map[string]*imageJob, 8)
	}
	m.cache[name] = job
	return job
}

func (m *migrator) inspect(stem, ext string) *imageJob {
	job := &imageJob{Name: stem + "." + ext, Stem: stem, Ext: ext}

	webpPath := filepath.Join(m.uploadDir, stem+".webp")
	if info, err := os.Stat(webpPath); err == nil && !info.IsDir() {
		job.Status = statusReuse
		job.DstBytes = info.Size()
		buf, readErr := os.ReadFile(webpPath)
		img, decErr := imgproc.Decode(buf, "image/webp")
		if readErr != nil || decErr != nil {
			job.Status = statusSkip
			job.Reason = "已有 webp 但无法解码"
			return job
		}
		job.Width, job.Height = img.Bounds().Dx(), img.Bounds().Dy()
		if src, statErr := os.Stat(filepath.Join(m.uploadDir, job.Name)); statErr == nil {
			job.SrcBytes = src.Size()
		}
		return job
	}

	srcPath := filepath.Join(m.uploadDir, job.Name)
	info, err := os.Stat(srcPath)
	if err != nil || info.IsDir() {
		job.Status = statusSkip
		job.Reason = "源文件不存在"
		return job
	}
	job.SrcBytes = info.Size()
	if !m.all && job.SrcBytes < m.minBytes {
		job.Status = statusSkip
		job.Reason = fmt.Sprintf("小于 %dKB", m.minBytes/1024)
		return job
	}

	buf, err := os.ReadFile(srcPath)
	if err != nil {
		job.Status = statusSkip
		job.Reason = "读取失败"
		return job
	}
	img, err := imgproc.Decode(buf, mimeOf(ext))
	if err != nil {
		job.Status = statusSkip
		job.Reason = "解码失败（格式可能不受支持）"
		return job
	}
	if err := imgproc.ValidateBounds(img.Bounds()); err != nil {
		job.Status = statusSkip
		job.Reason = "尺寸超出上限"
		return job
	}
	job.Width, job.Height = imgproc.MasterSize(img.Bounds())
	size, err := imgproc.EncodeWebPSize(imgproc.Resize(img, job.Width))
	if err != nil {
		job.Status = statusSkip
		job.Reason = "编码失败"
		return job
	}
	job.DstBytes = int64(size)
	job.Status = statusConvert
	return job
}

// rewrite 把正文里的图片路径换成 webp 并补上 optimized 参数。
func (m *migrator) rewrite(content string, jobs map[string]*imageJob) string {
	return uploadPathRe.ReplaceAllStringFunc(content, func(match string) string {
		sub := uploadPathRe.FindStringSubmatch(match)
		if sub == nil {
			return match
		}
		host, stem, ext := sub[1], sub[2], sub[3]
		job := jobs[stem+"."+strings.ToLower(ext)]
		if job == nil || job.Status == statusSkip || job.Width <= 0 {
			return match
		}
		return fmt.Sprintf("%s/uploads/%s.webp?optimized=1&w=%d&h=%d", host, stem, job.Width, job.Height)
	})
}

// report 打印逐篇明细与总体收益。
func (m *migrator) report(changes []*articleChange) {
	var converted, reused, skipped int
	var srcTotal, dstTotal int64

	for _, change := range changes {
		fmt.Printf("\n《%s》\n", change.Title)
		for _, job := range change.Jobs {
			switch job.Status {
			case statusSkip:
				skipped++
				fmt.Printf("  -  %s  跳过：%s\n", job.Name, job.Reason)
			case statusReuse:
				reused++
				fmt.Printf("  =  %s  已有 webp（%s），只改写正文\n", job.Name, human(job.DstBytes))
			case statusConvert:
				converted++
				fmt.Printf("  ✓  %s  %s → %s（省 %s）\n",
					job.Name, human(job.SrcBytes), human(job.DstBytes), percent(job.SrcBytes, job.DstBytes))
			}
			if job.Status != statusSkip {
				srcTotal += job.SrcBytes
				dstTotal += job.DstBytes
			}
		}
	}

	fmt.Println("\n" + strings.Repeat("-", 56))
	fmt.Printf("需转换 %d 张，复用 %d 张，跳过 %d 张，涉及 %d 篇文章\n", converted, reused, skipped, len(changes))
	if srcTotal > 0 {
		fmt.Printf("原图合计 %s → WebP 主图合计 %s（省 %s）\n",
			human(srcTotal), human(dstTotal), percent(srcTotal, dstTotal))
	}
}

// apply 落盘并更新数据库。
func (m *migrator) apply(changes []*articleChange) error {
	written := 0
	for _, change := range changes {
		for _, job := range change.Jobs {
			if job.Status != statusConvert {
				continue
			}
			buf, err := os.ReadFile(filepath.Join(m.uploadDir, job.Name))
			if err != nil {
				return fmt.Errorf("%s: %w", job.Name, err)
			}
			img, err := imgproc.Decode(buf, mimeOf(job.Ext))
			if err != nil {
				return fmt.Errorf("%s: %w", job.Name, err)
			}
			if _, _, _, err := imgproc.StoreImage(m.uploadDir, job.Stem, img); err != nil {
				return fmt.Errorf("%s: %w", job.Name, err)
			}
			written++
		}
	}

	updated := 0
	for _, change := range changes {
		if err := m.db.Model(&model.Article{}).
			Where("id = ?", change.ID).
			UpdateColumns(map[string]any{
				"content":     change.NewContent,
				"contentHtml": change.NewHTML,
			}).Error; err != nil {
			return fmt.Errorf("文章 %s: %w", change.ID, err)
		}
		updated++
	}

	fmt.Printf("已生成 %d 个 WebP 文件，更新 %d 篇文章。\n", written, updated)
	return nil
}

type backupFile struct {
	CreatedAt string          `json:"createdAt"`
	Note      string          `json:"note"`
	Articles  []backupArticle `json:"articles"`
}

type backupArticle struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Content string `json:"content"`
}

func (m *migrator) saveBackup(dir string, changes []*articleChange) (string, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	payload := backupFile{
		CreatedAt: time.Now().Format(time.RFC3339),
		Note:      "imgmigrate 迁移前的文章正文（Markdown）。图片文件本身不会删除，回滚只需恢复这些 content。",
	}
	for _, change := range changes {
		payload.Articles = append(payload.Articles, backupArticle{
			ID:      change.ID,
			Title:   change.Title,
			Content: change.OldContent,
		})
	}
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", err
	}
	path := filepath.Join(dir, "images-migration-"+time.Now().Format("20060102-150405")+".json")
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return "", err
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return path, nil
	}
	return abs, nil
}

// runRestore 把备份里的正文写回去，并重新渲染 contentHtml。
func runRestore(db *gorm.DB, cfg *config.Config, path string, revalidate bool) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var payload backupFile
	if err := json.Unmarshal(data, &payload); err != nil {
		return err
	}
	if len(payload.Articles) == 0 {
		return fmt.Errorf("备份里没有文章")
	}
	for _, article := range payload.Articles {
		html, err := service.RenderMarkdown(article.Content)
		if err != nil {
			return fmt.Errorf("文章 %s: %w", article.ID, err)
		}
		if err := db.Model(&model.Article{}).
			Where("id = ?", article.ID).
			UpdateColumns(map[string]any{
				"content":     article.Content,
				"contentHtml": html,
			}).Error; err != nil {
			return fmt.Errorf("文章 %s: %w", article.ID, err)
		}
	}
	fmt.Printf("已回滚 %d 篇文章。\n", len(payload.Articles))
	if revalidate {
		service.Revalidate(cfg, []string{"/blog", "/blog/[id]"})
		fmt.Println("已触发页面重建。")
	}
	return nil
}

func mimeOf(ext string) string {
	switch strings.ToLower(ext) {
	case "png":
		return "image/png"
	case "jpg", "jpeg":
		return "image/jpeg"
	}
	return ""
}

func human(bytes int64) string {
	switch {
	case bytes >= 1024*1024:
		return strconv.FormatFloat(float64(bytes)/(1024*1024), 'f', 2, 64) + " MB"
	case bytes >= 1024:
		return strconv.FormatInt(bytes/1024, 10) + " KB"
	default:
		return strconv.FormatInt(bytes, 10) + " B"
	}
}

func percent(before, after int64) string {
	if before <= 0 {
		return "-"
	}
	return strconv.FormatFloat((1-float64(after)/float64(before))*100, 'f', 0, 64) + "%"
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "imgmigrate: "+format+"\n", args...)
	os.Exit(1)
}
