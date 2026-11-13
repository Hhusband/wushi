#!/usr/bin/env bash
# 吾师 — 备份 NAS 上的课堂上传资料（uploads/）与导出文件（exports/）到本地
#
# 用法:
#   ./deploy/backup-files.sh            # 备份到 classroom-ai/backups/files_<时间>.tar.gz
#   ./deploy/backup-files.sh --keep 5   # 备份后只保留最近 5 个文件备份
#
# 说明:
#   uploads/ 与 exports/ 是线上数据（不参与代码同步，也不入库）。
#   资料在课堂结束时会自动清除，如需留档请在上课当天备份。
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
set -a; source "$HERE/nas.env"; set +a
KEEP=5
if [ "${1:-}" = "--keep" ] && [ -n "${2:-}" ]; then KEEP="$2"; fi

SSH_OPTS=(-i "$NAS_KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
          -o ConnectTimeout=15 -o LogLevel=ERROR -o BatchMode=yes -o PreferredAuthentications=publickey)

OUT_DIR="$HERE/../backups"
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$OUT_DIR/files_${STAMP}.tar.gz"

echo "==> 备份 NAS 文件（uploads/ + exports/）-> $OUT"
ssh "${SSH_OPTS[@]}" "$NAS_USER@$NAS_HOST" \
  "cd $NAS_DIR && printf '%s\n' '$NAS_PASS' | sudo -S $NAS_DOCKER run --rm -v \"\$PWD/uploads:/src/uploads:ro\" -v \"\$PWD/exports:/src/exports:ro\" -w /src alpine:3.20 tar czf - uploads exports" \
  > "$OUT"

echo "    大小: $(du -h "$OUT" | cut -f1)"
echo "    校验: $(gzip -t "$OUT" && echo 'gzip OK')，文件数: $(tar tzf "$OUT" | grep -vc '/$' || true)"

# 清理旧备份
COUNT="$(ls -1 "$OUT_DIR"/files_*.tar.gz 2>/dev/null | wc -l | tr -d ' ')"
if [ "$COUNT" -gt "$KEEP" ]; then
  ls -1t "$OUT_DIR"/files_*.tar.gz | tail -n +"$((KEEP + 1))" | while IFS= read -r f; do
    echo "    清理旧备份: $(basename "$f")"; rm -f "$f"
  done
fi
echo "==> 完成（本地共 $(ls -1 "$OUT_DIR"/files_*.tar.gz 2>/dev/null | wc -l | tr -d ' ') 个文件备份）"
