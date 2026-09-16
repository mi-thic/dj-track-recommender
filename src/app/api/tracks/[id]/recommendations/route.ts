import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { recommendNextTracks } from "@/lib/recommend";
import { toTrackDTO } from "@/lib/types";
import { formatZodError, recommendQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/tracks/:id/recommendations
 *
 * クエリ:
 *   limit, maxPitchPercent, allowHalfDouble, keyCompatibleOnly,
 *   minScore, genre, excludeIds(カンマ区切り), weightBpm/weightKey/weightEnergy
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = request.nextUrl;

  const parsed = recommendQuerySchema.safeParse({
    limit: searchParams.get("limit") ?? undefined,
    maxPitchPercent: searchParams.get("maxPitchPercent") ?? undefined,
    allowHalfDouble: searchParams.get("allowHalfDouble") ?? undefined,
    keyCompatibleOnly: searchParams.get("keyCompatibleOnly") ?? undefined,
    minScore: searchParams.get("minScore") ?? undefined,
    genre: searchParams.get("genre") ?? undefined,
    excludeIds: searchParams.get("excludeIds") ?? undefined,
    weightBpm: searchParams.get("weightBpm") ?? undefined,
    weightKey: searchParams.get("weightKey") ?? undefined,
    weightEnergy: searchParams.get("weightEnergy") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "クエリパラメータが不正です", issues: formatZodError(parsed.error) },
      { status: 422 },
    );
  }

  const query = parsed.data;

  const from = await prisma.track.findUnique({ where: { id } });
  if (!from) {
    return NextResponse.json({ error: "楽曲が見つかりません" }, { status: 404 });
  }

  // ハーモニック適合だけで拾える候補もあるため BPM での事前絞り込みはしない。
  // （個人のライブラリ規模ではこれで十分に高速）
  const candidates = await prisma.track.findMany({
    where: { id: { not: id } },
  });

  const weights =
    query.weightBpm !== undefined ||
    query.weightKey !== undefined ||
    query.weightEnergy !== undefined
      ? {
          ...(query.weightBpm !== undefined ? { bpm: query.weightBpm } : {}),
          ...(query.weightKey !== undefined ? { key: query.weightKey } : {}),
          ...(query.weightEnergy !== undefined ? { energy: query.weightEnergy } : {}),
        }
      : undefined;

  const recommendations = recommendNextTracks(toTrackDTO(from), candidates.map(toTrackDTO), {
    limit: query.limit,
    maxPitchPercent: query.maxPitchPercent,
    allowHalfDouble: query.allowHalfDouble,
    keyCompatibleOnly: query.keyCompatibleOnly,
    minScore: query.minScore,
    genre: query.genre,
    excludeIds: query.excludeIds,
    weights,
  });

  return NextResponse.json({
    from: toTrackDTO(from),
    count: recommendations.length,
    recommendations,
  });
}
