import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAccount } from "@/lib/spotify/auth";
import { getSpotifyConfig, SPOTIFY_SCOPES } from "@/lib/spotify/config";

export const dynamic = "force-dynamic";

/** GET /api/spotify/status — 設定状況と連携状況 */
export async function GET() {
  const config = getSpotifyConfig();
  const account = config ? await getAccount() : null;

  const [total, linked] = await Promise.all([
    prisma.track.count(),
    prisma.track.count({ where: { spotifyId: { not: null } } }),
  ]);

  return NextResponse.json({
    configured: config !== null,
    redirectUri: config?.redirectUri ?? null,
    requiredScopes: SPOTIFY_SCOPES,
    account,
    tracks: { total, linked, unlinked: total - linked },
  });
}
