# syntax=docker/dockerfile:1

############################
# 共通ベース
############################
FROM node:22-alpine AS base
# Prisma のクエリエンジンは OpenSSL に依存する
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

############################
# 依存関係
############################
FROM base AS deps
COPY package.json package-lock.json* ./
# postinstall の prisma generate に schema が必要
COPY prisma ./prisma
RUN npm install

############################
# 開発サーバー (hot reload)
############################
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

############################
# 本番ビルド
############################
FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

############################
# 本番ランタイム (standalone)
############################
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
