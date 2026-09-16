"use client";

import Link from "next/link";

import { CamelotBadge } from "@/components/CamelotBadge";
import { EnergyMeter } from "@/components/EnergyMeter";
import { ScoreBadge } from "@/components/ScoreBadge";
import { formatBpm } from "@/lib/bpm";
import { formatDuration } from "@/lib/format";
import type { Recommendation } from "@/lib/recommend";

interface Props {
  recommendation: Recommendation;
  rank: number;
  /** 指定するとカードに「この曲を選ぶ」ボタンが出る（セットリスト用） */
  onPick?: (recommendation: Recommendation) => void;
}

export function RecommendationCard({ recommendation, rank, onPick }: Props) {
  const { track, bpm, key, energy, reasons, score } = recommendation;

  return (
    <li className="rounded-xl border border-deck-700/70 bg-deck-900/60 p-4 transition hover:border-neon/40 hover:bg-deck-850/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="tabular mt-0.5 w-6 shrink-0 text-right text-sm font-semibold text-deck-600">
            {rank}
          </span>
          <div className="min-w-0">
            <Link
              href={`/tracks/${track.id}`}
              className="block truncate font-semibold text-white transition hover:text-neon"
            >
              {track.title}
            </Link>
            <p className="truncate text-sm text-deck-400">{track.artist}</p>
          </div>
        </div>
        <ScoreBadge score={score} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 pl-9 text-xs">
        <span className="tabular text-white">
          {formatBpm(track.bpm)} <span className="text-deck-600">BPM</span>
        </span>
        <CamelotBadge camelot={track.camelot} showMusicalKey />
        <span className="flex items-center gap-1.5 text-deck-400">
          <EnergyMeter energy={track.energy} />
          <span className="tabular">{track.energy}</span>
        </span>
        {track.genre ? <span className="text-deck-400">{track.genre}</span> : null}
        <span className="tabular text-deck-600">{formatDuration(track.durationSec)}</span>
      </div>

      <div className="mt-3 grid gap-2 pl-9 sm:grid-cols-3">
        <MetricBar label="テンポ" value={bpm.score} detail={bpm.label} />
        <MetricBar label="キー" value={key.score} detail={key.label} />
        <MetricBar label="エナジー" value={energy.score} detail={energy.label} />
      </div>

      <ul className="mt-3 space-y-1 pl-9 text-xs text-deck-400">
        {reasons.map((reason, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="text-neon/60">▸</span>
            <span>{reason}</span>
          </li>
        ))}
      </ul>

      {onPick ? (
        <div className="mt-3 pl-9">
          <button
            type="button"
            onClick={() => onPick(recommendation)}
            className="rounded-lg bg-neon/15 px-3 py-1.5 text-xs font-semibold text-neon transition hover:bg-neon/25"
          >
            この曲を次に掛ける
          </button>
        </div>
      ) : null}
    </li>
  );
}

function MetricBar({ label, value, detail }: { label: string; value: number; detail: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const hue = 190 - (100 - pct) * 1.7; // 高得点=シアン, 低得点=マゼンタ寄り
  return (
    <div>
      <div className="flex items-baseline justify-between text-[10px] text-deck-600">
        <span>{label}</span>
        <span className="tabular">{Math.round(value)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-deck-800">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: `hsl(${hue} 80% 58%)` }}
        />
      </div>
      <p className="mt-1 truncate text-[10px] text-deck-400" title={detail}>
        {detail}
      </p>
    </div>
  );
}
