#!/usr/bin/env bash
#
# deploy.sh —— 服务器端发布 / 回滚 / 初始化脚本
#
# 由 GitHub Actions 通过 SSH 调用，也可以在服务器上手工执行：
#   bash deploy.sh bootstrap                 首次初始化（目录、环境变量模板、工具检查）
#   bash deploy.sh deploy <发布目录>          构建并切换到指定发布目录（CI 的主路径）
#   bash deploy.sh rollback [发布目录]        回滚到上一个（或指定）发布目录，不重新构建
#   bash deploy.sh status                    查看当前发布、进程状态、健康接口
#
# ── 进程管理边界 ────────────────────────────────────────────────────────────
#   Go 后端  → systemd 单元 blog-server.service（不经 PM2；unit 见
#              blog-server/deploy/systemd/blog-server.service）
#   Next 前端 → PM2 应用 blog-web（deploy/ecosystem.config.cjs 只保留这一个）
#
# ── 目录约定 ────────────────────────────────────────────────────────────────
#   /www/wwwroot/personal-blog/
#   ├── releases/<UTC时间戳>-<sha7>/   每次发布一份完整代码（各自带 node_modules 与 .next）
#   ├── current -> releases/xxx/       PM2 的工作目录指向这里，切换软链 + reload 即上线
#   ├── shared/                        跨发布复用，回滚不会动它
#   │   ├── backend.env                → 软链为 blog-server/.env
#   │   ├── frontend.env.local         → 软链为 blog-fronted/.env.local
#   │   ├── deploy.env                 （可选）覆盖下面的变量，如 NPM_REGISTRY
#   │   └── uploads/                   用户上传的图片（UPLOAD_DIR 固定指向这里）
#   └── logs/                          PM2 日志
#
# ── 设计要点 ────────────────────────────────────────────────────────────────
# 1. 先构建、后切换：两个应用的构建全部成功才动 current，构建失败线上毫无变化；
# 2. 切换后做健康检查，失败自动切回上一个发布；
# 3. node_modules 跟着发布目录走，回滚不需要重新安装/构建；
# 4. .env 与 uploads 只存在于 shared/，不在发布目录里，回滚不会丢密钥和图片。
#
set -Eeuo pipefail

# ── 可配置项（可被 shared/deploy.env 覆盖）──────────────────────────────────
APP_ROOT="${BLOG_ROOT:-/www/wwwroot/personal-blog}"

if [ -f "${APP_ROOT}/shared/deploy.env" ]; then
  # shellcheck disable=SC1090
  set -a
  . "${APP_ROOT}/shared/deploy.env"
  set +a
fi

KEEP_RELEASES="${KEEP_RELEASES:-3}"
API_PORT="${API_PORT:-4000}"
WEB_PORT="${WEB_PORT:-3000}"
SYSTEMD_UNIT="${SYSTEMD_UNIT:-blog-server}"

SHARED_DIR="${APP_ROOT}/shared"
RELEASES_DIR="${APP_ROOT}/releases"
CURRENT_LINK="${APP_ROOT}/current"
LOGS_DIR="${APP_ROOT}/logs"
BACKEND_ENV="${SHARED_DIR}/backend.env"
FRONTEND_ENV="${SHARED_DIR}/frontend.env.local"
UPLOADS_DIR="${SHARED_DIR}/uploads"
PM2_FILE="${CURRENT_LINK}/deploy/ecosystem.config.cjs"
API_HEALTH_URL="http://127.0.0.1:${API_PORT}/api/health"
WEB_HEALTH_URL="http://127.0.0.1:${WEB_PORT}/"

# ── 输出 ────────────────────────────────────────────────────────────────────
log()  { printf '▸ %s\n' "$*"; }
ok()   { printf '✔ %s\n' "$*"; }
warn() { printf '! %s\n' "$*" >&2; }
err()  { printf '✖ %s\n' "$*" >&2; }

trap 'err "第 ${LINENO} 行执行失败：${BASH_COMMAND}"' ERR

# ── 基础检查 ────────────────────────────────────────────────────────────────
# GitHub Actions 走的是非交互式 SSH，登录 shell 的 PATH（nvm / 宝塔 Node 管理器）
# 不会加载，这里主动把常见位置补进 PATH，避免「本地能跑、CI 说 node not found」。
ensure_node_path() {
  command -v node >/dev/null 2>&1 && return 0
  local d
  for d in /www/server/nodejs/*/bin /usr/local/node/bin "$HOME"/.nvm/versions/node/*/bin "$HOME"/.npm-global/bin; do
    [ -x "$d/node" ] || continue
    export PATH="$d:$PATH"
    ok "已补充 PATH：$d"
    return 0
  done
  return 0
}

ensure_dirs() {
  mkdir -p "$RELEASES_DIR" "$SHARED_DIR" "$UPLOADS_DIR" "$LOGS_DIR"
}

check_tools() {
  local missing=0 cmd
  # 后端是 Go：systemd 托管；前端仍需要 node/npm/pm2。
  for cmd in node npm pm2 curl systemctl; do
    command -v "$cmd" >/dev/null 2>&1 || { err "未找到命令：$cmd"; missing=1; }
  done
  [ "$missing" -eq 0 ] || {
    err "请先安装缺失的工具：Node 22（nvm 或 apt）、pm2（npm i -g pm2）、curl、systemd"
    exit 1
  }

  if command -v go >/dev/null 2>&1; then
    ok "Go 工具链：$(go version | awk '{print $3}')"
  else
    warn "服务器未安装 Go：将要求发布目录中已有 CI 预编译的 blog-server/bin/server"
  fi

  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$major" -lt 20 ]; then
    err "Node 版本过低（当前 $(node -v)），Next.js 16 需要 Node >= 20，建议 Node 22 LTS"
    exit 1
  fi
  ok "工具链：node $(node -v) / npm $(npm -v) / pm2 $(pm2 -v 2>/dev/null || echo '?')"
}

# ── 环境变量 ────────────────────────────────────────────────────────────────
write_env_templates() {
  if [ ! -f "$BACKEND_ENV" ]; then
    cat > "$BACKEND_ENV" <<'EOF'
# blog-server 生产环境变量（本文件只存在于服务器 shared/，不进 git）
NODE_ENV=production
PORT=4000

# ── MySQL（宝塔里建的最小权限账号）──
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=blog_app
MYSQL_PASSWORD=CHANGE_ME
MYSQL_DATABASE=jianli

# ── JWT：openssl rand -hex 32 ──
JWT_SECRET=CHANGE_ME
JWT_EXPIRES_IN=3d

# ── 浏览器真实访问的地址（不改 = 全站 CORS 403）──
CORS_ORIGIN=https://fantasynote.cloud

# ── 发文即时刷新：两个值前后端必须一致 ──
NEXT_REVALIDATE_URL=https://fantasynote.cloud
REVALIDATE_SECRET=CHANGE_ME
EOF
    printf '\nUPLOAD_DIR=%s\n' "$UPLOADS_DIR" >> "$BACKEND_ENV"
    chmod 600 "$BACKEND_ENV"
    warn "已生成 $BACKEND_ENV —— 请把 CHANGE_ME 全部替换成真实值"
  fi

  if [ ! -f "$FRONTEND_ENV" ]; then
    cat > "$FRONTEND_ENV" <<'EOF'
# blog-fronted 运行时变量（与后端 REVALIDATE_SECRET 同值；next start 会自动加载）
REVALIDATE_SECRET=CHANGE_ME
EOF
    chmod 600 "$FRONTEND_ENV"
    warn "已生成 $FRONTEND_ENV —— REVALIDATE_SECRET 必须与 backend.env 里的同值"
  fi
}

validate_env() {
  local f bad=0 k
  for f in "$BACKEND_ENV" "$FRONTEND_ENV"; do
    [ -f "$f" ] || { err "缺少 $f（先在服务器执行：bash deploy.sh bootstrap）"; bad=1; }
  done
  [ "$bad" -eq 0 ] || exit 1

  if grep -q 'CHANGE_ME' "$BACKEND_ENV" "$FRONTEND_ENV"; then
    err "环境变量文件里仍有 CHANGE_ME 占位符，请填好再发布"
    exit 1
  fi

  for k in MYSQL_HOST MYSQL_USER MYSQL_PASSWORD MYSQL_DATABASE JWT_SECRET CORS_ORIGIN REVALIDATE_SECRET NEXT_REVALIDATE_URL; do
    grep -qE "^${k}=.+" "$BACKEND_ENV" || { err "backend.env 缺少 $k"; bad=1; }
  done
  grep -qE '^REVALIDATE_SECRET=.+' "$FRONTEND_ENV" || { err "frontend.env.local 缺少 REVALIDATE_SECRET"; bad=1; }
  [ "$bad" -eq 0 ] || exit 1

  local a b
  a="$(grep -E '^REVALIDATE_SECRET=' "$BACKEND_ENV" | head -1 | cut -d= -f2-)"
  b="$(grep -E '^REVALIDATE_SECRET=' "$FRONTEND_ENV" | head -1 | cut -d= -f2-)"
  if [ "$a" != "$b" ]; then
    warn "两端 REVALIDATE_SECRET 不一致：发文后页面不会立即刷新（会静默降级到 ISR 周期）"
  else
    ok "环境变量校验通过（REVALIDATE_SECRET 两端一致）"
  fi
}

link_shared() {
  local rel="$1"
  # 文件系统不支持软链时退回拷贝（单机 ECS 上不会发生，兼容特殊挂载）
  ln -sfn "$BACKEND_ENV" "$rel/blog-server/.env" 2>/dev/null     || { cp -f "$BACKEND_ENV" "$rel/blog-server/.env"; warn "软链失败，已拷贝 .env（改 env 后需重新发布）"; }
  ln -sfn "$FRONTEND_ENV" "$rel/blog-fronted/.env.local" 2>/dev/null     || { cp -f "$FRONTEND_ENV" "$rel/blog-fronted/.env.local"; warn "软链失败，已拷贝 .env.local"; }
  mkdir -p "$UPLOADS_DIR"
  if ! grep -qE '^UPLOAD_DIR=' "$BACKEND_ENV"; then
    printf '\nUPLOAD_DIR=%s\n' "$UPLOADS_DIR" >> "$BACKEND_ENV"
    ok "已把 UPLOAD_DIR 写入 backend.env（指向 shared/uploads）"
  fi
}

# ── 构建 ────────────────────────────────────────────────────────────────────
build_backend() {
  local rel="$1"
  if command -v go >/dev/null 2>&1; then
    log "构建后端（go build）"
    (
      cd "$rel/blog-server"
      CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o bin/server ./cmd/server
    )
  else
    log "跳过后端编译（使用发布目录内的预编译产物）"
  fi
  [ -x "$rel/blog-server/bin/server" ] || {
    err "后端可执行文件缺失：blog-server/bin/server（请安装 Go 或由 CI 预编译后随代码上传）"
    exit 1
  }
  ok "后端构建完成"
}

# 后端由 systemd 托管：切换软链后 restart，失败只回滚软链与重启。
restart_backend() {
  systemctl restart "$SYSTEMD_UNIT" 2>&1 | sed 's/^/    /' || return 1
  return 0
}

# PM2 只负责 Next 前端。
pm2_start_or_reload_web() {
  pm2 startOrReload "$PM2_FILE" --only blog-web --update-env 2>&1 | sed 's/^/    /'
  pm2 save >/dev/null 2>&1 || true
  pm2 describe blog-web >/dev/null 2>&1
}

build_frontend() {
  local rel="$1"
  # 注意顺序：此时 current 仍指向旧版本，构建期调用的是【当前在线】的后端，
  # 所以全量 SSG 拿到的是线上一刻的文章列表（新发布不会改数据，足够准确）。
  # 首次部署时后端还没起 → generateStaticParams 降级为空列表，详情页改为按需生成，
  # 从第二次发布起就是全量预渲染。
  log "构建前端（npm ci + next build，约 1–2 分钟）"
  (
    cd "$rel/blog-fronted"
    npm ci --no-audit --no-fund
    API_TARGET="http://127.0.0.1:${API_PORT}" npm run build
  )
  [ -f "$rel/blog-fronted/.next/BUILD_ID" ] || { err "前端构建产物缺失：.next/BUILD_ID"; exit 1; }
  ok "前端构建完成"
}

# ── PM2 ─────────────────────────────────────────────────────────────────────
pm2_start_or_reload() {
  local app="$1"
  pm2 startOrReload "$PM2_FILE" --only "$app" --update-env 2>&1 | sed 's/^/    /'
  pm2 save >/dev/null 2>&1 || true
  pm2 describe "$app" >/dev/null 2>&1
}

wait_http() {
  local url="$1" name="$2" tries="${3:-30}" i
  for ((i = 1; i <= tries; i++)); do
    if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then
      ok "$name 健康检查通过（第 ${i} 次）"
      return 0
    fi
    sleep 1
  done
  err "$name 健康检查失败：$url"
  return 1
}

# 首次部署时 build 早于后端启动，SSG 的 /blog 可能是空列表；服务起来后补一次刷新。
revalidate_pages() {
  local secret query p
  secret="$(grep -E '^REVALIDATE_SECRET=' "$BACKEND_ENV" 2>/dev/null | head -1 | cut -d= -f2- || true)"
  if [ -z "$secret" ]; then
    warn "backend.env 缺少 REVALIDATE_SECRET，跳过静态页刷新"
    return 0
  fi
  query="secret=${secret}"
  for p in /blog '/blog/[id]' /home /plan /resume; do
    query="${query}&path=$(printf '%s' "$p" | sed 's/\[/%5B/g; s/\]/%5D/g')"
  done
  if curl -g -fsS --max-time 15 "http://127.0.0.1:${WEB_PORT}/api/revalidate?${query}" >/dev/null 2>&1; then
    ok "已触发静态页刷新（/blog、/blog/[id]、/home、/plan、/resume）"
  else
    warn "静态页刷新失败（不影响服务，可稍后手动重试）"
  fi
}

# ── 发布目录切换 ────────────────────────────────────────────────────────────
switch_current() {
  local target="$1"
  [ -d "$target" ] || { err "发布目录不存在：$target"; exit 1; }
  if [ -e "$CURRENT_LINK" ] && [ ! -L "$CURRENT_LINK" ]; then
    err "$CURRENT_LINK 已存在且不是软链，请先手工处理（删掉该目录后重试）"
    exit 1
  fi
  # -T 让「目标是目录」时也当作文件替换；个别老版本 ln 不支持，退回 rm + ln
  ln -sfnT -- "$target" "$CURRENT_LINK" 2>/dev/null || {
    rm -f -- "$CURRENT_LINK"
    ln -s -- "$target" "$CURRENT_LINK"
  }
  ok "current -> $(basename "$target")"
}

current_release() {
  [ -e "$CURRENT_LINK" ] || return 0
  readlink -f "$CURRENT_LINK" 2>/dev/null || true
}

previous_release() {
  local cur d
  cur="$(current_release)"
  while IFS= read -r d; do
    [ "$(readlink -f "$d")" = "$cur" ] && continue
    [ -x "$d/blog-server/bin/server" ] || continue
    [ -f "$d/blog-fronted/.next/BUILD_ID" ] || continue
    printf '%s\n' "$d"
    return 0
  done < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort -r)
  return 1
}

cleanup_releases() {
  local cur kept=0 d
  cur="$(current_release)"
  while IFS= read -r d; do
    [ "$(readlink -f "$d")" = "$cur" ] && continue
    kept=$((kept + 1))
    if [ "$kept" -gt "$((KEEP_RELEASES - 1))" ]; then
      case "$d" in
        "${RELEASES_DIR}"/*)
          log "清理旧发布：$(basename "$d")"
          rm -rf -- "$d"
          ;;
        *)
          warn "跳过意外路径，未删除：$d"
          ;;
      esac
    fi
  done < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort -r)
}

# ── 子命令 ──────────────────────────────────────────────────────────────────
cmd_bootstrap() {
  ensure_dirs
  log "初始化目录：$APP_ROOT"
  check_tools
  write_env_templates
  ok "目录与模板就绪"
  cat <<EOF

下一步（首次部署只需做一次）：
  1) 编辑服务器上的环境变量（两处 REVALIDATE_SECRET 必须同值）：
       ${BACKEND_ENV}
       ${FRONTEND_ENV}
  2) 安装并启用后端 systemd 单元（首次，需 root）：
       sudo cp "${CURRENT_LINK}/blog-server/deploy/systemd/blog-server.service" /etc/systemd/system/
       # APP_ROOT 不是 /www/wwwroot/personal-blog 时，先改 unit 里的 WorkingDirectory / EnvironmentFile / ExecStart / ReadWritePaths
       sudo systemctl daemon-reload
       sudo systemctl enable blog-server
     （后端只由 systemd 管理，不要再用 pm2 启动它）
  3) 让 PM2 开机自启（只托管前端 blog-web；当前用户执行一次，按提示复制 sudo 命令）：
       pm2 startup
       pm2 save
  4) Nginx 把整站反代到 127.0.0.1:${WEB_PORT}
     （参考仓库 deploy/nginx-blog.conf.example，宝塔里替换自动生成的 location / 段）
  5) 阿里云安全组只放行 22 / 80 / 443；${API_PORT}、${WEB_PORT} 不要对外开放
  6) 填好 .env 后回到 GitHub 触发一次 Deploy（action=deploy）即可上线

EOF
}

cmd_deploy() {
  local rel="${1:-}"
  [ -n "$rel" ] || { err "缺少发布目录参数：deploy.sh deploy <发布目录>"; exit 1; }
  rel="$(readlink -f "$rel")"
  [ -d "$rel" ] || { err "发布目录不存在：$rel"; exit 1; }

  log "发布 $(basename "$rel") → $APP_ROOT"
  ensure_dirs
  check_tools
  validate_env
  link_shared "$rel"

  build_backend "$rel"
  build_frontend "$rel"

  local prev
  prev="$(current_release)"

  log "切换版本并重启进程"
  switch_current "$rel"

  if ! restart_backend || ! wait_http "$API_HEALTH_URL" "blog-server" 30; then
    err "后端启动失败，自动回滚"
    if [ -n "$prev" ]; then
      switch_current "$prev"
      restart_backend || true
      wait_http "$API_HEALTH_URL" "blog-server(回滚后)" 20 || true
    else
      warn "没有可回滚的历史发布，请检查 shared/backend.env 与数据库"
    fi
    exit 1
  fi

  if ! pm2_start_or_reload_web || ! wait_http "$WEB_HEALTH_URL" "blog-web" 40; then
    err "前端启动失败，自动回滚"
    if [ -n "$prev" ]; then
      switch_current "$prev"
      restart_backend || true
      pm2_start_or_reload_web || true
      wait_http "$WEB_HEALTH_URL" "blog-web(回滚后)" 30 || true
    fi
    exit 1
  fi

  revalidate_pages
  cleanup_releases
  ok "发布成功：$(basename "$rel")"
  cmd_status
}

cmd_rollback() {
  local target="${1:-}"
  [ -n "$target" ] || target="$(previous_release)" || true
  [ -n "${target:-}" ] || { err "找不到可回滚的发布目录"; exit 1; }
  target="$(readlink -f "$target")"
  [ -d "$target" ] || { err "回滚目标不存在：$target"; exit 1; }

  ensure_dirs
  check_tools
  validate_env
  link_shared "$target"

  warn "回滚到：$(basename "$target")（不重新构建）"
  switch_current "$target"

  restart_backend || { err "后端重启失败"; exit 1; }
  wait_http "$API_HEALTH_URL" "blog-server" 30 || exit 1
  pm2_start_or_reload_web || { err "前端重启失败"; exit 1; }
  wait_http "$WEB_HEALTH_URL" "blog-web" 40 || exit 1

  ok "回滚完成"
  cmd_status
}

cmd_status() {
  local rel
  rel="$(current_release)"
  echo
  echo "── 当前发布 ──"
  if [ -n "$rel" ]; then
    echo "  $(basename "$rel")  (${rel})"
  else
    echo "  未初始化（current 软链不存在）"
  fi
  echo
  echo "── 磁盘占用 ──"
  du -sh "$RELEASES_DIR" 2>/dev/null | sed 's/^/  releases: /' || true
  du -sh "$UPLOADS_DIR" 2>/dev/null | sed 's/^/  uploads:  /' || true
  echo
  echo "── 进程 ──"
  echo "  systemd ${SYSTEMD_UNIT}: $(systemctl is-active "$SYSTEMD_UNIT" 2>/dev/null || echo unknown)"
  pm2 ls 2>/dev/null || warn "pm2 未就绪"
  echo
  echo "── 健康检查 ──"
  if curl -fsS --max-time 3 "$API_HEALTH_URL" >/dev/null 2>&1; then
    ok "backend $API_HEALTH_URL"
  else
    warn "backend 无响应：$API_HEALTH_URL"
  fi
  if curl -fsS --max-time 3 -o /dev/null "$WEB_HEALTH_URL" 2>/dev/null; then
    ok "frontend $WEB_HEALTH_URL"
  else
    warn "frontend 无响应：$WEB_HEALTH_URL"
  fi
}

usage() {
  sed -n '3,20p' "$0" | sed 's/^# \{0,1\}//'
}

main() {
  ensure_node_path
  local cmd="${1:-}"
  shift || true
  case "$cmd" in
    bootstrap) cmd_bootstrap ;;
    deploy) cmd_deploy "${1:-}" ;;
    rollback) cmd_rollback "${1:-}" ;;
    status) cmd_status ;;
    *) usage; exit 1 ;;
  esac
}

main "$@"
