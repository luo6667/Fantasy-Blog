#!/usr/bin/env bash
#
# 前端冒烟：用真实 Next.js 前端连接 Go 后端，验证关键页面与接口在浏览器同源路径下可用。
#
# 流程：重建副本库 → 载入旧版快照 → 跑 0001 迁移 → 种管理员 → 起 Go/Next → 校验页面与接口。
# 前置：MySQL 运行中；Next dev 允许 spawn（沙箱下需 danger-full-access）。
# 用法：bash tests/smoke/frontend.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

source ./goenv.sh

MYSQL_BIN="${MYSQL_BIN:-C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-1234}"
DB_NAME="${DB_NAME:-blog_smoke}"
API_PORT="${API_PORT:-4100}"
WEB_PORT="${WEB_PORT:-3100}"
WEB_DIR="${WEB_DIR:-$(pwd)/../blog-fronted}"
API_BASE="http://127.0.0.1:${API_PORT}"
WEB_BASE="http://127.0.0.1:${WEB_PORT}"
UPLOAD_DIR="${UPLOAD_DIR:-$(cygpath -m "$(pwd)/testdata/uploads")}"
WORK_DIR="$(pwd)/testdata/smoke"
mkdir -p "$WORK_DIR"

cleanup() {
  for pid in "${WEB_PID:-}" "${API_PID:-}"; do
    if [ -n "$pid" ]; then kill "$pid" 2>/dev/null || true; fi
  done
}
trap cleanup EXIT

echo "==> 编译 Go 服务"
go build -o bin/server.exe ./cmd/server

echo "==> 重建副本库 ${DB_NAME}（旧版快照 + 0001 迁移）"
"$MYSQL_BIN" -u"$DB_USER" -p"$DB_PASS" -e "DROP DATABASE IF EXISTS \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
"$MYSQL_BIN" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" < tests/fixtures/legacy-pre-redesign.sql
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}" MYSQL_PORT="${MYSQL_PORT:-3306}" MYSQL_USER="$DB_USER" MYSQL_PASSWORD="$DB_PASS" \
  MYSQL_DATABASE="$DB_NAME" JWT_SECRET="smoke-jwt-secret-0123456789" \
  ./bin/server.exe migrate

echo "==> 种入管理员 admin"
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}" MYSQL_PORT="${MYSQL_PORT:-3306}" MYSQL_USER="$DB_USER" MYSQL_PASSWORD="$DB_PASS" \
  MYSQL_DATABASE="$DB_NAME" JWT_SECRET="smoke-jwt-secret-0123456789" ADMIN_INITIAL_PASSWORD='Admin@12345' \
  ./bin/server.exe seed-admin

echo "==> 启动 Go 后端 :${API_PORT}"
GIN_MODE=release PORT="$API_PORT" MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}" MYSQL_PORT="${MYSQL_PORT:-3306}" MYSQL_USER="$DB_USER" MYSQL_PASSWORD="$DB_PASS" MYSQL_DATABASE="$DB_NAME" JWT_SECRET="smoke-jwt-secret-0123456789" \
  UPLOAD_DIR="$UPLOAD_DIR" ./bin/server.exe > testdata/smoke/api.log 2>&1 &
API_PID=$!
for _ in $(seq 1 100); do
  if curl -fsS "$API_BASE/api/health" >/dev/null 2>&1; then break; fi
  sleep 0.2
done
curl -fsS "$API_BASE/api/health" >/dev/null || { echo "✘ Go 后端启动失败"; cat testdata/smoke/api.log; exit 1; }

echo "==> 启动 Next.js 前端 :${WEB_PORT}"
( cd "$WEB_DIR" && exec env API_TARGET="$API_BASE" node node_modules/next/dist/bin/next dev --webpack -p "$WEB_PORT" ) \
  > testdata/smoke/web.log 2>&1 &
WEB_PID=$!
for _ in $(seq 1 300); do
  if curl -fsS "$WEB_BASE/" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
curl -fsS "$WEB_BASE/" >/dev/null || { echo "✘ Next.js 启动失败"; tail -40 testdata/smoke/web.log; exit 1; }

fail=0
check_page() {
  local path="$1" marker="$2"
  local file="$WORK_DIR/page$(echo "$path" | tr '/' '_').html"
  local status
  status="$(curl -sS -o "$file" -w '%{http_code}' "$WEB_BASE$path")"
  if [ "$status" != "200" ]; then
    echo "✘ GET $path → $status"
    fail=1
    return
  fi
  if ! grep -q "$marker" "$file"; then
    echo "✘ GET $path 未包含标记「$marker」"
    fail=1
    return
  fi
  echo "✔ GET $path → 200，包含「$marker」"
}

check_page "/" "JasonLuo"
check_page "/blog" "博客"
check_page "/plan" "个阶段"
check_page "/resume" "简历"
check_page "/about" "关于"
check_page "/admin/login" "管理员登录"

echo "==> 验证经 Next 代理的接口"
TOKEN="$(curl -fsS -X POST "$WEB_BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@12345"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).data.token))")"
if [ -z "$TOKEN" ]; then echo "✘ 通过代理登录失败"; fail=1; else echo "✔ 通过代理登录成功"; fi

ME="$(curl -fsS "$WEB_BASE/api/auth/me" -H "Authorization: Bearer $TOKEN")"
case "$ME" in
  *'"role":"admin"'*) echo "✔ /api/auth/me 返回管理员身份" ;;
  *) echo "✘ /api/auth/me 异常：$ME"; fail=1 ;;
esac

LIST="$(curl -fsS "$WEB_BASE/api/articles?page=1&pageSize=3")"
if echo "$LIST" | grep -q '"total":12' && echo "$LIST" | grep -q '"primaryTag"' && echo "$LIST" | grep -q '"subTags"'; then
  echo "✔ /api/articles 返回主标签 + 子标签（total=12）"
else
  echo "✘ /api/articles 异常：$(echo "$LIST" | head -c 300)"; fail=1
fi

FILTERED="$(curl -fsS "$WEB_BASE/api/articles?tag=%E5%B7%A5%E7%A8%8B%E5%8C%96")"
case "$FILTERED" in
  *'"total":1'*) echo "✔ 按主标签筛选（工程化 → 1 篇）" ;;
  *) echo "✘ 主标签筛选异常：$(echo "$FILTERED" | head -c 300)"; fail=1 ;;
esac

TAGS="$(curl -fsS "$WEB_BASE/api/tags")"
case "$TAGS" in
  *'"name":"工程化"'*) echo "✔ /api/tags 主标签库可用" ;;
  *) echo "✘ /api/tags 异常：$(echo "$TAGS" | head -c 300)"; fail=1 ;;
esac

PLAN="$(curl -fsS "$WEB_BASE/api/site-content/plan")"
case "$PLAN" in
  *'"key":"plan"'*) echo "✔ /api/site-content/plan 可用" ;;
  *) echo "✘ /api/site-content/plan 异常：$(echo "$PLAN" | head -c 200)"; fail=1 ;;
esac

GONE="$(curl -sS -o /dev/null -w '%{http_code}' "$WEB_BASE/api/notifications")"
if [ "$GONE" = "404" ]; then echo "✔ 已删除的通知接口返回 404"; else echo "✘ /api/notifications 期望 404，实际 $GONE"; fail=1; fi

if [ "$fail" -ne 0 ]; then
  echo "✘ 前端冒烟未通过"
  exit 1
fi
echo "✔ 前端冒烟通过"
