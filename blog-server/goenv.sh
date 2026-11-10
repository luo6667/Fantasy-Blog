# Go 工具链本地环境（沙箱只允许写工作区，模块缓存必须落在仓库内）
# 用法：source blog-server/goenv.sh && cd blog-server && go build ./...
# 注意：Go 只接受 Windows 绝对路径，MSYS 的 /e/... 会被判定为“相对路径”，故用 cygpath -w 转换。
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export GOENV="$(cygpath -w "$ROOT/.goenv")"
export GOPATH="$(cygpath -w "$ROOT/.gopath")"
export GOMODCACHE="$(cygpath -w "$ROOT/.gomodcache")"
export GOCACHE="$(cygpath -w "$ROOT/.gocache")"
export GOFLAGS="-mod=mod"
# 本机访问 sum.golang.org 会 EOF，改用国内代理并关闭 sumdb（go.sum 仍校验依赖哈希）。
export GOPROXY="${GOPROXY:-https://goproxy.cn,direct}"
export GOSUMDB="${GOSUMDB:-off}"
