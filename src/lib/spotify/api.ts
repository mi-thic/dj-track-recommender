/**
 * Spotify Web API のうち、このアプリで使う分だけの薄いラッパー。
 *
 * NOTE: audio-features / audio-analysis は 2024-11-27 に廃止され、
 * 新規アプリからは 403 になる。BPM・キー・エナジーは取得できないため
 * ここでは扱わない。
 */

import { getAppAccessToken } from "./auth";

const API_BASE = "https://api.spotify.com/v1";

export class SpotifyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumArtUrl: string | null;
  durationSec: number;
  releaseYear: number | null;
  isrc: string | null;
  url: string;
  uri: string;
  popularity: number | null;
}

interface RawArtist {
  name?: string;
}

interface RawImage {
  url?: string;
  width?: number;
}

interface RawTrack {
  id?: string;
  name?: string;
  artists?: RawArtist[];
  album?: { name?: string; images?: RawImage[]; release_date?: string };
  duration_ms?: number;
  external_ids?: { isrc?: string };
  external_urls?: { spotify?: string };
  uri?: string;
  popularity?: number;
}

async function spotifyFetch<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!response.ok) {
    let detail = text;
    try {
      detail = JSON.parse(text)?.error?.message ?? text;
    } catch {
      /* JSON でなければ本文をそのまま使う */
    }

    if (response.status === 403) {
      throw new SpotifyApiError(
        `Spotify に拒否されました (403): ${detail}。このエンドポイントは新規アプリでは使えない可能性があります。`,
        403,
      );
    }
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      throw new SpotifyApiError(
        `Spotify のレート制限に達しました。${retryAfter ?? "しばらく"} 秒後に再試行してください。`,
        429,
      );
    }
    throw new SpotifyApiError(`Spotify API エラー (${response.status}): ${detail}`, response.status);
  }

  return text ? (JSON.parse(text) as T) : (undefined as T);
}

function toSpotifyTrack(raw: RawTrack): SpotifyTrack | null {
  if (!raw?.id || !raw.name) return null;

  const images = raw.album?.images ?? [];
  // 一番小さい画像で十分（一覧のサムネイル用）
  const smallest = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0];
  const releaseYear = raw.album?.release_date
    ? Number(raw.album.release_date.slice(0, 4))
    : null;

  return {
    id: raw.id,
    name: raw.name,
    artists: (raw.artists ?? []).map((a) => a.name ?? "").filter(Boolean),
    album: raw.album?.name ?? "",
    albumArtUrl: smallest?.url ?? images[0]?.url ?? null,
    durationSec: raw.duration_ms ? Math.round(raw.duration_ms / 1000) : 0,
    releaseYear: releaseYear && Number.isFinite(releaseYear) ? releaseYear : null,
    isrc: raw.external_ids?.isrc ?? null,
    url: raw.external_urls?.spotify ?? `https://open.spotify.com/track/${raw.id}`,
    uri: raw.uri ?? `spotify:track:${raw.id}`,
    popularity: typeof raw.popularity === "number" ? raw.popularity : null,
  };
}

/** フィールドフィルタで使えないよう記号を落とす */
function sanitizeQueryValue(value: string): string {
  return value.replace(/["']/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * タイトル + アーティストで検索する。
 * まず field filter で精度を上げ、0 件ならフリーワードで再検索する。
 */
export async function searchTracks(
  title: string,
  artist: string | null,
  limit = 5,
): Promise<SpotifyTrack[]> {
  const token = await getAppAccessToken();

  const cleanTitle = sanitizeQueryValue(title);
  const cleanArtist = artist ? sanitizeQueryValue(artist) : "";

  const queries: string[] = [];
  if (cleanArtist) {
    queries.push(`track:"${cleanTitle}" artist:"${cleanArtist}"`);
    queries.push(`${cleanTitle} ${cleanArtist}`);
  } else {
    queries.push(cleanTitle);
  }

  for (const q of queries) {
    const params = new URLSearchParams({ q, type: "track", limit: String(limit) });
    const data = await spotifyFetch<{ tracks?: { items?: RawTrack[] } }>(
      `/search?${params.toString()}`,
      token,
    );
    const items = (data.tracks?.items ?? [])
      .map(toSpotifyTrack)
      .filter((track): track is SpotifyTrack => track !== null);
    if (items.length > 0) return items;
  }

  return [];
}

/** 任意のクエリ文字列で検索する（UI の検索ボックス用） */
export async function searchTracksRaw(query: string, limit = 10): Promise<SpotifyTrack[]> {
  const token = await getAppAccessToken();
  const params = new URLSearchParams({ q: query, type: "track", limit: String(limit) });
  const data = await spotifyFetch<{ tracks?: { items?: RawTrack[] } }>(
    `/search?${params.toString()}`,
    token,
  );
  return (data.tracks?.items ?? [])
    .map(toSpotifyTrack)
    .filter((track): track is SpotifyTrack => track !== null);
}

export async function getTrackById(id: string): Promise<SpotifyTrack | null> {
  const token = await getAppAccessToken();
  const raw = await spotifyFetch<RawTrack>(`/tracks/${encodeURIComponent(id)}`, token);
  return toSpotifyTrack(raw);
}

/* ------------------------------------------------------------------ */
/* ユーザートークンが必要な操作                                        */
/* ------------------------------------------------------------------ */

export interface SpotifyUser {
  id: string;
  displayName: string | null;
}

export async function getCurrentUser(userToken: string): Promise<SpotifyUser> {
  const raw = await spotifyFetch<{ id: string; display_name?: string | null }>("/me", userToken);
  return { id: raw.id, displayName: raw.display_name ?? null };
}

export interface CreatedPlaylist {
  id: string;
  name: string;
  url: string;
}

/**
 * プレイリストを作成する。
 *
 * NOTE: 2026-02-11 の移行で `POST /users/{user_id}/playlists` は 403 になった。
 * 現在は `POST /me/playlists` を使う。
 */
export async function createPlaylist(
  userToken: string,
  name: string,
  description: string,
  isPublic: boolean,
): Promise<CreatedPlaylist> {
  const raw = await spotifyFetch<{
    id: string;
    name: string;
    external_urls?: { spotify?: string };
  }>("/me/playlists", userToken, {
    method: "POST",
    body: JSON.stringify({
      name,
      public: isPublic,
      // 空文字を送ると説明が "null" と表示されることがあるので省略する
      ...(description ? { description } : {}),
    }),
  });

  return {
    id: raw.id,
    name: raw.name,
    url: raw.external_urls?.spotify ?? `https://open.spotify.com/playlist/${raw.id}`,
  };
}

/**
 * プレイリストに曲を追加する。1 リクエストあたり 100 件までなので分割して送る。
 *
 * NOTE: 2026-02-11 の移行で `/playlists/{id}/tracks` は 403 になった。
 * 現在は `/playlists/{id}/items` を使う。
 */
export async function addTracksToPlaylist(
  userToken: string,
  playlistId: string,
  uris: string[],
): Promise<number> {
  let added = 0;
  for (let i = 0; i < uris.length; i += 100) {
    const chunk = uris.slice(i, i + 100);
    await spotifyFetch(`/playlists/${encodeURIComponent(playlistId)}/items`, userToken, {
      method: "POST",
      body: JSON.stringify({ uris: chunk }),
    });
    added += chunk.length;
  }
  return added;
}
