"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatDuration } from "@/lib/format";

interface Candidate {
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumArtUrl: string | null;
  durationSec: number;
  releaseYear: number | null;
  url: string;
}

interface MatchScore {
  score: number;
  titleScore: number;
  artistScore: number;
  durationDiffSec: number | null;
  confident: boolean;
  reason: string;
}

interface MatchRow {
  trackId: string;
  title: string;
  artist: string;
  action: "link" | "manual" | "none";
  best: { candidate: Candidate; match: MatchScore } | null;
  alternatives: Array<{ candidate: Candidate; match: MatchScore }>;
}

interface MatchResponse {
  dryRun: boolean;
  processed: number;
  summary: { link: number; manual: number; none: number };
  remaining: number;
  results: MatchRow[];
  error?: string;
  partial?: boolean;
}

export function SpotifyMatch({ onChanged }: { onChanged?: () => void }) {
  const router = useRouter();
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linked, setLinked] = useState<Record<string, string>>({});

  async function run(dryRun: boolean) {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/spotify/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun, limit: 100 }),
      });
      const data = (await response.json()) as MatchResponse;

      if (!response.ok) {
        setError(data.error ?? "マッチングに失敗しました");
        if (data.partial) setResult(data);
        return;
      }

      setResult(data);
      if (!dryRun) {
        setLinked({});
        onChanged?.();
        router.refresh();
      }
    } catch {
      setError("サーバーに接続できませんでした");
    } finally {
      setRunning(false);
    }
  }

  async function linkManually(trackId: string, candidate: Candidate) {
    setLinkingId(trackId);
    try {
      const response = await fetch(`/api/tracks/${trackId}/spotify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotifyId: candidate.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        window.alert(data.error ?? "紐付けに失敗しました");
        return;
      }
      setLinked((prev) => ({ ...prev, [trackId]: candidate.name }));
      onChanged?.();
      router.refresh();
    } finally {
      setLinkingId(null);
    }
  }

  const manualRows = result?.results.filter((row) => row.action === "manual") ?? [];
  const noneRows = result?.results.filter((row) => row.action === "none") ?? [];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-white">曲を Spotify と紐付ける</h2>
        <p className="mt-1 text-xs text-deck-400">
          タイトルとアーティストで検索し、十分に一致するものだけ自動で紐付けます。紐付けるとジャケット画像が表示され、セットリストを Spotify に書き出せるようになります。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => run(true)}
          disabled={running}
          className="rounded-lg border border-neon/50 px-4 py-2.5 text-sm font-semibold text-neon transition hover:bg-neon/10 disabled:opacity-40"
        >
          {running ? "検索中…" : "未紐付けの曲を検索"}
        </button>
        <button
          type="button"
          onClick={() => run(false)}
          disabled={running || !result || result.summary.link === 0}
          className="rounded-lg bg-neon px-5 py-2.5 text-sm font-semibold text-deck-950 transition hover:bg-neon-soft disabled:opacity-40"
        >
          確実な {result?.summary.link ?? 0} 件を紐付ける
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-magenta/50 bg-magenta/10 px-3 py-2.5 text-sm text-magenta">
          {error}
        </p>
      ) : null}

      {result ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="検索した曲" value={result.processed} />
            <Stat label="自動で紐付け可" value={result.summary.link} tone="lime" />
            <Stat label="要確認" value={result.summary.manual} tone="amber" />
            <Stat label="候補なし" value={result.summary.none} />
          </div>

          {!result.dryRun ? (
            <p className="rounded-lg border border-lime-glow/50 bg-lime-glow/10 px-3 py-2.5 text-sm text-lime-glow">
              {result.summary.link} 曲を紐付けました。未紐付けは残り {result.remaining} 曲です。
            </p>
          ) : null}

          {manualRows.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-amber-glow">
                要確認 {manualRows.length} 曲 — 正しければ選んでください
              </h3>
              <ul className="space-y-3">
                {manualRows.map((row) => (
                  <li
                    key={row.trackId}
                    className="rounded-xl border border-deck-700/70 bg-deck-900/60 p-4"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-white">{row.title}</p>
                        <p className="text-xs text-deck-400">{row.artist}</p>
                      </div>
                      {linked[row.trackId] ? (
                        <span className="text-xs text-lime-glow">
                          「{linked[row.trackId]}」に紐付けました
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-glow">{row.best?.match.reason}</span>
                      )}
                    </div>

                    {!linked[row.trackId] ? (
                      <ul className="mt-3 space-y-2">
                        {[row.best, ...row.alternatives]
                          .filter((entry): entry is { candidate: Candidate; match: MatchScore } => !!entry)
                          .map((entry) => (
                            <li
                              key={entry.candidate.id}
                              className="flex flex-wrap items-center gap-3 rounded-lg bg-deck-850/60 px-3 py-2"
                            >
                              {entry.candidate.albumArtUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={entry.candidate.albumArtUrl}
                                  alt=""
                                  width={40}
                                  height={40}
                                  className="h-10 w-10 shrink-0 rounded"
                                />
                              ) : (
                                <span className="h-10 w-10 shrink-0 rounded bg-deck-800" />
                              )}
                              <div className="min-w-0 flex-1">
                                <a
                                  href={entry.candidate.url}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="block truncate text-sm text-white transition hover:text-neon"
                                >
                                  {entry.candidate.name}
                                </a>
                                <p className="truncate text-xs text-deck-400">
                                  {entry.candidate.artists.join(", ")} · {entry.candidate.album}
                                </p>
                              </div>
                              <span className="tabular text-xs text-deck-600">
                                {formatDuration(entry.candidate.durationSec)}
                              </span>
                              <span className="tabular text-xs text-deck-400">
                                {Math.round(entry.match.score * 100)}%
                              </span>
                              <button
                                type="button"
                                onClick={() => linkManually(row.trackId, entry.candidate)}
                                disabled={linkingId === row.trackId}
                                className="rounded-md border border-neon/40 px-2.5 py-1 text-xs text-neon transition hover:bg-neon/10 disabled:opacity-40"
                              >
                                これに紐付ける
                              </button>
                            </li>
                          ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {noneRows.length > 0 ? (
            <details className="rounded-xl border border-deck-700/70 bg-deck-900/40 px-4 py-3">
              <summary className="cursor-pointer text-xs font-medium text-deck-400">
                Spotify に候補が見つからなかった {noneRows.length} 曲
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-deck-400">
                {noneRows.map((row) => (
                  <li key={row.trackId}>
                    <span className="text-deck-200">{row.title}</span> — {row.artist}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

const TONE = {
  lime: "text-lime-glow",
  amber: "text-amber-glow",
  plain: "text-white",
} as const;

function Stat({
  label,
  value,
  tone = "plain",
}: {
  label: string;
  value: number;
  tone?: keyof typeof TONE;
}) {
  return (
    <div className="rounded-lg border border-deck-800 bg-deck-900/60 px-3.5 py-2.5">
      <p className="text-[11px] text-deck-400">{label}</p>
      <p className={`tabular mt-0.5 text-xl font-bold ${TONE[tone]}`}>{value}</p>
    </div>
  );
}
