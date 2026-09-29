"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AutoSetPanel } from "@/components/AutoSetPanel";
import { CamelotBadge } from "@/components/CamelotBadge";
import { EnergyMeter } from "@/components/EnergyMeter";
import { ExportToSpotify } from "@/components/ExportToSpotify";
import { RecommendControlsBar } from "@/components/RecommendControlsBar";
import { RecommendationCard } from "@/components/RecommendationCard";
import { SetFlowChart } from "@/components/SetFlowChart";
import { DEFAULT_CONTROLS, useRecommendations, type RecommendControls } from "@/hooks/useRecommendations";
import { formatBpm, matchBpm } from "@/lib/bpm";
import type { AutoSetResult } from "@/lib/autoset";
import { getCamelotCompatibility } from "@/lib/camelot";
import { formatDuration } from "@/lib/format";
import type { SetlistDTO, TrackDTO } from "@/lib/types";

const inputClass =
  "rounded-lg border border-deck-700 bg-deck-900 px-3 py-2 text-sm text-white " +
  "placeholder:text-deck-600 outline-none transition focus:border-neon/70 focus:ring-2 focus:ring-neon/20";

const iconButton =
  "rounded-md border border-deck-700 px-2 py-1 text-xs text-deck-400 transition " +
  "hover:bg-deck-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30";

function defaultSetName(): string {
  return `DJ Set — ${new Date().toLocaleDateString("ja-JP")}`;
}

/** 保存済みの状態と比べるための指紋 */
function fingerprint(name: string, tracks: TrackDTO[]): string {
  return JSON.stringify([name.trim(), tracks.map((track) => track.id)]);
}

export function SetlistBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");
  const startId = searchParams.get("start");

  const [allTracks, setAllTracks] = useState<TrackDTO[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [setlist, setSetlist] = useState<TrackDTO[]>([]);
  const [query, setQuery] = useState("");
  const [controls, setControls] = useState<RecommendControls>(DEFAULT_CONTROLS);
  const [copied, setCopied] = useState(false);

  // 保存まわり
  const [name, setName] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(Boolean(idParam));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 自動生成したときの目標エナジー。セットの先頭がこの曲順のままの間だけ表示する
  const [autoPlan, setAutoPlan] = useState<{ ids: string[]; targets: number[] } | null>(null);

  // 新規作成時の既定名はクライアントで決める（サーバーとのタイムゾーン差で hydration がずれないように）
  useEffect(() => {
    if (!idParam) setName((prev) => prev || defaultSetName());
  }, [idParam]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tracks")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setAllTracks(data.tracks ?? []);
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

  // ?id= で保存済みセットを開く。保存直後に URL を差し替えたときは読み直さない
  useEffect(() => {
    if (!idParam || idParam === savedId) return;

    let cancelled = false;
    setLoadingSaved(true);
    setLoadError(null);

    fetch(`/api/setlists/${idParam}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? "セットリストを読み込めませんでした");
        return data.setlist as SetlistDTO;
      })
      .then((loaded) => {
        if (cancelled) return;
        setSetlist(loaded.tracks);
        setName(loaded.name);
        setSavedId(loaded.id);
        setSavedFingerprint(fingerprint(loaded.name, loaded.tracks));
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "セットリストを読み込めませんでした");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSaved(false);
      });

    return () => {
      cancelled = true;
    };
  }, [idParam, savedId]);

  // ?start= で開始曲が指定されていれば 1 曲目に入れる（新規セットのときだけ）
  useEffect(() => {
    if (idParam || !startId || allTracks.length === 0) return;
    setSetlist((prev) => {
      if (prev.length > 0) return prev;
      const found = allTracks.find((track) => track.id === startId);
      return found ? [found] : prev;
    });
  }, [idParam, startId, allTracks]);

  const dirty = savedFingerprint === null
    ? setlist.length > 0
    : fingerprint(name, setlist) !== savedFingerprint;

  // 未保存のまま離れようとしたら確認する
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

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

  // 並べ替えや削除で曲順が変わったら、目標は当てはまらなくなるので出さない（末尾への追加は可）
  const planTargets =
    autoPlan && autoPlan.ids.every((id, i) => setlist[i]?.id === id) ? autoPlan.targets : null;

  function applyAutoSet(result: AutoSetResult) {
    setSetlist(result.tracks);
    setAutoPlan({ ids: result.tracks.map((track) => track.id), targets: result.targets });
  }

  function moveTrack(index: number, offset: -1 | 1) {
    setSetlist((prev) => {
      const target = index + offset;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeTrack(index: number) {
    setSetlist((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setSaveError("セット名を入力してください");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const body = JSON.stringify({ name: trimmed, trackIds: setlist.map((track) => track.id) });
      const response = savedId
        ? await fetch(`/api/setlists/${savedId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body,
          })
        : await fetch("/api/setlists", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaveError(data.error ?? "保存に失敗しました");
        return;
      }

      const saved = data.setlist as SetlistDTO;
      setName(saved.name);
      setSavedId(saved.id);
      setSavedFingerprint(fingerprint(saved.name, saved.tracks));
      if (!savedId) {
        // 再読み込みしても同じセットが開けるよう URL に id を載せる
        router.replace(`/setlist?id=${saved.id}`, { scroll: false });
      }
    } catch {
      setSaveError("サーバーに接続できませんでした");
    } finally {
      setSaving(false);
    }
  }

  function asText(): string {
    const header = name.trim() ? `${name.trim()}\n\n` : "";
    return (
      header +
      setlist
        .map(
          (track, i) =>
            `${i + 1}. ${track.title} — ${track.artist} (${formatBpm(track.bpm)} BPM / ${track.camelot})`,
        )
        .join("\n")
    );
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

  if (loadingSaved) {
    return <p className="text-sm text-deck-600">セットリストを読み込み中…</p>;
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg border border-magenta/50 bg-magenta/10 px-3 py-2.5 text-sm text-magenta">
          {loadError}
        </p>
        <Link href="/setlists" className="text-sm text-neon underline">
          保存済みセットの一覧へ
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <Link href="/setlists" className="text-xs text-deck-400 transition hover:text-white">
              ← 保存済みセット
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-white">
              {savedId ? "セットを編集" : "新しいセット"}
            </h1>
          </div>
          {setlist.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <ExportToSpotify
                trackIds={setlist.map((track) => track.id)}
                unlinkedCount={setlist.filter((track) => !track.spotifyId).length}
                defaultName={name.trim() || defaultSetName()}
              />
              <button
                type="button"
                onClick={copySetlist}
                className="rounded-lg border border-deck-700 px-3.5 py-2 text-sm text-deck-400 transition hover:bg-deck-800 hover:text-white"
              >
                {copied ? "コピーしました" : "テキストでコピー"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("セットの曲をすべて外します。よろしいですか？")) setSetlist([]);
                }}
                className="rounded-lg border border-deck-700 px-3.5 py-2 text-sm text-deck-400 transition hover:border-magenta/50 hover:text-magenta"
              >
                全曲クリア
              </button>
            </div>
          ) : null}
        </div>

        {/* セット名と保存 */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-deck-700/70 bg-deck-900/50 px-4 py-3">
          <label htmlFor="setlist-name" className="text-xs text-deck-400">
            セット名
          </label>
          <input
            id="setlist-name"
            className={`${inputClass} min-w-56 flex-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="例: 10/12 ウォームアップ"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="rounded-lg bg-neon px-4 py-2 text-sm font-semibold text-deck-950 transition hover:bg-neon-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "保存中…" : savedId ? "変更を保存" : "保存"}
          </button>
          <span className={`text-xs ${dirty ? "text-amber-glow" : "text-deck-600"}`}>
            {dirty ? "未保存の変更があります" : savedId ? "保存済み" : ""}
          </span>
          {saveError ? <p className="w-full text-xs text-magenta">{saveError}</p> : null}
        </div>
      </div>

      {/* 現在のセット */}
      <section className="rounded-xl border border-deck-700/70 bg-deck-900/50 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-white">セット（{setlist.length} 曲）</h2>
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
                <li key={`${index}-${track.id}`}>
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
                    {planTargets && index < planTargets.length ? (
                      <span className="tabular w-14 text-[11px] text-deck-600" title="自動生成の目標エナジー">
                        目標 {planTargets[index]}
                      </span>
                    ) : null}
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveTrack(index, -1)}
                        disabled={index === 0}
                        className={iconButton}
                        aria-label={`${track.title} を 1 つ上へ`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTrack(index, 1)}
                        disabled={index === setlist.length - 1}
                        className={iconButton}
                        aria-label={`${track.title} を 1 つ下へ`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTrack(index)}
                        className={`${iconButton} hover:border-magenta/50 hover:text-magenta`}
                        aria-label={`${track.title} をセットから外す`}
                      >
                        外す
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {setlist.length >= 2 ? <SetFlowChart tracks={setlist} targets={planTargets} /> : null}

      {setlist.length >= 1 ? (
        <AutoSetPanel setlist={setlist} controls={controls} onGenerated={applyAutoSet} />
      ) : null}

      {/* 次の候補 or 1 曲目の選択 */}
      {current ? (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">「{current.title}」の次の候補</h2>
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
      <span className="tabular">エナジー {energyDelta > 0 ? `+${energyDelta}` : energyDelta}</span>
    </div>
  );
}
