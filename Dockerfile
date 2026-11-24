FROM node:24.21.0-bookworm-slim AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*


FROM base AS dependencies

COPY package.json package-lock.json ./

RUN npm ci


FROM base AS builder

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" npx prisma generate

RUN DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" npm run build -- --webpack


FROM node:24.21.0-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public

RUN mkdir -p .next \
    && mkdir -p /app/storage \
    && chown -R nextjs:nodejs .next \
    && chown -R nextjs:nodejs /app/storage

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]