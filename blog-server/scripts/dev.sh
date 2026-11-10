#!/usr/bin/env bash
#
# 本地开发启动脚本：
#   - 自动加载 .env（优先级：ENV_FILE > 本目录 .env）
#   - 编译后前台运行，参数透传（如 `bash scripts/dev.sh migrate`）
#
# 用法：
#   bash scripts/dev.sh              # 启动 HTTP 服务（默认 :4000）
#   bash scripts/dev.sh migrate      # 执行版本化迁移
#   PORT=4100 bash scripts/dev.sh    # 换端口（同时调整前端 API_TARGET）
set -euo pipefail
cd "$(dirname "$0")/.."
source ./goenv.sh

if [ -z "${ENV_FILE:-}" ] && [ ! -f .env ]; then
  echo "==> 未找到 .env：请先 cp .env.example .env 并填写数据库连接，或设置 ENV_FILE 指向配置文件"
fi

echo "==> 编译 bin/server.exe"
go build -o bin/server.exe ./cmd/server

echo "==> 启动服务"
exec ./bin/server.exe "$@"
