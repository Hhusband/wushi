#!/bin/sh
set -e

# Ensure exports directory exists and is writable
mkdir -p /app/exports
chmod 777 /app/exports 2>/dev/null || true

echo "Running database push..."
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@db:5432/classroom_ai}"
npx prisma db push --url="$DB_URL" --accept-data-loss

echo "Starting Classroom AI..."
exec npx tsx server.ts
