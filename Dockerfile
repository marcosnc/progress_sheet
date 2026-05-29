# syntax=docker/dockerfile:1.4
# Multi-target: backend | web (shared deps layer — one pnpm install for both)
# Local:  docker compose build
# Coolify: prefer docker-compose.coolify.yml (pre-built images from GitHub Actions)

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# --- deps (shared by backend + web targets) ---
FROM base AS deps
COPY .npmrc pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/backend/package.json packages/backend/
COPY packages/shared/package.json packages/shared/
COPY packages/web/package.json packages/web/
COPY packages/mobile/package.json packages/mobile/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter backend... --filter web...

FROM deps AS shared-builder
COPY packages/shared packages/shared
RUN pnpm --filter @progress-sheet/shared build

# --- backend ---
FROM shared-builder AS backend-builder
COPY packages/backend packages/backend
RUN pnpm --filter backend exec prisma generate \
 && pnpm --filter backend build

FROM node:20-alpine AS backend
WORKDIR /app
ENV NODE_ENV=production

# Prisma CLI for migrate deploy (pnpm .bin symlinks are unreliable in copied node_modules)
RUN npm install -g prisma@6

COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/packages/backend/node_modules ./packages/backend/node_modules
COPY --from=backend-builder /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=backend-builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=backend-builder /app/packages/backend/prisma ./packages/backend/prisma
COPY --from=backend-builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=backend-builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=backend-builder /app/packages/backend/package.json ./packages/backend/package.json

COPY scripts/docker-backend-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/entrypoint.sh"]

# --- web ---
FROM shared-builder AS web-builder
ARG NEXT_PUBLIC_API_URL=/api
# Bust GHA/buildx cache when the public API URL changes (ARG alone may not invalidate RUN).
ARG CACHE_BUST=1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NODE_OPTIONS=--max-old-space-size=2048
COPY packages/web packages/web
RUN echo "NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} CACHE_BUST=${CACHE_BUST}" \
 && pnpm --filter web build

FROM node:20-alpine AS web
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=web-builder /app/packages/web/public ./packages/web/public
COPY --from=web-builder --chown=nextjs:nodejs /app/packages/web/.next/standalone ./
COPY --from=web-builder --chown=nextjs:nodejs /app/packages/web/.next/static ./packages/web/.next/static

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "packages/web/server.js"]
