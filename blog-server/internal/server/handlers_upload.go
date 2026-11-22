package server

import (
	"bytes"
	"crypto/rand"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gen2brain/webp"
	"github.com/gin-gonic/gin"
	"golang.org/x/image/draw"

	"blog-server/internal/httpx"
)

const (
	maxImagePixels   = 24_000_000
	masterImageWidth = 1600
)

var imageVariantWidths = []int{480, 960}

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

func decodeStaticImage(buf []byte, mimetype string) (image.Image, error) {
	if mimetype == "image/webp" {
		return webp.Decode(bytes.NewReader(buf), webp.Options{AutoRotate: true})
	}
	img, _, err := image.Decode(bytes.NewReader(buf))
	return img, err
}

func resizeToWidth(source image.Image, width int) image.Image {
	bounds := source.Bounds()
	if bounds.Dx() <= width {
		return source
	}
	height := bounds.Dy() * width / bounds.Dx()
	resized := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.CatmullRom.Scale(resized, resized.Bounds(), source, bounds, draw.Over, nil)
	return resized
}

func writeWebP(path string, source image.Image) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()
	return webp.Encode(file, source, webp.Options{Quality: 82, Method: 4})
}

// storeOptimizedImage 把静态图片转为 WebP 主图，并为正文生成小屏变体；GIF 保持原格式以保留动画。
func storeOptimizedImage(dir, stem, originalExt, mimetype string, buf []byte) (string, int, int, error) {
	if mimetype == "image/gif" {
		filename := stem + originalExt
		return filename, 0, 0, os.WriteFile(filepath.Join(dir, filename), buf, 0o644)
	}
	img, err := decodeStaticImage(buf, mimetype)
	if err != nil {
		return "", 0, 0, err
	}
	bounds := img.Bounds()
	if bounds.Dx() <= 0 || bounds.Dy() <= 0 || int64(bounds.Dx())*int64(bounds.Dy()) > maxImagePixels {
		return "", 0, 0, errors.New("image dimensions are unsupported")
	}
	master := resizeToWidth(img, masterImageWidth)
	filename := stem + ".webp"
	if err := writeWebP(filepath.Join(dir, filename), master); err != nil {
		return "", 0, 0, err
	}
	for _, width := range imageVariantWidths {
		if master.Bounds().Dx() <= width {
			continue
		}
		if err := writeWebP(filepath.Join(dir, fmt.Sprintf("%s-%d.webp", stem, width)), resizeToWidth(master, width)); err != nil {
			return "", 0, 0, err
		}
	}
	return filename, master.Bounds().Dx(), master.Bounds().Dy(), nil
}

// uploadImage 上传图片（multipart 字段名 image）。
func (a *App) uploadImage(c *gin.Context) error {
	// 在 multipart 解析前限制整个请求体，避免超大请求先落临时文件；
	// 额外留 1MB 给边界与表单头，文件本身仍按 UploadMaxSize 校验。
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, a.Cfg.UploadMaxSize+(1<<20))
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
	stem := fmt.Sprintf("%d-%s", time.Now().UnixMilli(), formatUUID(id))
	filename, width, height, err := storeOptimizedImage(a.Cfg.UploadDirAbs, stem, mimeExt[detected], detected, buf)
	if err != nil {
		return err
	}
	url := "/uploads/" + filename
	storedMIME := detected
	if width > 0 && height > 0 {
		url = fmt.Sprintf("%s?optimized=1&w=%d&h=%d", url, width, height)
		storedMIME = "image/webp"
	}

	httpx.SuccessMsg(c, 201, "Uploaded successfully", gin.H{
		"url":      url,
		"filename": filename,
		"size":     len(buf),
		"mimetype": storedMIME,
		"width":    width,
		"height":   height,
	})
	return nil
}

// formatUUID 输出 8-4-4-4-12 的标准 UUID 字符串（与 randomUUID 一致）。
func formatUUID(b []byte) string {
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
