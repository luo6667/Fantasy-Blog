// Package imgproc 负责静态图片的转码：统一转 WebP 主图 + 小屏变体。
//
// 上传接口（internal/server/handlers_upload.go）与存量迁移脚本
// （cmd/imgmigrate）共用这里的实现。两处必须产出完全相同的文件名与尺寸，
// 否则正文 srcset 里的 ?w=480 / ?w=960 会指到不存在的变体，静默回退主图。
package imgproc

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"os"
	"path/filepath"

	"github.com/gen2brain/webp"
	"golang.org/x/image/draw"
)

const (
	// MaxPixels 是允许解码的像素上限，避免超大图把进程内存打爆。
	MaxPixels = 24_000_000
	// MasterWidth 是主图最大宽度；原图更窄时保持原宽。
	MasterWidth = 1600
	// Quality 是 WebP 编码质量。
	Quality = 82
)

// VariantWidths 是小屏变体宽度，与正文 srcset 里请求的 ?w= 值一一对应。
var VariantWidths = []int{480, 960}

// IsStatic 报告该 MIME 是否需要转码。
// GIF 保留原格式以保住动画，其余静态图一律转 WebP。
func IsStatic(mimetype string) bool {
	return mimetype != "image/gif"
}

// Decode 解码 PNG / JPEG / WebP；AutoRotate 让带 EXIF 方向的手机照片不会歪。
func Decode(buf []byte, mimetype string) (image.Image, error) {
	if mimetype == "image/webp" {
		return webp.Decode(bytes.NewReader(buf), webp.Options{AutoRotate: true})
	}
	img, _, err := image.Decode(bytes.NewReader(buf))
	return img, err
}

// MasterSize 计算主图尺寸。
//
// 整数运算必须与 Resize 保持一致：正文里的 width/height 属性就是这里的返回值，
// 用浮点四舍五入会和实际文件差一两个像素，浏览器按错的比例预留空间就会出现抖动。
func MasterSize(bounds image.Rectangle) (width, height int) {
	w, h := bounds.Dx(), bounds.Dy()
	if w <= MasterWidth {
		return w, h
	}
	return MasterWidth, h * MasterWidth / w
}

// Resize 把图片等比缩到指定宽度；原图不宽于目标宽度时原样返回。
func Resize(source image.Image, width int) image.Image {
	bounds := source.Bounds()
	if bounds.Dx() <= width {
		return source
	}
	height := bounds.Dy() * width / bounds.Dx()
	resized := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.CatmullRom.Scale(resized, resized.Bounds(), source, bounds, draw.Over, nil)
	return resized
}

// EncodeWebP 把图片编码为 WebP 写入 w。
func EncodeWebP(w io.Writer, source image.Image) error {
	return webp.Encode(w, source, webp.Options{Quality: Quality, Method: 4})
}

// EncodeWebPSize 只编码不落盘，返回字节数。迁移脚本的 dry-run 用它给出真实体积。
func EncodeWebPSize(source image.Image) (int, error) {
	var buf bytes.Buffer
	if err := EncodeWebP(&buf, source); err != nil {
		return 0, err
	}
	return buf.Len(), nil
}

// ValidateBounds 拒绝零尺寸与超大图。
func ValidateBounds(bounds image.Rectangle) error {
	if bounds.Dx() <= 0 || bounds.Dy() <= 0 {
		return errors.New("image dimensions are unsupported")
	}
	if int64(bounds.Dx())*int64(bounds.Dy()) > MaxPixels {
		return errors.New("image dimensions are unsupported")
	}
	return nil
}

// Store 把一张静态图片写成 WebP 主图与各档变体，返回主图文件名与主图尺寸。
//
// 目录里已存在的变体直接覆盖（同 stem 的源图内容不会变）。
func Store(dir, stem, originalExt, mimetype string, buf []byte) (string, int, int, error) {
	if !IsStatic(mimetype) {
		filename := stem + originalExt
		return filename, 0, 0, os.WriteFile(filepath.Join(dir, filename), buf, 0o644)
	}
	source, err := Decode(buf, mimetype)
	if err != nil {
		return "", 0, 0, err
	}
	return StoreImage(dir, stem, source)
}

// StoreImage 用已解码的图片落盘，给不想重复解码的调用方（存量迁移脚本）使用。
func StoreImage(dir, stem string, source image.Image) (string, int, int, error) {
	if err := ValidateBounds(source.Bounds()); err != nil {
		return "", 0, 0, err
	}
	width, height := MasterSize(source.Bounds())
	master := Resize(source, width)
	filename := stem + ".webp"
	if err := writeFile(filepath.Join(dir, filename), master); err != nil {
		return "", 0, 0, err
	}
	if err := StoreVariants(dir, stem, master); err != nil {
		return "", 0, 0, err
	}
	return filename, width, height, nil
}

// StoreVariants 为已经缩好的主图补写小屏变体；主图本身窄于某档时跳过该档。
func StoreVariants(dir, stem string, master image.Image) error {
	for _, width := range VariantWidths {
		if master.Bounds().Dx() <= width {
			continue
		}
		path := filepath.Join(dir, fmt.Sprintf("%s-%d.webp", stem, width))
		if err := writeFile(path, Resize(master, width)); err != nil {
			return err
		}
	}
	return nil
}

func writeFile(path string, source image.Image) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()
	return EncodeWebP(file, source)
}
