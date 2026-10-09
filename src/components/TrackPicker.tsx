"use client";

import { useMemo, useState } from "react";

import { CamelotBadge } from "@/components/CamelotBadge";
import { EnergyMeter } from "@/components/EnergyMeter";
import type { RecommendControls } from "@/hooks/useRecommendations";
import { formatBpm } from "@/lib/bpm";
import { evaluateCandidates, scoreRank, type Recommendation } from "@/lib/recommend";
import type { TrackDTO } from "@/lib/types";

type SortKey = "score" | "title" | "artist" | "bpm";

const PAGE_SIZE = 30;

const inputClass =
  "rounded-lg border border-deck-700 bg-deck-900 px-3 py-2 text-sm text-white " +
  "placeholder:text-deck-600 outline-none transition focus:border-neon/70 focus:ring-2 focus:ring-neon/20";

const SCORE_TONE: Record<string, string> = {
  excellent: "text-lime-glow",
  good: "text-neon-soft",
  fair: "text-amber-glow",
  risky: "text-magenta",
};

interface Props {
  /** 今セットの最後にある曲。相性はこの曲からの繋ぎで計算する */
  current: TrackDTO;
  library: TrackDTO[];
  /** セットに入っている曲。候補から外す */
  excludeIds: string[];
  controls: RecommendControls;
  onPick: (track: TrackDTO) => void;
}

/**
 * ライブラリの全曲から次の曲を自由に選ぶ。
 * おすすめと違って相性で絞り込まず、繋ぎの情報を添えて全部並べる。
 */
export function TrackPicker({ current, library, excludeIds, controls, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const genres = useMemo(
    () => Array.from(new Set(library.map((t) => t.genre).filter((g): g is string => !!g))).sort(),
    [library],
  );

  // 採点は相性の設定（ピッチ許容幅・ハーフ/ダブル）だけ反映し、絞り込み系の設定は無視する
  const evaluated = useMemo(
    () =>
      evaluateCandidates(current, library, {
        maxPitchPercent: controls.maxPitchPercent,
        allowHalfDouble: controls.allowHalfDouble,
        excludeIds,
      }),
    [current, library, excludeIds, controls.maxPitchPercent, controls.allowHalfDouble],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = evaluated.filter(({ track }) => {
      if (genre && track.genre !== genre) return false;
      if (!q) return true;
      return `${track.title} ${track.artist} ${track.label ?? ""} ${track.camelot}`
        .toLowerCase()
        .includes(q);
    });

    if (sortKey === "score") return filtered; // evaluateCandidates がスコア順で返す
    return [...filtered].sort((a, b) => {
      if (sortKey === "bpm") return a.track.bpm - b.track.bpm;
      if (sortKey === "artist") {
        return (
          a.track.artist.localeCompare(b.track.artist, "ja") ||
          a.track.title.localeCompare(b.track.title, "ja")
        );
      }
      return a.track.title.localeCompare(b.track.title, "ja");
    });
  }, [evaluated, query, genre, sortKey]);

  // 検索条件が変わったら先頭から表示し直す
  function resetPaging<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setVisible(PAGE_SIZE);
    };
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} min-w-56 flex-1`}
          value={query}
          onChange={(e) => resetPaging(setQuery)(e.target.value)}
          placeholder="タイトル / アーティスト / キーで検索"
          aria-label="ライブラリを検索"
        />
        <select
          className={inputClass}
          value={genre}
          onChange={(e) => resetPaging(setGenre)(e.target.value)}
          aria-label="ジャンルで絞り込む"
        >
          <option value="">全ジャンル</option>
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          className={inputClass}
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          aria-label="並び順"
        >
          <option value="score">相性の良い順</option>
          <option value="title">タイトル順</option>
          <option value="artist">アーティスト順</option>
          <option value="bpm">BPM 順</option>
        </select>
      </div>

      <p className="text-xs text-deck-600">
        {rows.length} 曲（セット済みの曲は除外）。相性が悪い曲も選べます。繋ぎに注意が要る曲は赤で表示します。
      </p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-deck-700 px-4 py-10 text-center text-sm text-deck-600">
          条件に合う曲がありません。
        </p>
      ) : (
        <ul className="divide-y divide-deck-800/70 overflow-hidden rounded-xl border border-deck-700/70 bg-deck-900/60">
          {rows.slice(0, visible).map((row) => (
            <PickerRow key={row.track.id} row={row} onPick={onPick} />
          ))}
        </ul>
      )}

      {rows.length > visible ? (
        <button
          type="button"
          onClick={() => setVisible((n) => n + PAGE_SIZE)}
          className="w-full rounded-lg border border-deck-700 px-4 py-2 text-sm text-deck-400 transition hover:bg-deck-800 hover:text-white"
        >
          さらに表示（残り {rows.length - visible} 曲）
        </button>
      ) : null}
    </div>
  );
}

function PickerRow({ row, onPick }: { row: Recommendation; onPick: (track: TrackDTO) => void }) {
  const { track, bpm, key, energy, score } = row;
  const rank = scoreRank(score);
  const tempoOut = bpm.score === 0;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition hover:bg-deck-850/60">
      <span
        className={`tabular w-8 text-right text-sm font-bold ${SCORE_TONE[rank.tone]}`}
        title={`相性スコア ${Math.round(score)}（${rank.label}）`}
      >
        {Math.round(score)}
      </span>

      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate text-sm font-medium text-white">{track.title}</p>
        <p className="truncate text-xs text-deck-400">{track.artist}</p>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="tabular w-12 text-right text-sm text-white">{formatBpm(track.bpm)}</span>
        <CamelotBadge camelot={track.camelot} />
        <EnergyMeter energy={track.energy} />
      </div>

      <div className="flex min-w-0 basis-56 flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
        <span className={`tabular ${tempoOut ? "text-magenta" : "text-deck-400"}`}>
          {tempoOut ? "ピッチ範囲外" : bpm.label}
        </span>
        <span className={key.compatible ? "text-deck-400" : "text-magenta"}>
          {key.compatible ? key.label : "キーがぶつかる"}
        </span>
        <span className="tabular text-deck-400">
          エナジー {energy.delta > 0 ? `+${energy.delta}` : energy.delta}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onPick(track)}
        className="rounded-lg bg-neon/15 px-3 py-1.5 text-xs font-semibold text-neon transition hover:bg-neon/25"
      >
        次に掛ける
      </button>
    </li>
  );
}
