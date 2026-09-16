"use client";

import { useState } from "react";

import { RecommendControlsBar } from "@/components/RecommendControlsBar";
import { RecommendationCard } from "@/components/RecommendationCard";
import { DEFAULT_CONTROLS, useRecommendations, type RecommendControls } from "@/hooks/useRecommendations";

interface Props {
  trackId: string;
  genres: string[];
}

export function RecommendationPanel({ trackId, genres }: Props) {
  const [controls, setControls] = useState<RecommendControls>(DEFAULT_CONTROLS);
  const { recommendations, loading, error } = useRecommendations(trackId, controls);

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">次に掛ける曲</h2>
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
          条件に合う候補が見つかりませんでした。ピッチ許容幅を広げるか、キー適合の絞り込みを外してみてください。
        </p>
      ) : null}

      <ul className="space-y-3">
        {recommendations.map((recommendation, index) => (
          <RecommendationCard
            key={recommendation.track.id}
            recommendation={recommendation}
            rank={index + 1}
          />
        ))}
      </ul>
    </section>
  );
}
