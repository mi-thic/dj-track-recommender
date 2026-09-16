import { createHmac, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";

import { getSpotifyConfig, SPOTIFY_SCOPES, type SpotifyConfig } from "./config";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const ACCOUNT_ID = "singleton";

/** アクセストークンの期限が切れる何ミリ秒前に更新するか */
const REFRESH_MARGIN_MS = 60_000;
/** OAuth の state の有効期間 */
const STATE_TTL_MS = 10 * 60_000;

export class SpotifyAuthError extends Error {}

function basicAuth(config: SpotifyConfig): string {
  return Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
}

function requireConfig(): SpotifyConfig {
  const config = getSpotifyConfig();
  if (!config) {
    throw new SpotifyAuthError(
      "Spotify の設定がありません。.env に SPOTIFY_CLIENT_ID と SPOTIFY_CLIENT_SECRET を設定してください。",
    );
  }
  return config;
}

/* ------------------------------------------------------------------ */
/* CSRF 対策の state                                                    */
/* ------------------------------------------------------------------ */

/**
 * state を HMAC で自己検証可能にする。
 * localhost と 127.0.0.1 でオリジンが変わり Cookie が引き継がれないため、
 * サーバー側に保存せず署名だけで検証する。
 */
export function createOAuthState(): string {
  const config = requireConfig();
  const issuedAt = Date.now().toString(36);
  const signature = createHmac("sha256", config.clientSecret).update(issuedAt).digest("hex");
  return `${issuedAt}.${signature}`;
}

export function verifyOAuthState(state: string | null): boolean {
  if (!state) return false;
  const config = getSpotifyConfig();
  if (!config) return false;

  const [issuedAt, signature] = state.split(".");
  if (!issuedAt || !signature) return false;

  const expected = createHmac("sha256", config.clientSecret).update(issuedAt).digest("hex");
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const age = Date.now() - parseInt(issuedAt, 36);
  return Number.isFinite(age) && age >= 0 && age < STATE_TTL_MS;
}

export function buildAuthorizeUrl(state: string): string {
  const config = requireConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    scope: SPOTIFY_SCOPES.join(" "),
    redirect_uri: config.redirectUri,
    state,
    show_dialog: "false",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/* ------------------------------------------------------------------ */
/* トークン取得                                                        */
/* ------------------------------------------------------------------ */

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
  const config = requireConfig();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(config)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      detail = parsed.error_description ?? parsed.error ?? text;
    } catch {
      /* JSON でなければ本文をそのまま使う */
    }
    throw new SpotifyAuthError(`Spotify のトークン取得に失敗しました (${response.status}): ${detail}`);
  }

  return JSON.parse(text) as TokenResponse;
}

/* --- アプリ用トークン（Client Credentials）: 検索に使う --- */

let appToken: { value: string; expiresAt: number } | null = null;

export async function getAppAccessToken(): Promise<string> {
  if (appToken && appToken.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return appToken.value;
  }

  const token = await requestToken(new URLSearchParams({ grant_type: "client_credentials" }));
  appToken = {
    value: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  };
  return appToken.value;
}

/* --- ユーザー用トークン（Authorization Code）: プレイリスト作成に使う --- */

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const config = requireConfig();
  return requestToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    }),
  );
}

export interface SpotifyAccountSummary {
  spotifyUserId: string;
  displayName: string | null;
  scope: string;
  connectedAt: string;
}

export async function saveAccount(input: {
  spotifyUserId: string;
  displayName: string | null;
  accessToken: string;
  refreshToken: string;
  scope: string;
  expiresInSeconds: number;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
  await prisma.spotifyAccount.upsert({
    where: { id: ACCOUNT_ID },
    create: {
      id: ACCOUNT_ID,
      spotifyUserId: input.spotifyUserId,
      displayName: input.displayName,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      scope: input.scope,
      expiresAt,
    },
    update: {
      spotifyUserId: input.spotifyUserId,
      displayName: input.displayName,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      scope: input.scope,
      expiresAt,
    },
  });
}

export async function getAccount(): Promise<SpotifyAccountSummary | null> {
  const account = await prisma.spotifyAccount.findUnique({ where: { id: ACCOUNT_ID } });
  if (!account) return null;
  return {
    spotifyUserId: account.spotifyUserId,
    displayName: account.displayName,
    scope: account.scope,
    connectedAt: account.createdAt.toISOString(),
  };
}

export async function disconnectAccount(): Promise<void> {
  await prisma.spotifyAccount.deleteMany({ where: { id: ACCOUNT_ID } });
}

/**
 * 保存済みのユーザートークンを返す。期限が近ければ自動で更新する。
 * 未連携なら null。
 */
export async function getUserAccessToken(): Promise<string | null> {
  const account = await prisma.spotifyAccount.findUnique({ where: { id: ACCOUNT_ID } });
  if (!account) return null;

  if (account.expiresAt.getTime() - REFRESH_MARGIN_MS > Date.now()) {
    return account.accessToken;
  }

  const refreshed = await requestToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
    }),
  );

  await prisma.spotifyAccount.update({
    where: { id: ACCOUNT_ID },
    data: {
      accessToken: refreshed.access_token,
      // 更新時に refresh_token が返らないことがあるので既存を維持する
      refreshToken: refreshed.refresh_token ?? account.refreshToken,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      ...(refreshed.scope ? { scope: refreshed.scope } : {}),
    },
  });

  return refreshed.access_token;
}
