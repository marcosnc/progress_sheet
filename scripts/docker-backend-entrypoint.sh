#!/bin/sh
set -e

cd /app

echo "Running database migrations..."
pnpm --filter backend exec prisma migrate deploy

echo "Starting API server..."
cd packages/backend
exec node dist/index.js
