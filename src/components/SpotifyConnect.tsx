"use client";

import { useCallback, useEffect, useState } from "react";

export interface SpotifyStatus {
  configured: boolean;
  redirectUri: string | null;
  requiredScopes: string[];
  account: {
    spotifyUserId: string;
    displayName: string | null;
    scope: string;
    connectedAt: string;
  } | null;
  tracks: { total: number; linked: number; unlinked: number };
}

interface Props {
  onStatusChange?: (status: SpotifyStatus) => void;
}

export function SpotifyConnect({ onStatusChange }: Props) {
  const [status, setStatus] = useState<SpotifyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/spotify/status");
      const data = (await response.json()) as SpotifyStatus;
      setStatus(data);
      onStatusChange?.(data);
    } catch {
      setError("連携状況を取得できませんでした");
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    void load();
  }, [load]);

  async function disconnect() {
    if (!window.confirm("Spotify との連携を解除します。曲の紐付けは残ります。よろしいですか？")) {
      return;
    }
    await fetch("/api/spotify/disconnect", { method: "POST" });
    void load();
  }

  if (loading) {
    return <p className="text-sm text-deck-600">読み込み中…</p>;
  }

  if (error) {
    return (
      <p className="rounded-lg border border-magenta/50 bg-magenta/10 px-3 py-2.5 text-sm text-magenta">
        {error}
      </p>
    );
  }

  if (!status) return null;

  /* --- 未設定: セットアップ手順を出す --- */
  if (!status.configured) {
    return (
      <section className="space-y-4 rounded-xl border border-amber-glow/40 bg-amber-glow/5 p-5">
        <div>
          <h2 className="text-sm font-semibold text-amber-glow">Spotify の設定が必要です</h2>
          <p className="mt-1 text-xs text-deck-400">
            環境変数 <code className="rounded bg-deck-800 px-1">SPOTIFY_CLIENT_ID</code> と{" "}
            <code className="rounded bg-deck-800 px-1">SPOTIFY_CLIENT_SECRET</code> が設定されていません。
          </p>
        </div>

        <ol className="list-decimal space-y-2 pl-5 text-xs text-deck-400">
          <li>
            <a
              href="https://developer.spotify.com/dashboard"
              target="_blank"
              rel="noreferrer noopener"
              className="text-neon underline"
            >
              Spotify Developer Dashboard
            </a>{" "}
            で Create app からアプリを作る
          </li>
          <li>
            Redirect URI に次の値を<strong className="text-white">そのまま</strong>登録する
            <pre className="mt-1 overflow-x-auto rounded-lg bg-deck-900 px-3 py-2 text-[11px] text-neon-soft">
              {status.redirectUri ?? "http://127.0.0.1:3000/api/spotify/callback"}
            </pre>
            <span className="mt-1 block text-[11px]">
              Spotify は <code>http://localhost</code> を許可しないため、必ず{" "}
              <code>127.0.0.1</code> を使います。
            </span>
          </li>
          <li>APIs は Web API のみで十分です</li>
          <li>
            発行された Client ID / Client Secret をプロジェクト直下の{" "}
            <code className="rounded bg-deck-800 px-1">.env</code> に書く
            <pre className="mt-1 overflow-x-auto rounded-lg bg-deck-900 px-3 py-2 text-[11px] text-deck-200">
              {`SPOTIFY_CLIENT_ID="..."\nSPOTIFY_CLIENT_SECRET="..."\nSPOTIFY_REDIRECT_URI="${status.redirectUri ?? "http://127.0.0.1:3000/api/spotify/callback"}"`}
            </pre>
          </li>
          <li>
            <code className="rounded bg-deck-800 px-1">docker compose restart app</code> で再起動する
          </li>
        </ol>
      </section>
    );
  }

  /* --- 設定済み --- */
  return (
    <section className="space-y-4 rounded-xl border border-deck-700/70 bg-deck-900/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Spotify アカウント</h2>
          {status.account ? (
            <p className="mt-1 text-xs text-deck-400">
              <span className="text-lime-glow">連携済み</span> —{" "}
              {status.account.displayName ?? status.account.spotifyUserId}
            </p>
          ) : (
            <p className="mt-1 text-xs text-deck-400">
              プレイリストを作るにはアカウント連携が必要です。曲の検索・紐付けは連携なしでも使えます。
            </p>
          )}
        </div>

        {status.account ? (
          <button
            type="button"
            onClick={disconnect}
            className="rounded-lg border border-deck-700 px-4 py-2 text-sm text-deck-400 transition hover:border-magenta/50 hover:text-magenta"
          >
            連携を解除
          </button>
        ) : (
          <a
            href="/api/spotify/connect"
            className="rounded-lg bg-neon px-4 py-2 text-sm font-semibold text-deck-950 transition hover:bg-neon-soft"
          >
            Spotify と連携する
          </a>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="登録曲" value={status.tracks.total} />
        <Stat label="紐付け済み" value={status.tracks.linked} highlight />
        <Stat label="未紐付け" value={status.tracks.unlinked} />
      </div>
    </section>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-deck-800 bg-deck-900/60 px-3.5 py-2.5">
      <p className="text-[11px] text-deck-400">{label}</p>
      <p className={`tabular mt-0.5 text-xl font-bold ${highlight ? "text-lime-glow" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
