#!/bin/sh
set -e

echo "🔍 Waiting for PostgreSQL..."
until nc -z ${POSTGRES_HOST:-postgres} ${POSTGRES_PORT:-5432} 2>/dev/null; do
  sleep 1
done
echo "✅ PostgreSQL is ready"

echo "🔍 Waiting for Redis..."
until nc -z ${REDIS_HOST:-redis} ${REDIS_PORT:-6379} 2>/dev/null; do
  sleep 1
done
echo "✅ Redis is ready"

echo "✅ Redis is ready"

# Prisma generate is done in build stage
# Prisma generate is done in build stage (but needed for dev mode if volumes override)
echo "🔄 Running Prisma generate..."
npx prisma generate

echo "🚀 Starting application..."
exec "$@"
