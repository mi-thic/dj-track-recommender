import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/spotify/api";
import { exchangeCodeForTokens, saveAccount, verifyOAuthState } from "@/lib/spotify/auth";

export const dynamic = "force-dynamic";

/** 結果を /spotify に伝えてリダイレクトする */
function redirectToSettings(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/spotify", request.nextUrl.origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

/** GET /api/spotify/callback — 認可コードをトークンに交換して保存する */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const spotifyError = searchParams.get("error");
  if (spotifyError) {
    return redirectToSettings(request, {
      status: "error",
      message: `Spotify 側で拒否されました: ${spotifyError}`,
    });
  }

  if (!verifyOAuthState(searchParams.get("state"))) {
    return redirectToSettings(request, {
      status: "error",
      message: "state の検証に失敗しました。もう一度やり直してください。",
    });
  }

  const code = searchParams.get("code");
  if (!code) {
    return redirectToSettings(request, {
      status: "error",
      message: "認可コードが返ってきませんでした",
    });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      return redirectToSettings(request, {
        status: "error",
        message: "リフレッシュトークンが返りませんでした",
      });
    }

    const user = await getCurrentUser(tokens.access_token);
    await saveAccount({
      spotifyUserId: user.id,
      displayName: user.displayName,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scope: tokens.scope ?? "",
      expiresInSeconds: tokens.expires_in,
    });

    return redirectToSettings(request, {
      status: "connected",
      message: `${user.displayName ?? user.id} として連携しました`,
    });
  } catch (error) {
    console.error("[GET /api/spotify/callback]", error);
    return redirectToSettings(request, {
      status: "error",
      message: error instanceof Error ? error.message : "連携に失敗しました",
    });
  }
}
