#!/usr/bin/env bash
# 吾师 — 备份 NAS 数据库到本地 backups/
#
# 用法:
#   ./deploy/backup-db.sh            # 备份到 classroom-ai/backups/classroom_ai_<时间>.sql.gz
#   ./deploy/backup-db.sh --keep 5   # 备份后只保留最近 5 个本地备份
#
# 说明:
#   改动 prisma/schema.prisma 之前强烈建议先备份：容器启动脚本会执行
#   `npx prisma db push --accept-data-loss`，有丢数据风险。
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
set -a; source "$HERE/nas.env"; set +a
KEEP=10
if [ "${1:-}" = "--keep" ] && [ -n "${2:-}" ]; then KEEP="$2"; fi

SSH_OPTS=(-i "$NAS_KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
          -o ConnectTimeout=15 -o LogLevel=ERROR -o BatchMode=yes -o PreferredAuthentications=publickey)

OUT_DIR="$HERE/../backups"
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$OUT_DIR/classroom_ai_${STAMP}.sql.gz"

echo "==> 备份数据库 classroom_ai -> $OUT"
ssh "${SSH_OPTS[@]}" "$NAS_USER@$NAS_HOST" \
  "printf '%s\n' '$NAS_PASS' | sudo -S $NAS_DOCKER exec classroom-ai-db-1 pg_dump -U postgres classroom_ai" \
  | gzip > "$OUT"

echo "    大小: $(du -h "$OUT" | cut -f1)"
echo "    校验: $(gzip -t "$OUT" && echo 'gzip OK')，表数: $(gunzip -c "$OUT" | grep -c '^CREATE TABLE' || true)"

# 清理旧备份
COUNT="$(ls -1 "$OUT_DIR"/classroom_ai_*.sql.gz 2>/dev/null | wc -l | tr -d ' ')"
if [ "$COUNT" -gt "$KEEP" ]; then
  ls -1t "$OUT_DIR"/classroom_ai_*.sql.gz | tail -n +"$((KEEP + 1))" | while IFS= read -r f; do
    echo "    清理旧备份: $(basename "$f")"; rm -f "$f"
  done
fi
echo "==> 完成（本地共 $(ls -1 "$OUT_DIR"/classroom_ai_*.sql.gz | wc -l | tr -d ' ') 个备份）"
