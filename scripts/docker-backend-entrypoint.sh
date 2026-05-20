#!/bin/sh
set -e

cd /app/packages/backend

echo "Running database migrations..."
prisma migrate deploy

echo "Starting API server..."
exec node dist/index.js
