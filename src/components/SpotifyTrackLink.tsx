"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatDuration } from "@/lib/format";
import type { TrackDTO } from "@/lib/types";

interface Candidate {
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumArtUrl: string | null;
  durationSec: number;
  url: string;
}

interface Ranked {
  candidate: Candidate;
  match?: { score: number; reason: string; confident: boolean };
}

export function SpotifyTrackLink({ track }: { track: TrackDTO }) {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Ranked[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        title: track.title,
        artist: track.artist,
        limit: "8",
      });
      if (track.durationSec) params.set("durationSec", String(track.durationSec));

      const response = await fetch(`/api/spotify/search?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "検索に失敗しました");
        return;
      }
      setResults(data.results ?? []);
    } catch {
      setError("サーバーに接続できませんでした");
    } finally {
      setSearching(false);
    }
  }

  async function link(candidate: Candidate) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/tracks/${track.id}/spotify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotifyId: candidate.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "紐付けに失敗しました");
        return;
      }
      setResults(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    try {
      await fetch(`/api/tracks/${track.id}/spotify`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-deck-700/70 bg-deck-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-medium text-deck-400">Spotify</h2>
        {track.spotifyId ? (
          <button
            type="button"
            onClick={unlink}
            disabled={busy}
            className="text-xs text-deck-400 underline transition hover:text-magenta disabled:opacity-40"
          >
            紐付けを解除
          </button>
        ) : (
          <button
            type="button"
            onClick={search}
            disabled={searching}
            className="rounded-md border border-neon/40 px-2.5 py-1 text-xs text-neon transition hover:bg-neon/10 disabled:opacity-40"
          >
            {searching ? "検索中…" : "Spotify を検索"}
          </button>
        )}
      </div>

      {error ? <p className="mt-2 text-xs text-magenta">{error}</p> : null}

      {track.spotifyId ? (
        <div className="mt-3 flex items-center gap-3">
          {track.albumArtUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.albumArtUrl}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 rounded"
            />
          ) : null}
          <a
            href={track.spotifyUrl ?? `https://open.spotify.com/track/${track.spotifyId}`}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm text-neon transition hover:underline"
          >
            Spotify で開く →
          </a>
        </div>
      ) : null}

      {results ? (
        results.length === 0 ? (
          <p className="mt-3 text-xs text-deck-600">候補が見つかりませんでした。</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {results.map((entry) => (
              <li
                key={entry.candidate.id}
                className="flex flex-wrap items-center gap-3 rounded-lg bg-deck-850/60 px-3 py-2"
              >
                {entry.candidate.albumArtUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.candidate.albumArtUrl}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 shrink-0 rounded"
                  />
                ) : (
                  <span className="h-9 w-9 shrink-0 rounded bg-deck-800" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{entry.candidate.name}</p>
                  <p className="truncate text-xs text-deck-400">
                    {entry.candidate.artists.join(", ")} · {entry.candidate.album}
                  </p>
                </div>
                <span className="tabular text-xs text-deck-600">
                  {formatDuration(entry.candidate.durationSec)}
                </span>
                {entry.match ? (
                  <span
                    className={`tabular text-xs ${entry.match.confident ? "text-lime-glow" : "text-deck-400"}`}
                    title={entry.match.reason}
                  >
                    {Math.round(entry.match.score * 100)}%
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => link(entry.candidate)}
                  disabled={busy}
                  className="rounded-md border border-neon/40 px-2.5 py-1 text-xs text-neon transition hover:bg-neon/10 disabled:opacity-40"
                >
                  紐付ける
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
