import { NextResponse, type NextRequest } from "next/server";

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getTrackById, SpotifyApiError } from "@/lib/spotify/api";
import { SpotifyAuthError } from "@/lib/spotify/auth";
import { toTrackDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/tracks/:id/spotify — body: { spotifyId } で Spotify の曲を紐付ける */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  let body: { spotifyId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正な JSON です" }, { status: 400 });
  }

  const spotifyId = typeof body.spotifyId === "string" ? body.spotifyId.trim() : "";
  if (!spotifyId) {
    return NextResponse.json({ error: "spotifyId が必要です" }, { status: 400 });
  }

  const track = await prisma.track.findUnique({ where: { id } });
  if (!track) {
    return NextResponse.json({ error: "楽曲が見つかりません" }, { status: 404 });
  }

  try {
    const spotifyTrack = await getTrackById(spotifyId);
    if (!spotifyTrack) {
      return NextResponse.json({ error: "Spotify にその曲が見つかりません" }, { status: 404 });
    }

    const updated = await prisma.track.update({
      where: { id },
      data: {
        spotifyId: spotifyTrack.id,
        spotifyUrl: spotifyTrack.url,
        albumArtUrl: spotifyTrack.albumArtUrl,
        isrc: spotifyTrack.isrc,
        // 未入力のときだけ Spotify 側の情報で補う
        ...(track.releaseYear === null && spotifyTrack.releaseYear !== null
          ? { releaseYear: spotifyTrack.releaseYear }
          : {}),
        ...(track.durationSec === null && spotifyTrack.durationSec > 0
          ? { durationSec: spotifyTrack.durationSec }
          : {}),
      },
    });

    return NextResponse.json({ track: toTrackDTO(updated) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "その Spotify の曲は既に別の楽曲に紐付いています" },
        { status: 409 },
      );
    }
    if (error instanceof SpotifyAuthError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof SpotifyApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[POST /api/tracks/:id/spotify]", error);
    return NextResponse.json({ error: "紐付けに失敗しました" }, { status: 500 });
  }
}

/** DELETE /api/tracks/:id/spotify — 紐付けを解除する */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const updated = await prisma.track.update({
      where: { id },
      data: { spotifyId: null, spotifyUrl: null, albumArtUrl: null, isrc: null },
    });
    return NextResponse.json({ track: toTrackDTO(updated) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "楽曲が見つかりません" }, { status: 404 });
    }
    console.error("[DELETE /api/tracks/:id/spotify]", error);
    return NextResponse.json({ error: "紐付け解除に失敗しました" }, { status: 500 });
  }
}
