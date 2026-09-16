import { NextResponse, type NextRequest } from "next/server";

import { searchTracks, searchTracksRaw, SpotifyApiError } from "@/lib/spotify/api";
import { SpotifyAuthError } from "@/lib/spotify/auth";
import { rankCandidates } from "@/lib/spotify/match";

export const dynamic = "force-dynamic";

/**
 * GET /api/spotify/search
 *   ?q=...                     フリーワード検索
 *   ?title=...&artist=...      タイトル/アーティスト指定（一致度も返す）
 *   &durationSec=...           曲尺が分かれば一致度の精度が上がる
 *   &limit=1-20
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim();
  const title = searchParams.get("title")?.trim();
  const artist = searchParams.get("artist")?.trim() ?? "";
  const durationRaw = Number(searchParams.get("durationSec"));
  const durationSec = Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : null;

  const limitRaw = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) ? Math.min(20, Math.max(1, limitRaw)) : 10;

  if (!q && !title) {
    return NextResponse.json(
      { error: "q または title を指定してください" },
      { status: 400 },
    );
  }

  try {
    const candidates = q
      ? await searchTracksRaw(q, limit)
      : await searchTracks(title!, artist || null, limit);

    if (!title) {
      return NextResponse.json({ results: candidates.map((candidate) => ({ candidate })) });
    }

    const ranked = rankCandidates({ title, artist, durationSec }, candidates);
    return NextResponse.json({ results: ranked });
  } catch (error) {
    if (error instanceof SpotifyAuthError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof SpotifyApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[GET /api/spotify/search]", error);
    return NextResponse.json({ error: "検索に失敗しました" }, { status: 500 });
  }
}
