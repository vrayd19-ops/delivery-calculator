FROM node:22-alpine AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1


FROM base AS deps

COPY package.json package-lock.json ./

RUN npm ci


FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules

COPY . .

ARG NEXT_PUBLIC_YANDEX_MAPS_API_KEY

ENV NEXT_PUBLIC_YANDEX_MAPS_API_KEY=$NEXT_PUBLIC_YANDEX_MAPS_API_KEY

RUN npx prisma generate

RUN npm run build


FROM base AS migrator

COPY --from=deps /app/node_modules ./node_modules

COPY package.json package-lock.json ./

COPY prisma ./prisma

COPY prisma.config.ts ./prisma.config.ts

CMD ["npx", "prisma", "migrate", "deploy"]


FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs

RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]