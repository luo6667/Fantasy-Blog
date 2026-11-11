package config

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// LoadDotEnv 把 .env 里的变量载入进程环境，行为与旧 Node 服务的 dotenv 保持一致：
//   - 已存在的环境变量优先，不会被 .env 覆盖；
//   - 找不到文件时静默跳过（生产环境通常由 systemd EnvironmentFile 注入）；
//   - 文件存在但读取失败时返回错误。
//
// 查找顺序：
//  1. 环境变量 ENV_FILE 指定的文件（显式指定，缺失即报错）；
//  2. 当前工作目录的 .env；
//  3. 可执行文件所在模块根目录的 .env（bin/server.exe → 模块根）。
//
// 返回实际加载的文件路径（未加载时为空）与注入的变量数量。
func LoadDotEnv() (string, int, error) {
	path, err := findEnvFile()
	if err != nil {
		return "", 0, err
	}
	if path == "" {
		return "", 0, nil
	}

	file, err := os.Open(path)
	if err != nil {
		return path, 0, fmt.Errorf("open %s: %w", path, err)
	}
	defer file.Close()

	count, err := applyDotEnv(file)
	if err != nil {
		return path, count, fmt.Errorf("parse %s: %w", path, err)
	}
	return path, count, nil
}

// findEnvFile 按约定顺序找到第一个存在的 .env。
func findEnvFile() (string, error) {
	if explicit := strings.TrimSpace(os.Getenv("ENV_FILE")); explicit != "" {
		if _, err := os.Stat(explicit); err != nil {
			return "", fmt.Errorf("ENV_FILE %s: %w", explicit, err)
		}
		return explicit, nil
	}

	for _, candidate := range envFileCandidates() {
		if candidate == "" {
			continue
		}
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate, nil
		}
	}
	return "", nil
}

// envFileCandidates 返回按优先级排列的候选路径。
func envFileCandidates() []string {
	candidates := []string{".env"}
	if root := moduleRoot(); root != "" {
		candidates = append(candidates, filepath.Join(root, ".env"))
	}
	return candidates
}

// moduleRoot 从可执行文件位置向上寻找 go.mod，用来定位模块根目录。
// 通过 `go run` 启动时可执行文件在临时目录，找不到 go.mod，此时退回当前目录。
func moduleRoot() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	dir := filepath.Dir(exe)
	for i := 0; i < 4; i++ {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return ""
}

// applyDotEnv 解析并注入 .env 内容，返回新注入的变量数量。
// 支持 `export KEY=value`、单双引号、未加引号值的行尾注释；格式不合法的行直接跳过。
func applyDotEnv(r io.Reader) (int, error) {
	scanner := bufio.NewScanner(r)
	count := 0
	for scanner.Scan() {
		key, value, ok := parseDotEnvLine(scanner.Text())
		if !ok {
			continue
		}
		if _, exists := os.LookupEnv(key); exists {
			continue
		}
		if err := os.Setenv(key, value); err != nil {
			return count, err
		}
		count++
	}
	return count, scanner.Err()
}

// parseDotEnvLine 解析一行 KEY=VALUE；注释、空行与非赋值行返回 ok=false。
func parseDotEnvLine(line string) (key, value string, ok bool) {
	line = strings.TrimSpace(strings.TrimPrefix(line, "\ufeff"))
	if line == "" || strings.HasPrefix(line, "#") {
		return "", "", false
	}
	line = strings.TrimPrefix(line, "export ")
	line = strings.TrimSpace(line)

	eq := strings.IndexByte(line, '=')
	if eq <= 0 {
		return "", "", false
	}
	key = strings.TrimSpace(line[:eq])
	if key == "" || strings.ContainsAny(key, " \t") {
		return "", "", false
	}

	raw := strings.TrimSpace(line[eq+1:])
	switch {
	case strings.HasPrefix(raw, `"`) && len(raw) >= 2:
		if unquoted, err := strconv.Unquote(raw); err == nil {
			return key, unquoted, true
		}
		value = strings.Trim(raw, `"`)
	case strings.HasPrefix(raw, "'") && len(raw) >= 2:
		if end := strings.LastIndex(raw[1:], "'"); end >= 0 {
			value = raw[1 : end+1]
		} else {
			value = raw[1:]
		}
	default:
		// 未加引号时，` #` 之后视为注释（与 dotenv 一致），值内的 # 保留。
		if idx := strings.Index(raw, " #"); idx >= 0 {
			raw = raw[:idx]
		}
		value = strings.TrimSpace(raw)
	}
	return key, value, true
}
