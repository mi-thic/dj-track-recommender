/**
 * 次曲推薦エンジン。
 *
 * BPM（テンポ適合）・Camelot（ハーモニック適合）・エナジー遷移の
 * 3 要素を重み付き合成してスコアリングする。純粋関数なので DB に依存しない。
 */

import { matchBpm, type BpmMatch, type MatchBpmOptions } from "./bpm";
import { getCamelotCompatibility, type CamelotCompatibility } from "./camelot";
import type { TrackDTO } from "./types";

export interface RecommendWeights {
  bpm: number;
  key: number;
  energy: number;
}

export const DEFAULT_WEIGHTS: RecommendWeights = {
  bpm: 0.45,
  key: 0.4,
  energy: 0.15,
};

export interface EnergyMatch {
  score: number;
  delta: number;
  label: string;
}

export interface Recommendation {
  track: TrackDTO;
  /** 0-100 の総合スコア */
  score: number;
  bpm: BpmMatch;
  key: CamelotCompatibility;
  energy: EnergyMatch;
  /** UI に出す推薦理由 */
  reasons: string[];
}

export interface RecommendOptions extends MatchBpmOptions {
  /** ハーモニック非互換の曲を除外する。既定 false */
  keyCompatibleOnly?: boolean;
  /** 指定ジャンルのみに絞る */
  genre?: string | null;
  /** 除外する楽曲 ID（既にプレイ済みなど） */
  excludeIds?: string[];
  /** この値未満のスコアは捨てる。既定 30 */
  minScore?: number;
  /** 返す件数。既定 10 */
  limit?: number;
  weights?: Partial<RecommendWeights>;
}

function scoreEnergyTransition(fromEnergy: number, toEnergy: number): EnergyMatch {
  const delta = toEnergy - fromEnergy;
  // 現状維持 〜 わずかに上げる（0〜+1）が理想。そこから離れるほど減点。
  const score = clamp(100 - Math.abs(delta - 0.5) * 18, 0, 100);

  let label: string;
  if (delta === 0) label = "エナジー維持";
  else if (delta > 0) label = `エナジー +${delta}（盛り上げ）`;
  else label = `エナジー ${delta}（クールダウン）`;

  return { score, delta, label };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildReasons(bpm: BpmMatch, key: CamelotCompatibility, energy: EnergyMatch): string[] {
  const reasons: string[] = [];

  if (bpm.ratio !== 1) {
    reasons.push(
      `${bpm.ratio === 2 ? "ダブルタイム" : "ハーフタイム"}で合わせると実効 ${bpm.effectiveBpm.toFixed(1)} BPM`,
    );
  }
  if (Math.abs(bpm.pitchPercent) <= 1) {
    reasons.push("ピッチ調整ほぼ不要でテンポが合う");
  } else if (bpm.score > 0) {
    reasons.push(`ピッチ ${bpm.pitchPercent > 0 ? "+" : ""}${bpm.pitchPercent.toFixed(1)}% で同期可能`);
  } else {
    reasons.push("テンポ差が大きくピッチ範囲外");
  }

  if (key.compatible) {
    reasons.push(`${key.label}：${key.description}`);
  } else {
    reasons.push("Camelot 上で隣接せずキーがぶつかる可能性あり");
  }

  reasons.push(energy.label);
  return reasons;
}

/**
 * from に続けて掛ける候補を返す（スコア降順）。
 */
export function recommendNextTracks(
  from: TrackDTO,
  candidates: TrackDTO[],
  options: RecommendOptions = {},
): Recommendation[] {
  const {
    keyCompatibleOnly = false,
    genre = null,
    excludeIds = [],
    minScore = 30,
    limit = 10,
  } = options;

  const weights: RecommendWeights = { ...DEFAULT_WEIGHTS, ...options.weights };
  const weightSum = weights.bpm + weights.key + weights.energy || 1;
  const excluded = new Set([from.id, ...excludeIds]);

  const results: Recommendation[] = [];

  for (const candidate of candidates) {
    if (excluded.has(candidate.id)) continue;
    if (genre && candidate.genre !== genre) continue;

    const key = getCamelotCompatibility(from.camelot, candidate.camelot);
    if (keyCompatibleOnly && !key.compatible) continue;

    const bpm = matchBpm(from.bpm, candidate.bpm, {
      maxPitchPercent: options.maxPitchPercent,
      allowHalfDouble: options.allowHalfDouble,
    });
    const energy = scoreEnergyTransition(from.energy, candidate.energy);

    const score =
      (bpm.score * weights.bpm + key.score * weights.key + energy.score * weights.energy) /
      weightSum;

    if (score < minScore) continue;

    results.push({
      track: candidate,
      score: Math.round(score * 10) / 10,
      bpm,
      key,
      energy,
      reasons: buildReasons(bpm, key, energy),
    });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // 同点はハーモニック適合を優先し、次にテンポ差の小さい順
    if (b.key.score !== a.key.score) return b.key.score - a.key.score;
    return Math.abs(a.bpm.pitchPercent) - Math.abs(b.bpm.pitchPercent);
  });

  return results.slice(0, limit);
}

/** スコアに対応する UI 用のランク */
export function scoreRank(score: number): {
  label: string;
  tone: "excellent" | "good" | "fair" | "risky";
} {
  if (score >= 85) return { label: "完璧", tone: "excellent" };
  if (score >= 70) return { label: "good", tone: "good" };
  if (score >= 55) return { label: "まあまあ", tone: "fair" };
  return { label: "要注意", tone: "risky" };
}
