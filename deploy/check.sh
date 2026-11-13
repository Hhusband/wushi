#!/usr/bin/env bash
# 吾师 — 三方版本一致性校验（本地仓库 ↔ NAS 源码目录 ↔ 运行中的容器）
#
# 用法:
#   ./deploy/check.sh            # 完整校验，发现问题时退出码为 1
#   ./deploy/check.sh --quiet    # 只输出结论
#
# 校验内容:
#   1. 本地 classroom-ai/ 与 NAS /volume1/docker/classroom-ai 的逐文件 SHA-256
#   2. NAS 源码目录 与 运行容器内 /app 的逐文件 SHA-256
#   3. 容器健康状态 + HTTP 200 + 镜像构建时间
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
set -a; source "$HERE/nas.env"; set +a
LOCAL_DIR="$(cd "$HERE/.." && pwd)"
QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

SSH_OPTS=(-i "$NAS_KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=15 -o LogLevel=ERROR -o BatchMode=yes -o PreferredAuthentications=publickey)
nas_ssh() { ssh "${SSH_OPTS[@]}" "$NAS_USER@$NAS_HOST" "$@"; }
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

FAIL=0
WARN=0
say() { [ "$QUIET" = "1" ] || echo "$@"; }
ok()  { echo "  ✅ $*"; }
bad() { echo "  ❌ $*"; FAIL=1; }
warn() { echo "  ⚠️  $*"; WARN=1; }

# 参与比对的路径过滤（与 deploy.sh 的 --exclude 保持一致）
FILTER=(-not -path './node_modules/*' -not -path './.next/*' -not -path './.git/*'
        -not -path './exports/*' -not -path './deploy/*' -not -path './.claude/*'
        -not -path './backups/*' -not -path './uploads/*'
        -not -name '.env' -not -name '.env.local' -not -name '.DS_Store'
        -not -name '*.tsbuildinfo' -not -name '._*')
# 远程执行时需要保留引号，避免远端 shell 展开通配符（如 ./exports/* 会撑爆 find 参数）
RFILTER="-not -path './node_modules/*' -not -path './.next/*' -not -path './.git/*' -not -path './exports/*' -not -path './uploads/*' -not -path './deploy/*' -not -path './.claude/*' -not -name '.env' -not -name '.env.local' -not -name '.DS_Store' -not -name '*.tsbuildinfo' -not -name '._*'"

echo "== 1/3 本地仓库 ↔ NAS 源码目录 =="
(
  cd "$LOCAL_DIR" && find . -type f "${FILTER[@]}" -print0 \
    | xargs -0 shasum -a 256 | sed 's|  \./|  |'
) | LC_ALL=C sort -k2 > "$TMP/local.txt"

nas_ssh \
  "cd $NAS_DIR && find . -type f $RFILTER -print0 | xargs -0 sha256sum | sed 's|  \./|  |' | LC_ALL=C sort -k2" \
  > "$TMP/nas.txt"

if diff -q "$TMP/local.txt" "$TMP/nas.txt" >/dev/null; then
  ok "完全一致（$(wc -l < "$TMP/local.txt" | tr -d ' ') 个文件）"
else
  bad "存在差异："
  diff "$TMP/local.txt" "$TMP/nas.txt" | sed 's/^/     /'
fi

echo "== 2/3 NAS 源码目录 ↔ 运行容器 =="
CONTAINER_PATHS='src prisma public tools'
nas_ssh \
  "printf '%s\n' '$NAS_PASS' | sudo -S $NAS_DOCKER exec $NAS_CONTAINER sh -c 'cd /app && { find $CONTAINER_PATHS -type f; echo server.ts; echo entrypoint.sh; } | xargs sha256sum' 2>/dev/null" \
  | LC_ALL=C sort -k2 > "$TMP/container.txt"

# 从本地清单中裁出容器内存在的同一批路径，并把 docker/entrypoint.sh 映射为 entrypoint.sh
awk '$2 ~ /^(src|prisma|public|tools)\// || $2 == "server.ts" || $2 == "docker/entrypoint.sh"' "$TMP/local.txt" \
  | sed 's|  docker/entrypoint.sh$|  entrypoint.sh|' \
  | LC_ALL=C sort -k2 > "$TMP/local-in-container.txt"

DIFF2="$(diff "$TMP/local-in-container.txt" "$TMP/container.txt" || true)"
if [ -z "$DIFF2" ]; then
  ok "容器内代码与本地源码一致（$(wc -l < "$TMP/container.txt" | tr -d ' ') 个文件）"
elif echo "$DIFF2" | grep -q '^< '; then
  bad "容器内代码落后于本地源码（镜像需要重新构建）："
  echo "$DIFF2" | sed 's/^/     /'
else
  # 只有 ">"：容器里有本地已删除的旧文件，属残留，不影响运行功能
  warn "容器内存在本地已删除的残留文件（不影响功能，下次部署后自动消失）："
  echo "$DIFF2" | grep '^> ' | sed 's/^/     /'
fi

echo "== 3/3 运行状态 =="
CODE="$(curl -s -o /dev/null -m 8 -w '%{http_code}' "$APP_URL/" || true)"
[ "$CODE" = "200" ] && ok "HTTP $APP_URL/ -> 200" || bad "HTTP $APP_URL/ -> ${CODE:-超时}"

STATUS="$(nas_ssh \
  "printf '%s\n' '$NAS_PASS' | sudo -S $NAS_DOCKER inspect $NAS_CONTAINER --format '{{.State.Status}}|{{.State.Health.Status}}|{{.Config.Image}}|{{.State.StartedAt}}|{{.Image}}' 2>/dev/null")"
say "  容器: ${STATUS%|*}"
IMAGE_INFO="$(nas_ssh \
  "printf '%s\n' '$NAS_PASS' | sudo -S $NAS_DOCKER images --format '{{.Repository}}:{{.Tag}} {{.CreatedAt}}' $NAS_IMAGE 2>/dev/null | head -1")"
say "  镜像: $IMAGE_INFO"
CIMG_ID="${STATUS##*|}"
LATEST_ID="$(nas_ssh \
  "printf '%s\n' '$NAS_PASS' | sudo -S $NAS_DOCKER images -q $NAS_IMAGE 2>/dev/null | head -1")"
if [ -n "$LATEST_ID" ] && [ -n "$CIMG_ID" ] && [ "$LATEST_ID" != "$CIMG_ID" ]; then
  warn "运行容器仍是旧镜像（$(printf '%s' "$CIMG_ID" | sed 's/^sha256://' | cut -c1-12)），最新构建镜像为 $(printf '%s' "$LATEST_ID" | cut -c1-12)，重新部署/重启后生效"
fi

echo
if [ "$FAIL" = "0" ] && [ "$WARN" = "0" ]; then
  echo "结论：本地代码 = NAS 源码 = 运行容器，三方完全一致 ✅"
elif [ "$FAIL" = "0" ]; then
  echo "结论：代码一致 ✅（存在非阻断提示 ⚠️，不影响运行功能）"
else
  echo "结论：存在不一致，请检查上方差异 ❌"
fi
exit "$FAIL"
