package main

import (
	"os"
	"path/filepath"
	"testing"

	"blog-server/internal/imgproc"
)

func TestRewrite(t *testing.T) {
	m := &migrator{}
	jobs := map[string]*imageJob{
		"abc.png":  {Stem: "abc", Ext: "png", Status: statusConvert, Width: 1600, Height: 766},
		"skip.jpg": {Stem: "skip", Ext: "jpg", Status: statusSkip},
	}
	cases := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "markdown 相对路径",
			in:   "![架构图](/uploads/abc.png)",
			want: "![架构图](/uploads/abc.webp?optimized=1&w=1600&h=766)",
		},
		{
			name: "HTML img 标签",
			in:   `<img src="/uploads/abc.png" alt="x"/>`,
			want: `<img src="/uploads/abc.webp?optimized=1&w=1600&h=766" alt="x"/>`,
		},
		{
			name: "绝对地址保留主机",
			in:   "https://fantasynote.cloud/uploads/abc.png",
			want: "https://fantasynote.cloud/uploads/abc.webp?optimized=1&w=1600&h=766",
		},
		{
			name: "原有查询串被替换掉",
			in:   "/uploads/abc.png?foo=bar",
			want: "/uploads/abc.webp?optimized=1&w=1600&h=766",
		},
		{
			name: "已迁移的 webp 不重复处理",
			in:   "/uploads/abc.webp?optimized=1&w=1600&h=766",
			want: "/uploads/abc.webp?optimized=1&w=1600&h=766",
		},
		{
			name: "跳过的图片保持原样",
			in:   "/uploads/skip.jpg",
			want: "/uploads/skip.jpg",
		},
		{
			name: "磁盘上不存在的图片保持原样",
			in:   "/uploads/missing.png",
			want: "/uploads/missing.png",
		},
		{
			name: "同一篇里多张图一起换",
			in:   "a ![](/uploads/abc.png) b /uploads/skip.jpg",
			want: "a ![](/uploads/abc.webp?optimized=1&w=1600&h=766) b /uploads/skip.jpg",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := m.rewrite(c.in, jobs); got != c.want {
				t.Fatalf("rewrite(%q)\n got: %s\nwant: %s", c.in, got, c.want)
			}
		})
	}
}

// 用仓库里真实存在的大 PNG 跑一次转换，确认产出与正文引用的尺寸一致。
func TestConvertRealPNG(t *testing.T) {
	const stem = "1794470626669-c28c9d45-5fdd-0e3b-b6a3-682456eb178e"
	dir := filepath.Join("..", "..", "uploads")
	src := filepath.Join(dir, stem+".png")
	if _, err := os.Stat(src); err != nil {
		t.Skip("本地没有大图样本，跳过")
	}

	m := &migrator{uploadDir: dir, minBytes: 200 * 1024}
	job := m.prepare(stem, "png")
	if job.Status != statusConvert {
		t.Fatalf("期望需要转换，实际 status=%d reason=%s", job.Status, job.Reason)
	}
	if job.Width != imgproc.MasterWidth {
		t.Fatalf("主图宽度应为 %d，实际 %d", imgproc.MasterWidth, job.Width)
	}
	if job.DstBytes >= job.SrcBytes {
		t.Fatalf("转换后不应更大: %d -> %d", job.SrcBytes, job.DstBytes)
	}
	t.Logf("%s: %d KB -> %d KB (%dx%d)",
		job.Name, job.SrcBytes/1024, job.DstBytes/1024, job.Width, job.Height)
}

// 转换产物必须能被 /uploads?w=480 的变体逻辑找到：<stem>.webp、<stem>-480.webp、<stem>-960.webp。
func TestStoreImageProducesVariants(t *testing.T) {
	const stem = "1794470626669-c28c9d45-5fdd-0e3b-b6a3-682456eb178e"
	src := filepath.Join("..", "..", "uploads", stem+".png")
	buf, err := os.ReadFile(src)
	if err != nil {
		t.Skip("本地没有大图样本，跳过")
	}
	img, err := imgproc.Decode(buf, "image/png")
	if err != nil {
		t.Fatalf("解码失败: %v", err)
	}

	outDir := t.TempDir()
	name, width, height, err := imgproc.StoreImage(outDir, stem, img)
	if err != nil {
		t.Fatalf("落盘失败: %v", err)
	}
	if name != stem+".webp" {
		t.Fatalf("主图文件名不对: %s", name)
	}
	if width != imgproc.MasterWidth || height <= 0 {
		t.Fatalf("返回尺寸不对: %dx%d", width, height)
	}
	for _, want := range []string{stem + ".webp", stem + "-480.webp", stem + "-960.webp"} {
		info, err := os.Stat(filepath.Join(outDir, want))
		if err != nil {
			t.Fatalf("缺少变体 %s: %v", want, err)
		}
		if info.Size() == 0 {
			t.Fatalf("变体 %s 是空文件", want)
		}
	}
}
