/**
 * Spotify 連携の設定。
 *
 * 必要な環境変数:
 *   SPOTIFY_CLIENT_ID
 *   SPOTIFY_CLIENT_SECRET
 *   SPOTIFY_REDIRECT_URI  (既定: http://127.0.0.1:3000/api/spotify/callback)
 *
 * NOTE: Spotify はリダイレクト URI に http://localhost を許可しなくなったため、
 * ループバックは必ず http://127.0.0.1:<port> を使う。
 */

/** プレイリストの作成・編集に必要なスコープ */
export const SPOTIFY_SCOPES = [
  "playlist-modify-private",
  "playlist-modify-public",
] as const;

export const DEFAULT_REDIRECT_URI = "http://127.0.0.1:3000/api/spotify/callback";

export interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** 環境変数が揃っていなければ null */
export function getSpotifyConfig(): SpotifyConfig | null {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI?.trim() || DEFAULT_REDIRECT_URI;

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

export function isSpotifyConfigured(): boolean {
  return getSpotifyConfig() !== null;
}
