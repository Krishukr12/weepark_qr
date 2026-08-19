# Build from the repo root:
#   docker buildx build --platform linux/amd64 --load -f backend/Dockerfile -t weepark-backend-qr:latest .
#
# Secrets come from --env-file at runtime, not from this image.

# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY backend/prisma ./backend/prisma

RUN pnpm install --frozen-lockfile

COPY backend ./backend
RUN pnpm --filter weepark-backend exec prisma generate \
  && pnpm --filter weepark-backend build \
  && pnpm --filter weepark-backend deploy --prod /out \
  && cp -r /app/backend/prisma /out/prisma \
  && cp -r /app/backend/assets /out/assets \
  && pnpm --filter weepark-backend exec prisma generate --schema=/out/prisma/schema.prisma \
  && test -n "$(find /out -name 'libquery_engine*' -o -name '*query_engine-windows*' | head -1)"

# ---- Production stage ----
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out ./
EXPOSE 4000
CMD ["node", "dist/index.js"]
