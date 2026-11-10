#!/usr/bin/env bash
set -euo pipefail
cd blog-server-go
source ./goenv.sh
go build -o bin/server.exe ./cmd/server

export JWT_SECRET=golden-jwt-secret-0123456789
export MYSQL_DATABASE=blog_golden
export PORT=4100
export UPLOAD_DIR="$PWD/testdata/uploads"
export AI_CONFIG_ENC_KEY="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="

./bin/server.exe >/tmp/go-smoke.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT

for i in $(seq 1 40); do
  if curl -s -o /dev/null "http://127.0.0.1:4100/api/health"; then break; fi
  sleep 0.25
done

echo "--- health"
curl -s "http://127.0.0.1:4100/api/health"; echo
echo "--- 404"
curl -s "http://127.0.0.1:4100/api/nope"; echo
echo "--- login"
LOGIN=$(curl -s -X POST "http://127.0.0.1:4100/api/auth/login" -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin@12345","role":"admin"}')
echo "$LOGIN" | head -c 300; echo
TOKEN=$(echo "$LOGIN" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
echo "--- articles"
curl -s "http://127.0.0.1:4100/api/articles?pageSize=2"; echo
echo "--- article tags"
curl -s "http://127.0.0.1:4100/api/articles/tags"; echo
echo "--- tags"
curl -s "http://127.0.0.1:4100/api/tags" | head -c 400; echo
echo "--- site-content plan"
curl -s "http://127.0.0.1:4100/api/site-content/plan" | head -c 300; echo
echo "--- site-content list (admin)"
curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:4100/api/site-content" | head -c 300; echo
echo "--- notifications"
curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:4100/api/notifications"; echo
echo "--- users manage"
curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:4100/api/users/manage" | head -c 400; echo
echo "--- ai settings"
curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:4100/api/ai/settings"; echo
echo "--- log"
tail -n 20 /tmp/go-smoke.log || true
