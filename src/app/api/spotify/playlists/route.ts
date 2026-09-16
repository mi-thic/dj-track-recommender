import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  addTracksToPlaylist,
  createPlaylist,
  getCurrentUser,
  SpotifyApiError,
} from "@/lib/spotify/api";
import { getUserAccessToken, SpotifyAuthError } from "@/lib/spotify/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_TRACKS = 500;

/**
 * POST /api/spotify/playlists
 *
 * body: { name: string, description?: string, public?: boolean, trackIds: string[] }
 *
 * セットリストを Spotify のプレイリストとして作成する。
 * trackIds の順番がそのままプレイリストの曲順になる。
 */
export async function POST(request: NextRequest) {
  let body: {
    name?: unknown;
    description?: unknown;
    public?: unknown;
    trackIds?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正な JSON です" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "プレイリスト名を入力してください" }, { status: 400 });
  }
  if (name.length > 100) {
    return NextResponse.json({ error: "プレイリスト名は 100 文字以内にしてください" }, { status: 400 });
  }

  const description = typeof body.description === "string" ? body.description.slice(0, 300) : "";
  const isPublic = body.public === true;

  const trackIds = Array.isArray(body.trackIds)
    ? body.trackIds.filter((value): value is string => typeof value === "string")
    : [];
  if (trackIds.length === 0) {
    return NextResponse.json({ error: "曲が 1 曲も指定されていません" }, { status: 400 });
  }
  if (trackIds.length > MAX_TRACKS) {
    return NextResponse.json(
      { error: `一度に書き出せるのは ${MAX_TRACKS} 曲までです` },
      { status: 400 },
    );
  }

  try {
    const userToken = await getUserAccessToken();
    if (!userToken) {
      return NextResponse.json(
        { error: "Spotify と連携していません。設定画面から連携してください。" },
        { status: 401 },
      );
    }

    const tracks = await prisma.track.findMany({
      where: { id: { in: trackIds } },
      select: { id: true, title: true, artist: true, spotifyId: true },
    });
    const byId = new Map(tracks.map((track) => [track.id, track]));

    // セットの順番を保ったまま、紐付け済みのものだけ URI 化する
    const uris: string[] = [];
    const missing: Array<{ title: string; artist: string }> = [];
    for (const id of trackIds) {
      const track = byId.get(id);
      if (!track) continue;
      if (track.spotifyId) {
        uris.push(`spotify:track:${track.spotifyId}`);
      } else {
        missing.push({ title: track.title, artist: track.artist });
      }
    }

    if (uris.length === 0) {
      return NextResponse.json(
        {
          error:
            "Spotify に紐付いている曲がありません。先に「Spotify と紐付け」で曲をマッチングしてください。",
          missing,
        },
        { status: 400 },
      );
    }

    const user = await getCurrentUser(userToken);
    const playlist = await createPlaylist(userToken, user.id, name, description, isPublic);
    const added = await addTracksToPlaylist(userToken, playlist.id, uris);

    return NextResponse.json({
      playlist,
      added,
      missing,
      public: isPublic,
    });
  } catch (error) {
    if (error instanceof SpotifyAuthError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof SpotifyApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[POST /api/spotify/playlists]", error);
    return NextResponse.json({ error: "プレイリストの作成に失敗しました" }, { status: 500 });
  }
}
