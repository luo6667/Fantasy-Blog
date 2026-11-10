#!/usr/bin/env bash
#
# 前端冒烟：用真实 Next.js 前端连接 Go 后端，验证关键页面与接口在浏览器同源路径下可用。
#
# 前置：MySQL 运行中，blog_golden 可写（脚本会用 tests/contract/fixture.sql 重建它）。
# 用法：bash tests/smoke/frontend.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

source ./goenv.sh

MYSQL_BIN="${MYSQL_BIN:-C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-1234}"
DB_NAME="${DB_NAME:-blog_golden}"
API_PORT="${API_PORT:-4100}"
WEB_PORT="${WEB_PORT:-3100}"
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

echo "==> 用固定快照重建副本库 ${DB_NAME}"
"$MYSQL_BIN" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" < tests/contract/fixture.sql

echo "==> 种入管理员 admin"
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}" MYSQL_PORT="${MYSQL_PORT:-3306}" MYSQL_USER="$DB_USER" MYSQL_PASSWORD="$DB_PASS" \
  MYSQL_DATABASE="$DB_NAME" JWT_SECRET="smoke-jwt-secret-0123456789" ADMIN_INITIAL_PASSWORD='Admin@12345' \
  ./bin/server.exe seed-admin

"$MYSQL_BIN" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "DELETE FROM notifications"

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
( cd ../blog-fronted && exec env API_TARGET="$API_BASE" node node_modules/next/dist/bin/next dev -p "$WEB_PORT" ) \
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

echo "==> 验证经 Next 代理的接口"
TOKEN="$(curl -fsS -X POST "$WEB_BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@12345","role":"admin"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).data.token))")"
if [ -z "$TOKEN" ]; then echo "✘ 通过代理登录失败"; fail=1; else echo "✔ 通过代理登录成功"; fi

ME="$(curl -fsS "$WEB_BASE/api/auth/me" -H "Authorization: Bearer $TOKEN")"
case "$ME" in
  *'"role":"admin"'*) echo "✔ /api/auth/me 返回管理员身份" ;;
  *) echo "✘ /api/auth/me 异常：$ME"; fail=1 ;;
esac

LIST="$(curl -fsS "$WEB_BASE/api/articles?page=1&pageSize=3")"
case "$LIST" in
  *'"total":12'*) echo "✔ /api/articles 代理到 Go 后端（total=12）" ;;
  *) echo "✘ /api/articles 异常：$(echo "$LIST" | head -c 200)"; fail=1 ;;
esac

PLAN="$(curl -fsS "$WEB_BASE/api/site-content/plan")"
case "$PLAN" in
  *'PLAN'*|*'成长'*|*'"code":0'*) echo "✔ /api/site-content/plan 可用" ;;
  *) echo "✘ /api/site-content/plan 异常：$(echo "$PLAN" | head -c 200)"; fail=1 ;;
esac

if [ "$fail" -ne 0 ]; then
  echo "✘ 前端冒烟未通过"
  exit 1
fi
echo "✔ 前端冒烟通过"
