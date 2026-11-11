#!/usr/bin/env bash
# 吾师 — 一键部署到 NAS（源码同步 → 远程构建 → 重启 → 健康检查）
#
# 用法:
#   ./deploy/deploy.sh           # 同步源码 + 重新构建镜像 + 重启容器 + 健康检查
#   ./deploy/deploy.sh --dry-run # 只显示本地与 NAS 的差异，不做任何改动
#   ./deploy/deploy.sh --sync    # 只同步源码，不构建/重启
#
# 设计说明:
#   - 本地仓库为唯一源码来源（source of truth）
#   - NAS 上的 .env（生产密钥）、exports/（导出数据）永远不被覆盖
#   - 传输用 tar over ssh（DSM 的 /usr/bin/rsync 被 Synology 改造过，非交互 --server 模式会报
#     "Permission denied, please try again."，故不使用 rsync）
#   - 构建在 NAS 上执行（Dockerfile 多阶段构建），耗时约 5-15 分钟
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
set -a; source "$HERE/nas.env"; set +a
LOCAL_DIR="$(cd "$HERE/.." && pwd)"

MODE="deploy"
case "${1:-}" in
  --dry-run) MODE="dry-run" ;;
  --sync)    MODE="sync" ;;
  "")        MODE="deploy" ;;
  *) echo "未知参数: $1（可用: --dry-run | --sync）"; exit 2 ;;
esac

SSH_OPTS=(-i "$NAS_KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
          -o ConnectTimeout=15 -o LogLevel=ERROR -o BatchMode=yes -o PreferredAuthentications=publickey)
nas() { ssh "${SSH_OPTS[@]}" "$NAS_USER@$NAS_HOST" "$@"; }

if [ ! -f "$NAS_KEY" ]; then
  echo "缺少 SSH 私钥: $NAS_KEY（见 deploy/README.md「首次配置」）"; exit 1
fi

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# 参与同步的文件范围 / 排除规则（与 check.sh 保持一致）
EXCL_TAR=(--exclude=./node_modules --exclude=./.next --exclude=./.git --exclude=./.claude
          --exclude=./exports --exclude=./deploy --exclude=./backups --exclude='*.tsbuildinfo'
          --exclude=.DS_Store --exclude=./.env --exclude=./.env.local
          --exclude='._*')
# 参与同步/比对的文件范围（与 check.sh 保持一致）
FILTER=(-not -path './node_modules/*' -not -path './.next/*' -not -path './.git/*'
        -not -path './exports/*' -not -path './deploy/*' -not -path './.claude/*'
        -not -path './backups/*'
        -not -name '.env' -not -name '.env.local' -not -name '.DS_Store'
        -not -name '*.tsbuildinfo' -not -name '._*')
# 远端执行时保留单引号，避免远端 shell 展开通配符
RFILTER="-not -path './node_modules/*' -not -path './.next/*' -not -path './.git/*' -not -path './exports/*' -not -path './deploy/*' -not -path './.claude/*' -not -name '.env' -not -name '.env.local' -not -name '.DS_Store' -not -name '*.tsbuildinfo' -not -name '._*'"

local_files() { ( cd "$LOCAL_DIR" && find . -type f "${FILTER[@]}" | sed 's|^\./||' | LC_ALL=C sort ); }

# ---------------------------------------------------------------- dry-run
if [ "$MODE" = "dry-run" ]; then
  echo "==> [dry-run] 对比 $LOCAL_DIR  <->  ${NAS_USER}@${NAS_HOST}:${NAS_DIR}"
  ( cd "$LOCAL_DIR" && find . -type f "${FILTER[@]}" -print0 | xargs -0 shasum -a 256 | sed 's|  \./|  |' ) | LC_ALL=C sort -k2 > "$TMP/local.txt"
  nas "cd $NAS_DIR && find . -type f $RFILTER -print0 | xargs -0 sha256sum | sed 's|  \./|  |' | LC_ALL=C sort -k2" > "$TMP/remote.txt"
  DIFF="$(diff "$TMP/local.txt" "$TMP/remote.txt" || true)"
  if [ -z "$DIFF" ]; then
    echo "==> 本地与 NAS 源码完全一致，无需同步"
  else
    echo "==> 将发生的变化（< 本地新增/修改，> NAS 存在但本地已删除）："
    echo "$DIFF" | grep -E '^[<>]' | sed 's/^/    /' | head -50
    echo "    ... 共 $(echo "$DIFF" | grep -cE '^[<>]' || true) 行差异"
  fi
  exit 0
fi

# ---------------------------------------------------------------- 同步源码
echo "==> 同步源码  $LOCAL_DIR  ->  ${NAS_USER}@${NAS_HOST}:${NAS_DIR}"
local_files > "$TMP/manifest.txt"
COPYFILE_DISABLE=1 tar --no-xattrs -czf - "${EXCL_TAR[@]}" -C "$LOCAL_DIR" . | nas "cd $NAS_DIR && tar xzf -"
echo "    文件数: $(wc -l < "$TMP/manifest.txt" | tr -d ' ')"

# 清理 NAS 上本地已删除的文件（只在不影响 .env / exports / node_modules 的范围内）
nas "cat > /tmp/wushi-manifest.txt" < "$TMP/manifest.txt"
REMOVED="$(nas "cd $NAS_DIR && find . -type f $RFILTER | sed 's|^\./||' | LC_ALL=C sort > /tmp/wushi-remote.txt
  comm -13 /tmp/wushi-manifest.txt /tmp/wushi-remote.txt > /tmp/wushi-extra.txt || true
  if [ -s /tmp/wushi-extra.txt ]; then while IFS= read -r f; do rm -f \"\$f\"; done < /tmp/wushi-extra.txt; fi
  wc -l < /tmp/wushi-extra.txt | tr -d ' '")"
echo "    清理本地已删除的旧文件: ${REMOVED} 个"
echo "==> 源码同步完成"

if [ "$MODE" = "sync" ]; then
  echo "==> 仅同步完成，未重新构建（执行 ./deploy/deploy.sh 可完成构建+重启）"
  exit 0
fi

# ---------------------------------------------------------------- 构建 + 重启
# 构建前把当前运行镜像打个回滚标签，万一新版有问题可快速切回
PREV_IMG="$(nas "printf '%s\n' '$NAS_PASS' | sudo -S $NAS_DOCKER inspect --format '{{.Image}}' $NAS_CONTAINER 2>/dev/null" || true)"
if [ -n "$PREV_IMG" ]; then
  if nas "printf '%s\n' '$NAS_PASS' | sudo -S $NAS_DOCKER tag $PREV_IMG classroom-ai-app:rollback" >/dev/null 2>&1; then
    echo "==> 已保留上一版镜像 classroom-ai-app:rollback（${PREV_IMG#sha256:}）"
  else
    echo "!! 警告：未能打回滚标签，回滚需按镜像 ID 手动 docker tag"
  fi
fi
echo "==> 在 NAS 上重新构建并重启（docker compose up -d --build），预计 5-15 分钟..."
nas "cd $NAS_DIR && printf '%s\n' '$NAS_PASS' | sudo -S $NAS_COMPOSE up -d --build 2>&1 | tail -25"

# ---------------------------------------------------------------- 健康检查
echo "==> 健康检查 $APP_URL/"
ok=0; code=""
i=0
while [ "$i" -lt 120 ]; do
  i=$((i + 1))
  code="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$APP_URL/" || true)"
  if [ "$code" = "200" ]; then ok=1; break; fi
  sleep 5
done
if [ "$ok" != "1" ]; then
  echo "!! 健康检查失败：最后一次返回 ${code:-timeout}"
  echo "   排查: ssh $NAS_USER@$NAS_HOST 后执行"
  echo "   sudo $NAS_DOCKER logs --tail 50 $NAS_CONTAINER"
  exit 1
fi
echo "==> 应用已就绪（第 $i 次探测返回 200）"

echo "==> 容器状态"
nas "printf '%s\n' '$NAS_PASS' | sudo -S $NAS_DOCKER ps --filter name=classroom-ai --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' 2>/dev/null"

echo "==> 部署完成。请执行 ./deploy/check.sh 核对 本地 / NAS / 容器 三方一致，并更新迭代记录"
