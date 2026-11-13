#!/bin/sh
set -e

# Ensure exports directory exists and is writable
mkdir -p /app/exports
chmod 777 /app/exports 2>/dev/null || true

# 课堂资料上传目录（容器重建后保留在挂载卷上；清理 1 天前的残留课堂目录）
mkdir -p /app/uploads
chmod 777 /app/uploads 2>/dev/null || true
find /app/uploads -mindepth 1 -maxdepth 1 -type d -mtime +1 -exec rm -rf {} + 2>/dev/null || true

echo "Running database push..."
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@db:5432/classroom_ai}"
npx prisma db push --url="$DB_URL" --accept-data-loss

echo "Starting Classroom AI..."
exec npx tsx server.ts
