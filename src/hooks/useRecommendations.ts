"use client";

import { useCallback, useEffect, useState } from "react";

import type { Recommendation } from "@/lib/recommend";

export interface RecommendControls {
  limit: number;
  maxPitchPercent: number;
  allowHalfDouble: boolean;
  keyCompatibleOnly: boolean;
  minScore: number;
  genre: string;
  excludeIds: string[];
}

export const DEFAULT_CONTROLS: RecommendControls = {
  limit: 10,
  maxPitchPercent: 8,
  allowHalfDouble: true,
  keyCompatibleOnly: false,
  minScore: 30,
  genre: "",
  excludeIds: [],
};

export function buildRecommendUrl(trackId: string, controls: RecommendControls): string {
  const params = new URLSearchParams({
    limit: String(controls.limit),
    maxPitchPercent: String(controls.maxPitchPercent),
    allowHalfDouble: String(controls.allowHalfDouble),
    keyCompatibleOnly: String(controls.keyCompatibleOnly),
    minScore: String(controls.minScore),
  });
  if (controls.genre) params.set("genre", controls.genre);
  if (controls.excludeIds.length > 0) params.set("excludeIds", controls.excludeIds.join(","));
  return `/api/tracks/${trackId}/recommendations?${params.toString()}`;
}

interface Result {
  recommendations: Recommendation[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** 指定楽曲の次曲候補を取得する。trackId が null の間は何もしない */
export function useRecommendations(
  trackId: string | null,
  controls: RecommendControls,
): Result {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // オブジェクトの同一性ではなく中身で再取得を判定する
  const controlsKey = trackId ? buildRecommendUrl(trackId, controls) : null;

  useEffect(() => {
    if (!controlsKey) {
      setRecommendations([]);
      setError(null);
      return;
    }

    const abort = new AbortController();
    setLoading(true);
    setError(null);

    fetch(controlsKey, { signal: abort.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? "推薦の取得に失敗しました");
        setRecommendations(data.recommendations ?? []);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "推薦の取得に失敗しました");
        setRecommendations([]);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });

    return () => abort.abort();
  }, [controlsKey, nonce]);

  return { recommendations, loading, error, reload };
}
