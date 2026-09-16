"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CamelotBadge } from "@/components/CamelotBadge";
import { EnergyMeter } from "@/components/EnergyMeter";
import { RecommendControlsBar } from "@/components/RecommendControlsBar";
import { RecommendationCard } from "@/components/RecommendationCard";
import { DEFAULT_CONTROLS, useRecommendations, type RecommendControls } from "@/hooks/useRecommendations";
import { formatBpm, matchBpm } from "@/lib/bpm";
import { getCamelotCompatibility } from "@/lib/camelot";
import { formatDuration } from "@/lib/format";
import type { TrackDTO } from "@/lib/types";

const inputClass =
  "rounded-lg border border-deck-700 bg-deck-900 px-3 py-2 text-sm text-white " +
  "placeholder:text-deck-600 outline-none transition focus:border-neon/70 focus:ring-2 focus:ring-neon/20";

export function SetlistBuilder() {
  const searchParams = useSearchParams();
  const startId = searchParams.get("start");

  const [allTracks, setAllTracks] = useState<TrackDTO[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [setlist, setSetlist] = useState<TrackDTO[]>([]);
  const [query, setQuery] = useState("");
  const [controls, setControls] = useState<RecommendControls>(DEFAULT_CONTROLS);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tracks")
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        setAllTracks(data.tracks ?? []);
      })
      .catch(() => {
        if (!cancelled) setAllTracks([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTracks(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // URL の ?start= で開始曲が指定されていれば自動で 1 曲目に入れる
  useEffect(() => {
    if (!startId || allTracks.length === 0) return;
    setSetlist((prev) => {
      if (prev.length > 0) return prev;
      const found = allTracks.find((track) => track.id === startId);
      return found ? [found] : prev;
    });
  }, [startId, allTracks]);

  const current = setlist.length > 0 ? setlist[setlist.length - 1] : null;
  const playedIds = useMemo(() => setlist.map((track) => track.id), [setlist]);

  const recommendControls = useMemo<RecommendControls>(
    () => ({ ...controls, excludeIds: playedIds }),
    [controls, playedIds],
  );

  const { recommendations, loading, error } = useRecommendations(
    current?.id ?? null,
    recommendControls,
  );

  const genres = useMemo(
    () => Array.from(new Set(allTracks.map((t) => t.genre).filter((g): g is string => !!g))).sort(),
    [allTracks],
  );

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = allTracks.filter((track) => !playedIds.includes(track.id));
    if (!q) return pool.slice(0, 12);
    return pool
      .filter((track) => `${track.title} ${track.artist}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [allTracks, playedIds, query]);

  const totalSeconds = setlist.reduce((sum, track) => sum + (track.durationSec ?? 0), 0);

  function asText(): string {
    return setlist
      .map(
        (track, i) =>
          `${i + 1}. ${track.title} — ${track.artist} (${formatBpm(track.bpm)} BPM / ${track.camelot})`,
      )
      .join("\n");
  }

  async function copySetlist() {
    try {
      await navigator.clipboard.writeText(asText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert("クリップボードにコピーできませんでした");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">セットリストビルダー</h1>
          <p className="mt-1 text-sm text-deck-400">
            1 曲目を選ぶと、そこから推薦を辿って流れを組み立てられます。
          </p>
        </div>
        {setlist.length > 0 ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copySetlist}
              className="rounded-lg border border-deck-700 px-3.5 py-2 text-sm text-deck-400 transition hover:bg-deck-800 hover:text-white"
            >
              {copied ? "コピーしました" : "テキストでコピー"}
            </button>
            <button
              type="button"
              onClick={() => setSetlist([])}
              className="rounded-lg border border-deck-700 px-3.5 py-2 text-sm text-deck-400 transition hover:border-magenta/50 hover:text-magenta"
            >
              リセット
            </button>
          </div>
        ) : null}
      </div>

      {/* 現在のセット */}
      <section className="rounded-xl border border-deck-700/70 bg-deck-900/50 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-white">
            セット（{setlist.length} 曲）
          </h2>
          {totalSeconds > 0 ? (
            <span className="tabular text-xs text-deck-600">合計 {formatDuration(totalSeconds)}</span>
          ) : null}
        </div>

        {setlist.length === 0 ? (
          <p className="py-6 text-center text-sm text-deck-600">
            下のリストから 1 曲目を選んでください。
          </p>
        ) : (
          <ol className="mt-4 space-y-0">
            {setlist.map((track, index) => {
              const previous = index > 0 ? setlist[index - 1] : null;
              return (
                <li key={track.id}>
                  {previous ? <TransitionRow from={previous} to={track} controls={controls} /> : null}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-deck-850/60 px-3 py-2.5">
                    <span className="tabular w-6 text-right text-sm font-semibold text-deck-600">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/tracks/${track.id}`}
                        className="block truncate text-sm font-medium text-white transition hover:text-neon"
                      >
                        {track.title}
                      </Link>
                      <p className="truncate text-xs text-deck-400">{track.artist}</p>
                    </div>
                    <span className="tabular text-sm text-white">{formatBpm(track.bpm)}</span>
                    <CamelotBadge camelot={track.camelot} />
                    <EnergyMeter energy={track.energy} />
                    {index === setlist.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setSetlist((prev) => prev.slice(0, -1))}
                        className="rounded-md border border-deck-700 px-2 py-1 text-xs text-deck-400 transition hover:border-magenta/50 hover:text-magenta"
                      >
                        戻す
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* 次の候補 or 1 曲目の選択 */}
      {current ? (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">
              「{current.title}」の次の候補
            </h2>
            {loading ? <span className="text-xs text-neon">計算中…</span> : null}
          </div>

          <RecommendControlsBar controls={controls} onChange={setControls} genres={genres} />

          {error ? (
            <p className="rounded-lg border border-magenta/50 bg-magenta/10 px-3 py-2.5 text-sm text-magenta">
              {error}
            </p>
          ) : null}

          {!loading && !error && recommendations.length === 0 ? (
            <p className="rounded-xl border border-dashed border-deck-700 px-4 py-10 text-center text-sm text-deck-600">
              候補がありません。条件を緩めるか、ライブラリに曲を追加してください。
            </p>
          ) : null}

          <ul className="space-y-3">
            {recommendations.map((recommendation, index) => (
              <RecommendationCard
                key={recommendation.track.id}
                recommendation={recommendation}
                rank={index + 1}
                onPick={(picked) => setSetlist((prev) => [...prev, picked.track])}
              />
            ))}
          </ul>
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">1 曲目を選ぶ</h2>
          <input
            className={`${inputClass} w-full`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="タイトル / アーティストで検索"
          />
          {loadingTracks ? (
            <p className="text-sm text-deck-600">読み込み中…</p>
          ) : allTracks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-deck-700 px-4 py-10 text-center text-sm text-deck-600">
              ライブラリが空です。まず楽曲を登録してください。
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {candidates.map((track) => (
                <li key={track.id}>
                  <button
                    type="button"
                    onClick={() => setSetlist([track])}
                    className="flex w-full items-center gap-3 rounded-lg border border-deck-700/70 bg-deck-900/60 px-3 py-2.5 text-left transition hover:border-neon/50 hover:bg-deck-850"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{track.title}</p>
                      <p className="truncate text-xs text-deck-400">{track.artist}</p>
                    </div>
                    <span className="tabular text-sm text-white">{formatBpm(track.bpm)}</span>
                    <CamelotBadge camelot={track.camelot} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/** セット内の隣り合う 2 曲の繋ぎ情報 */
function TransitionRow({
  from,
  to,
  controls,
}: {
  from: TrackDTO;
  to: TrackDTO;
  controls: RecommendControls;
}) {
  const bpm = matchBpm(from.bpm, to.bpm, {
    maxPitchPercent: controls.maxPitchPercent,
    allowHalfDouble: controls.allowHalfDouble,
  });
  const key = getCamelotCompatibility(from.camelot, to.camelot);
  const energyDelta = to.energy - from.energy;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 pl-9 text-[11px] text-deck-400">
      <span className="text-neon/60">↓</span>
      <span className="tabular">{bpm.label}</span>
      <span className={key.compatible ? "text-deck-400" : "text-magenta"}>{key.label}</span>
      <span className="tabular">
        エナジー {energyDelta > 0 ? `+${energyDelta}` : energyDelta}
      </span>
    </div>
  );
}
