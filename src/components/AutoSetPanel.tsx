"use client";

import { useState } from "react";

import type { RecommendControls } from "@/hooks/useRecommendations";
import {
  ENERGY_SHAPES,
  energyTargets,
  MAX_ENERGY_JUMP,
  MAX_LENGTH,
  TEMPO_BAND_PERCENT,
  type AutoSetResult,
  type EnergyShape,
} from "@/lib/autoset";
import type { TrackDTO } from "@/lib/types";

interface Props {
  setlist: TrackDTO[];
  /** ピッチ許容・ハーフ/ダブル・キー適合のみ・ジャンルは推薦の設定をそのまま使う */
  controls: RecommendControls;
  onGenerated: (result: AutoSetResult) => void;
}

type Mode = "continue" | "restart";

const SHAPES = Object.keys(ENERGY_SHAPES) as EnergyShape[];

export function AutoSetPanel({ setlist, controls, onGenerated }: Props) {
  const [shape, setShape] = useState<EnergyShape>("arc");
  const [length, setLength] = useState(() => Math.min(MAX_LENGTH, Math.max(12, setlist.length + 4)));
  const [mode, setMode] = useState<Mode>("continue");
  const [keepTempo, setKeepTempo] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const canContinue = setlist.length >= 2;
  const effectiveMode: Mode = canContinue ? mode : "restart";
  const fixedCount = effectiveMode === "continue" ? setlist.length : 1;
  const minLength = fixedCount + 1;

  async function generate() {
    if (length < minLength) {
      setError(`曲数は ${minLength} 曲以上にしてください`);
      return;
    }
    if (
      effectiveMode === "restart" &&
      setlist.length > 1 &&
      !window.confirm(`1 曲目だけ残して、2 曲目以降を自動で組み直します。よろしいですか？`)
    ) {
      return;
    }

    setRunning(true);
    setError(null);
    setSummary(null);
    try {
      const trackIds = (effectiveMode === "continue" ? setlist : setlist.slice(0, 1)).map((t) => t.id);
      const response = await fetch("/api/autoset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackIds,
          length,
          shape,
          maxPitchPercent: controls.maxPitchPercent,
          allowHalfDouble: controls.allowHalfDouble,
          keyCompatibleOnly: controls.keyCompatibleOnly,
          keepTempo,
          genre: controls.genre || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const issue = data.issues?.[0]?.message;
        setError(issue ?? data.error ?? "自動生成に失敗しました");
        return;
      }

      const result = data.result as AutoSetResult;
      onGenerated(result);

      const added = result.tracks.length - result.generatedFrom;
      if (result.stoppedEarly) {
        setSummary(
          `${added} 曲を追加したところで、繋げられる曲が尽きました（目標 ${result.requestedLength} 曲、今 ${result.tracks.length} 曲）。` +
            "ピッチ許容を広げる、キー適合のみを外す、ジャンル指定を外すと伸びる可能性があります。",
        );
      } else {
        setSummary(`${added} 曲を追加しました（繋ぎの平均 ${result.averageScore ?? "—"} 点）。`);
      }
    } catch {
      setError("サーバーに接続できませんでした");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-neon/30 bg-deck-900/50 p-4">
      <div>
        <h2 className="text-sm font-semibold text-white">自動で組む</h2>
        <p className="mt-1 text-xs text-deck-400">
          エナジーの流れを選ぶと、テンポ・キーが繋がり、流れに沿う曲を数手先まで読んで選びます。
          1 曲でエナジーが {MAX_ENERGY_JUMP + 1} 以上動く繋ぎは使いません。
        </p>
      </div>

      <fieldset>
        <legend className="mb-2 text-xs text-deck-400">エナジーの流れ</legend>
        <div className="grid gap-2 sm:grid-cols-4">
          {SHAPES.map((key) => {
            const selected = key === shape;
            return (
              <label
                key={key}
                className={`cursor-pointer rounded-lg border px-3 py-2 transition ${
                  selected
                    ? "border-neon/70 bg-neon/10"
                    : "border-deck-700 bg-deck-900 hover:border-deck-600"
                }`}
              >
                <input
                  type="radio"
                  name="energy-shape"
                  value={key}
                  checked={selected}
                  onChange={() => setShape(key)}
                  className="sr-only"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-medium ${selected ? "text-white" : "text-deck-200"}`}>
                    {ENERGY_SHAPES[key].label}
                  </span>
                  <ShapePreview shape={key} />
                </div>
                <p className="mt-1 text-[11px] leading-snug text-deck-600">
                  {ENERGY_SHAPES[key].description}
                </p>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <label className="flex items-center gap-2 text-xs text-deck-400">
          曲数（合計）
          <input
            type="number"
            min={minLength}
            max={MAX_LENGTH}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="tabular w-16 rounded-lg border border-deck-700 bg-deck-900 px-2 py-1.5 text-sm text-white outline-none focus:border-neon/70"
          />
        </label>

        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-deck-400">
          <input
            type="checkbox"
            checked={keepTempo}
            onChange={(e) => setKeepTempo(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--color-neon)]"
          />
          テンポを 1 曲目の ±{TEMPO_BAND_PERCENT}% 付近に保つ
        </label>

        {canContinue ? (
          <div className="flex items-center gap-3 text-xs text-deck-400" role="radiogroup" aria-label="組み方">
            {(
              [
                ["continue", `今の ${setlist.length} 曲の続きを組む`],
                ["restart", "1 曲目だけ残して組み直す"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="autoset-mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="h-3.5 w-3.5 accent-[var(--color-neon)]"
                />
                {label}
              </label>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          onClick={generate}
          disabled={running}
          className="ml-auto rounded-lg bg-neon px-4 py-2 text-sm font-semibold text-deck-950 transition hover:bg-neon-soft disabled:opacity-40"
        >
          {running ? "組んでいます…" : "自動で組む"}
        </button>
      </div>

      <p className="text-[11px] text-deck-600">
        ピッチ許容・ハーフ/ダブルタイム・キー適合のみ・ジャンルは、下の「次の候補」の設定を使います。
      </p>

      {error ? <p className="text-xs text-magenta">{error}</p> : null}
      {summary ? <p className="text-xs text-deck-200">{summary}</p> : null}
    </section>
  );
}

/** 形のプレビュー。目標曲線そのものを小さく描く（装飾ではなく中身の縮図） */
function ShapePreview({ shape }: { shape: EnergyShape }) {
  // 形の特徴が見える起点で描く（クールダウンを 4 から描くとほぼ平坦になる）
  const start = shape === "cooldown" ? 8 : shape === "steady" ? 6 : 4;
  const values = energyTargets(start, 12, shape);
  const w = 44;
  const h = 18;
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - 2) / 8) * (h - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} aria-hidden className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke="var(--viz-series-1)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
