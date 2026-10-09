FROM node:22-alpine AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1


FROM base AS deps

COPY package.json package-lock.json ./

RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm ci


FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules

COPY . .

ARG NEXT_PUBLIC_YANDEX_MAPS_API_KEY
ENV NEXT_PUBLIC_YANDEX_MAPS_API_KEY=$NEXT_PUBLIC_YANDEX_MAPS_API_KEY

ARG DATABASE_URL=postgresql://postgres:postgres@postgres:5432/delivery_calculator
ENV DATABASE_URL=$DATABASE_URL

RUN npx prisma generate

RUN npm run build


FROM base AS migrator

COPY --from=deps /app/node_modules ./node_modules

COPY package.json package-lock.json ./

COPY prisma ./prisma

COPY prisma.config.ts ./prisma.config.ts

ARG DATABASE_URL=postgresql://postgres:postgres@postgres:5432/delivery_calculator
ENV DATABASE_URL=$DATABASE_URL

RUN npx prisma generate

CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:seed"]


FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs

RUN adduser --system --uid 1001 nextjs


# ==========================================
# FULL RUNTIME DEPENDENCIES
# ==========================================

COPY --from=deps \
    --chown=nextjs:nodejs \
    /app/node_modules \
    ./node_modules


# ==========================================
# NEXT.JS STANDALONE
# ==========================================

COPY --from=builder \
    --chown=nextjs:nodejs \
    /app/.next/standalone \
    ./

COPY --from=builder \
    --chown=nextjs:nodejs \
    /app/.next/static \
    ./.next/static

COPY --from=builder \
    --chown=nextjs:nodejs \
    /app/public \
    ./public


# ==========================================
# PDF.JS WORKER
# ==========================================

RUN mkdir -p /app/.next/server/chunks

COPY --from=deps \
    --chown=nextjs:nodejs \
    /app/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs \
    /app/.next/server/chunks/pdf.worker.mjs


USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]