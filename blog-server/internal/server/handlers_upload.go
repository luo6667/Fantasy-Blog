package server

import (
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"blog-server/internal/httpx"
)

// mimeExt 是允许的图片类型与存盘扩展名（与旧版一致）。
var mimeExt = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

// sniffImage 基于 magic bytes 检测图片类型。
func sniffImage(buf []byte) string {
	if len(buf) >= 3 && buf[0] == 0xff && buf[1] == 0xd8 && buf[2] == 0xff {
		return "image/jpeg"
	}
	if len(buf) >= 8 && buf[0] == 0x89 && buf[1] == 0x50 && buf[2] == 0x4e && buf[3] == 0x47 &&
		buf[4] == 0x0d && buf[5] == 0x0a && buf[6] == 0x1a && buf[7] == 0x0a {
		return "image/png"
	}
	if len(buf) >= 12 && string(buf[0:4]) == "RIFF" && string(buf[8:12]) == "WEBP" {
		return "image/webp"
	}
	if len(buf) >= 6 {
		head := string(buf[0:6])
		if head == "GIF87a" || head == "GIF89a" {
			return "image/gif"
		}
	}
	return ""
}

// uploadImage 上传图片（multipart 字段名 image）。
func (a *App) uploadImage(c *gin.Context) error {
	file, err := c.FormFile("image")
	if err != nil {
		if errors.Is(err, http.ErrMissingFile) {
			return httpx.BadRequest("No file uploaded")
		}
		if strings.Contains(err.Error(), "request body too large") {
			return httpx.NewError(413, "File too large")
		}
		return httpx.BadRequest("No file uploaded")
	}
	if file.Size > a.Cfg.UploadMaxSize {
		return httpx.NewError(413, "File too large")
	}

	src, err := file.Open()
	if err != nil {
		return err
	}
	defer src.Close()
	buf, err := io.ReadAll(io.LimitReader(src, a.Cfg.UploadMaxSize+1))
	if err != nil {
		return err
	}
	if int64(len(buf)) > a.Cfg.UploadMaxSize {
		return httpx.NewError(413, "File too large")
	}

	detected := sniffImage(buf)
	if detected == "" {
		return httpx.BadRequest("无法识别文件内容，仅支持 JPEG/PNG/WebP/GIF 图片")
	}
	declared := file.Header.Get("Content-Type")
	if detected != declared {
		return httpx.BadRequest("文件内容与声明类型不符")
	}

	if err := os.MkdirAll(a.Cfg.UploadDirAbs, 0o755); err != nil {
		return err
	}
	id := make([]byte, 16)
	if _, err := rand.Read(id); err != nil {
		return err
	}
	filename := fmt.Sprintf("%d-%s%s", time.Now().UnixMilli(), formatUUID(id), mimeExt[detected])
	if err := os.WriteFile(filepath.Join(a.Cfg.UploadDirAbs, filename), buf, 0o644); err != nil {
		return err
	}

	httpx.SuccessMsg(c, 201, "Uploaded successfully", gin.H{
		"url":      "/uploads/" + filename,
		"filename": filename,
		"size":     len(buf),
		"mimetype": detected,
	})
	return nil
}

// formatUUID 输出 8-4-4-4-12 的标准 UUID 字符串（与 randomUUID 一致）。
func formatUUID(b []byte) string {
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
