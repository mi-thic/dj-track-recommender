"use client";

import type { RecommendControls } from "@/hooks/useRecommendations";

interface Props {
  controls: RecommendControls;
  onChange: (next: RecommendControls) => void;
  genres: string[];
}

const selectClass =
  "rounded-lg border border-deck-700 bg-deck-900 px-2.5 py-1.5 text-xs text-white outline-none " +
  "transition focus:border-neon/70 focus:ring-2 focus:ring-neon/20";

export function RecommendControlsBar({ controls, onChange, genres }: Props) {
  const set = <K extends keyof RecommendControls>(key: K, value: RecommendControls[K]) =>
    onChange({ ...controls, [key]: value });

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-deck-700/70 bg-deck-900/40 px-4 py-3">
      <label className="flex items-center gap-2 text-xs text-deck-400">
        <span className="whitespace-nowrap">
          ピッチ許容 <span className="tabular text-neon">±{controls.maxPitchPercent}%</span>
        </span>
        <input
          type="range"
          min={2}
          max={16}
          step={0.5}
          value={controls.maxPitchPercent}
          onChange={(e) => set("maxPitchPercent", Number(e.target.value))}
          className="w-28 accent-[var(--color-neon)]"
        />
      </label>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-deck-400">
        <input
          type="checkbox"
          checked={controls.allowHalfDouble}
          onChange={(e) => set("allowHalfDouble", e.target.checked)}
          className="h-3.5 w-3.5 accent-[var(--color-neon)]"
        />
        ハーフ / ダブルタイムを許可
      </label>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-deck-400">
        <input
          type="checkbox"
          checked={controls.keyCompatibleOnly}
          onChange={(e) => set("keyCompatibleOnly", e.target.checked)}
          className="h-3.5 w-3.5 accent-[var(--color-neon)]"
        />
        キー適合のみ
      </label>

      <label className="flex items-center gap-2 text-xs text-deck-400">
        ジャンル
        <select
          className={selectClass}
          value={controls.genre}
          onChange={(e) => set("genre", e.target.value)}
        >
          <option value="">指定なし</option>
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-xs text-deck-400">
        表示件数
        <select
          className={selectClass}
          value={controls.limit}
          onChange={(e) => set("limit", Number(e.target.value))}
        >
          {[5, 10, 20, 30].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
