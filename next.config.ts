import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 用の自己完結ビルド出力（.next/standalone）
  output: "standalone",
  // Prisma Client はバンドルせず Node のランタイムから require させる
  serverExternalPackages: ["@prisma/client"],
  // 生成済み Prisma Client（クエリエンジンのバイナリを含む）を standalone に同梱する
  outputFileTracingIncludes: {
    "/**/*": ["./src/generated/prisma/**/*"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
