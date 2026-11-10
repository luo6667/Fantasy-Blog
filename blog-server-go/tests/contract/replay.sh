#!/usr/bin/env bash
#
# 契约回放：把旧 Node 录制的 golden 夹具在 Go 实现上重放并逐用例比较。
#
# 步骤：
#   1. 用 jianli 重建副本库 blog_golden（不碰生产库）
#   2. 种入 admin / Admin@12345
#   3. 编译并启动 Go 服务（4100，连 blog_golden）
#   4. 用同一份 capture.mjs 采集 Go 响应到 tests/contract/actual
#   5. compare.mjs 归一化后逐用例比较
#
# 用法：bash tests/contract/replay.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

source ./goenv.sh

MYSQL_BIN="${MYSQL_BIN:-C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe}"
MYSQLDUMP_BIN="${MYSQLDUMP_BIN:-C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqldump.exe}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-1234}"
DB_NAME="${DB_NAME:-blog_golden}"
SRC_DB="${SRC_DB:-jianli}"
PORT="${PORT:-4100}"
BASE="http://127.0.0.1:${PORT}"
OUT="${OUT:-$(cygpath -m "$(pwd)/tests/contract/actual")}"
UPLOAD_DIR="${UPLOAD_DIR:-$(cygpath -m "$(pwd)/testdata/uploads")}"
ENC_KEY="${AI_CONFIG_ENC_KEY:-$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))")}"

echo "==> 重建副本库 ${DB_NAME}（来源 ${SRC_DB}）"
"$MYSQLDUMP_BIN" -u"$DB_USER" -p"$DB_PASS" --add-drop-table --single-transaction --skip-triggers "$SRC_DB" | "$MYSQL_BIN" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME"

echo "==> 种入管理员 admin"
HASH="$(node -e "const b=require('../blog-server/node_modules/bcryptjs');process.stdout.write(b.hashSync('Admin@12345',10))")"
"$MYSQL_BIN" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "INSERT INTO admins (id, username, password, createdAt, updatedAt) VALUES (LEFT(SHA2(UUID(),256),24), 'admin', '${HASH}', NOW(), NOW()) ON DUPLICATE KEY UPDATE password=VALUES(password), updatedAt=NOW()"

echo "==> 清理通知，回到录制时的初始状态"
"$MYSQL_BIN" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "DELETE FROM notifications"

echo "==> 编译 Go 服务"
go build -o bin/server.exe ./cmd/server
mkdir -p "$UPLOAD_DIR"
rm -rf "$OUT"
mkdir -p "$OUT"

echo "==> 启动 Go 服务 :${PORT}"
GIN_MODE=release PORT="$PORT" MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}" MYSQL_PORT="${MYSQL_PORT:-3306}" MYSQL_USER="$DB_USER" MYSQL_PASSWORD="$DB_PASS" MYSQL_DATABASE="$DB_NAME" JWT_SECRET="${JWT_SECRET:-golden-jwt-secret-0123456789}" CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:3000}" UPLOAD_DIR="$UPLOAD_DIR" AI_CONFIG_ENC_KEY="$ENC_KEY" ./bin/server.exe > replay-server.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 100); do
  if curl -fsS "$BASE/api/health" >/dev/null 2>&1; then break; fi
  sleep 0.2
done
if ! curl -fsS "$BASE/api/health" >/dev/null 2>&1; then
  echo "✘ Go 服务启动失败，日志："
  cat replay-server.log
  exit 1
fi

echo "==> 回放请求"
GOLDEN_BASE="$BASE" GOLDEN_OUT="$OUT" node tests/contract/capture.mjs

echo "==> 比对 golden"
node tests/contract/compare.mjs tests/contract/golden "$OUT"
