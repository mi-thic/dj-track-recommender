import { NextResponse } from "next/server";

import { buildAuthorizeUrl, createOAuthState, SpotifyAuthError } from "@/lib/spotify/auth";

export const dynamic = "force-dynamic";

/** GET /api/spotify/connect — Spotify の認可画面へリダイレクトする */
export async function GET() {
  try {
    const url = buildAuthorizeUrl(createOAuthState());
    return NextResponse.redirect(url);
  } catch (error) {
    if (error instanceof SpotifyAuthError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[GET /api/spotify/connect]", error);
    return NextResponse.json({ error: "認可 URL を作成できませんでした" }, { status: 500 });
  }
}
