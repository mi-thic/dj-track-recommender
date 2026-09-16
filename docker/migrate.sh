#!/bin/sh
# DB スキーマを適用してからアプリを起動するためのスクリプト。
# マイグレーションファイルがあれば migrate deploy、なければ db push でフォールバックする。
set -e

echo "[migrate] prisma generate"
npx prisma generate

if [ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "[migrate] prisma migrate deploy"
  npx prisma migrate deploy
else
  echo "[migrate] マイグレーションが無いため prisma db push を実行します"
  npx prisma db push
fi

if [ "$SEED_ON_START" = "true" ]; then
  echo "[migrate] シードを実行します"
  npx prisma db seed || echo "[migrate] シードをスキップしました"
fi

echo "[migrate] 完了"
