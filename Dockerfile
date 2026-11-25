FROM node:22-alpine AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1


# ==========================================
# DEPENDENCIES
# ==========================================

FROM base AS deps

COPY package.json package-lock.json ./

RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm ci


# ==========================================
# BUILD
# ==========================================

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules

COPY . .

ARG NEXT_PUBLIC_YANDEX_MAPS_API_KEY

ENV NEXT_PUBLIC_YANDEX_MAPS_API_KEY=$NEXT_PUBLIC_YANDEX_MAPS_API_KEY

ARG DATABASE_URL=postgresql://postgres:postgres@postgres:5432/delivery_calculator

ENV DATABASE_URL=$DATABASE_URL

RUN npx prisma generate

RUN npm run build


# ==========================================
# PRODUCTION RUNNER
# ==========================================

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0


RUN addgroup --system --gid 1001 nodejs

RUN adduser --system --uid 1001 nextjs


# ==========================================
# NEXT.JS
# ==========================================

COPY --from=builder /app/public ./public

COPY --from=builder \
    --chown=nextjs:nodejs \
    /app/.next/standalone ./

COPY --from=builder \
    --chown=nextjs:nodejs \
    /app/.next/static ./.next/static


# ==========================================
# NODE MODULES
# Нужны Prisma CLI + OCR
# ==========================================

COPY --from=deps \
    --chown=nextjs:nodejs \
    /app/node_modules ./node_modules


# ==========================================
# PRISMA
# Нужны для prisma migrate deploy
# ==========================================

COPY --from=builder \
    --chown=nextjs:nodejs \
    /app/prisma ./prisma

COPY --from=builder \
    --chown=nextjs:nodejs \
    /app/prisma.config.ts ./prisma.config.ts

COPY --from=builder \
    --chown=nextjs:nodejs \
    /app/package.json ./package.json

COPY --from=builder \
    --chown=nextjs:nodejs \
    /app/package-lock.json ./package-lock.json


# ==========================================
# LOCAL OCR MODELS FOR TESSERACT
# ==========================================

RUN mkdir -p \
    /app/node_modules/@tesseract.js-data/rus/4.0.0_best_int \
    /app/node_modules/@tesseract.js-data/eng/4.0.0_best_int


COPY --from=deps \
    --chown=nextjs:nodejs \
    /app/node_modules/@tesseract.js-data/rus/4.0.0_best_int/rus.traineddata.gz \
    /app/node_modules/@tesseract.js-data/rus/4.0.0_best_int/rus.traineddata.gz


COPY --from=deps \
    --chown=nextjs:nodejs \
    /app/node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz \
    /app/node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz


USER nextjs

EXPOSE 3000


# ==========================================
# DATABASE MIGRATIONS + NEXT.JS
# ==========================================

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]