# syntax=docker/dockerfile:1

############################
# 共通ベース
############################
# NOTE: Alpine (musl) ではなく Debian (glibc) を使う。
# lightningcss などのネイティブバイナリは libc ごとに別パッケージになっており、
# musl 上で生成した package-lock.json には glibc 用が記録されない。
# CI・macOS・一般的な Linux と libc を揃えることで lockfile を 1 本に保つ。
FROM node:25-slim AS base
# Prisma のクエリエンジンは OpenSSL に依存する
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

############################
# 依存関係
############################
FROM base AS deps
COPY package.json package-lock.json ./
# postinstall の prisma generate に schema が必要
COPY prisma ./prisma
RUN npm ci

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

RUN groupadd -g 1001 nodejs && useradd -m -u 1001 -g nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
