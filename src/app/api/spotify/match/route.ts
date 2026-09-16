import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { searchTracks, SpotifyApiError, type SpotifyTrack } from "@/lib/spotify/api";
import { SpotifyAuthError } from "@/lib/spotify/auth";
import { rankCandidates, type MatchScore } from "@/lib/spotify/match";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** 1 回のリクエストで処理する上限（Spotify のレート制限に配慮） */
const MAX_BATCH = 100;
/** 検索の間隔（ミリ秒） */
const REQUEST_INTERVAL_MS = 120;

type MatchAction = "link" | "manual" | "none";

interface MatchRow {
  trackId: string;
  title: string;
  artist: string;
  action: MatchAction;
  best: { candidate: SpotifyTrack; match: MatchScore } | null;
  alternatives: Array<{ candidate: SpotifyTrack; match: MatchScore }>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * POST /api/spotify/match
 *
 * body: { dryRun?: boolean, limit?: number, trackIds?: string[] }
 *
 * 未紐付けの曲を Spotify で検索し、十分に一致するものを自動で紐付ける。
 * dryRun（既定 true）なら書き込まずに結果だけ返す。
 */
export async function POST(request: NextRequest) {
  let body: { dryRun?: unknown; limit?: unknown; trackIds?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* ボディなしも許容する */
  }

  const dryRun = body.dryRun !== false;
  const limitRaw = Number(body.limit);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(MAX_BATCH, Math.max(1, Math.round(limitRaw)))
    : MAX_BATCH;
  const trackIds = Array.isArray(body.trackIds)
    ? body.trackIds.filter((value): value is string => typeof value === "string")
    : null;

  const tracks = await prisma.track.findMany({
    where: trackIds ? { id: { in: trackIds } } : { spotifyId: null },
    orderBy: [{ artist: "asc" }, { title: "asc" }],
    take: limit,
  });

  // 既に使われている Spotify ID は重複紐付けを避けるため除外する
  const used = new Set(
    (
      await prisma.track.findMany({
        where: { spotifyId: { not: null } },
        select: { spotifyId: true },
      })
    )
      .map((row) => row.spotifyId)
      .filter((value): value is string => value !== null),
  );

  const rows: MatchRow[] = [];

  try {
    for (const [index, track] of tracks.entries()) {
      if (index > 0) await sleep(REQUEST_INTERVAL_MS);

      const candidates = await searchTracks(track.title, track.artist, 5);
      const ranked = rankCandidates(
        { title: track.title, artist: track.artist, durationSec: track.durationSec },
        candidates,
      ).filter((entry) => !used.has(entry.candidate.id));

      const best = ranked[0] ?? null;
      let action: MatchAction = "none";
      if (best) action = best.match.confident ? "link" : "manual";

      if (action === "link" && best && !dryRun) {
        await prisma.track.update({
          where: { id: track.id },
          data: {
            spotifyId: best.candidate.id,
            spotifyUrl: best.candidate.url,
            albumArtUrl: best.candidate.albumArtUrl,
            isrc: best.candidate.isrc,
            ...(track.releaseYear === null && best.candidate.releaseYear !== null
              ? { releaseYear: best.candidate.releaseYear }
              : {}),
          },
        });
        used.add(best.candidate.id);
      }

      rows.push({
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        action,
        best,
        alternatives: ranked.slice(1, 4),
      });
    }
  } catch (error) {
    if (error instanceof SpotifyAuthError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof SpotifyApiError) {
      // 途中まで処理できた分は返す
      return NextResponse.json(
        {
          error: error.message,
          partial: true,
          dryRun,
          processed: rows.length,
          results: rows,
        },
        { status: error.status },
      );
    }
    console.error("[POST /api/spotify/match]", error);
    return NextResponse.json({ error: "マッチングに失敗しました" }, { status: 500 });
  }

  const remaining = await prisma.track.count({ where: { spotifyId: null } });

  return NextResponse.json({
    dryRun,
    processed: rows.length,
    summary: {
      link: rows.filter((row) => row.action === "link").length,
      manual: rows.filter((row) => row.action === "manual").length,
      none: rows.filter((row) => row.action === "none").length,
    },
    remaining,
    results: rows,
  });
}
