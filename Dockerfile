# syntax=docker/dockerfile:1
# Multi-stage build — run this in CI (GitHub Actions). Dokploy only pulls the final image.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# Skip postinstall (prisma generate) — schema is not copied yet
RUN npm install --ignore-scripts

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Dokploy writes .env before build; local builds without one get an empty placeholder.
RUN test -f .env || touch .env
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# DATABASE_URL is only needed so Prisma can resolve config during generate; migrations run at container start.
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/steward?schema=public"
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next.js standalone server
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma CLI + config deps for `prisma migrate deploy` (not bundled in Next standalone)
RUN npm install prisma@7.8.0 dotenv --ignore-scripts && npm cache clean --force \
  && chown -R nextjs:nodejs /app/node_modules

# Prisma: schema, migrations, generated client, config
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/package.json ./package.json

COPY --chown=nextjs:nodejs scripts/docker-entrypoint.js /app/docker-entrypoint.js
# Runtime secrets: baked from Dokploy-generated .env at build time, or use docker run --env-file locally.
COPY --from=builder --chown=nextjs:nodejs /app/.env ./.env

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["node", "/app/docker-entrypoint.js"]
CMD ["node", "server.js"]

