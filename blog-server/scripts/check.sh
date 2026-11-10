#!/usr/bin/env bash
#
# 一键质量门禁：格式检查 + go vet + 单元测试 + 构建。
# 用法：bash scripts/check.sh
set -euo pipefail
cd "$(dirname "$0")/.."
source ./goenv.sh

echo "==> gofmt"
unformatted="$(gofmt -l cmd internal migrations)"
if [ -n "$unformatted" ]; then
  echo "以下文件未格式化："
  echo "$unformatted"
  exit 1
fi

echo "==> go vet"
go vet ./...

echo "==> go test"
go test ./...

echo "==> go build"
go build -o bin/server.exe ./cmd/server

echo "✔ 全部通过"
