/**
 * BPM マッチング。
 *
 * DJ ミキサー / CDJ のピッチフェーダーは概ね ±6〜8%。
 * 加えてハーフタイム / ダブルタイム（例: 140 と 70）も実戦では有効なため、
 * 3 通りの倍率を試して最良のものを採用する。
 */

export type TempoRatio = 0.5 | 1 | 2;

export interface BpmMatch {
  /** 0-100 */
  score: number;
  /** 適用した倍率（0.5 = ハーフタイム, 2 = ダブルタイム） */
  ratio: TempoRatio;
  /** 倍率適用後の実効 BPM */
  effectiveBpm: number;
  /** from に合わせるために必要なピッチ調整（%）。正なら上げる */
  pitchPercent: number;
  /** 素の BPM 差（to - from） */
  bpmDiff: number;
  label: string;
}

export const DEFAULT_MAX_PITCH_PERCENT = 8;

/** ハーフ / ダブルタイムを使った場合のスコア減衰 */
const RATIO_PENALTY: Record<TempoRatio, number> = {
  1: 1,
  2: 0.85,
  0.5: 0.85,
};

export interface MatchBpmOptions {
  /** 許容するピッチ調整幅（%）。既定 8 */
  maxPitchPercent?: number;
  /** ハーフ / ダブルタイムを許可するか。既定 true */
  allowHalfDouble?: boolean;
}

function scoreForPitch(pitchPercent: number, maxPitchPercent: number): number {
  const abs = Math.abs(pitchPercent);
  // 1% 以内は実質無調整とみなして満点
  if (abs <= 1) return 100;
  if (abs >= maxPitchPercent) return 0;
  return 100 * (1 - (abs - 1) / (maxPitchPercent - 1));
}

function ratioLabel(ratio: TempoRatio, pitchPercent: number): string {
  const sign = pitchPercent >= 0 ? "+" : "";
  const pitch = `${sign}${pitchPercent.toFixed(1)}%`;
  if (ratio === 2) return `ダブルタイム / ${pitch}`;
  if (ratio === 0.5) return `ハーフタイム / ${pitch}`;
  return `ピッチ ${pitch}`;
}

export interface TempoFit {
  score: number;
  ratio: TempoRatio;
  effectiveBpm: number;
  pitchPercent: number;
}

const RATIOS_WITH_HALF_DOUBLE: TempoRatio[] = [1, 2, 0.5];
const RATIOS_SAME_ONLY: TempoRatio[] = [1];

/**
 * テンポ適合の数値部分だけを返す（表示用ラベルを作らない）。
 * 自動生成では候補の評価が 1 セットで数十万回走るため、順位付けにはこちらを使い、
 * 残した候補にだけ matchBpm でラベルを付ける。どちらも同じ計算なので点数は一致する。
 */
export function tempoFit(fromBpm: number, toBpm: number, options: MatchBpmOptions = {}): TempoFit | null {
  const maxPitchPercent = options.maxPitchPercent ?? DEFAULT_MAX_PITCH_PERCENT;
  const ratios = (options.allowHalfDouble ?? true) ? RATIOS_WITH_HALF_DOUBLE : RATIOS_SAME_ONLY;

  let best: TempoFit | null = null;
  for (const ratio of ratios) {
    const effectiveBpm = toBpm * ratio;
    if (effectiveBpm <= 0) continue;
    // to を from に合わせるためのピッチ変化量
    const pitchPercent = ((fromBpm - effectiveBpm) / effectiveBpm) * 100;
    const score = scoreForPitch(pitchPercent, maxPitchPercent) * RATIO_PENALTY[ratio];
    if (!best || score > best.score) best = { score, ratio, effectiveBpm, pitchPercent };
  }
  return best;
}

/**
 * fromBpm の曲から toBpm の曲へ繋ぐときのテンポ適合を返す。
 */
export function matchBpm(
  fromBpm: number,
  toBpm: number,
  options: MatchBpmOptions = {},
): BpmMatch {
  const best = tempoFit(fromBpm, toBpm, options);

  if (!best) {
    return {
      score: 0,
      ratio: 1,
      effectiveBpm: toBpm,
      pitchPercent: 0,
      bpmDiff: toBpm - fromBpm,
      label: "—",
    };
  }
  return {
    ...best,
    bpmDiff: toBpm - fromBpm,
    label: ratioLabel(best.ratio, best.pitchPercent),
  };
}

/** 指定 BPM に対して許容範囲となる BPM の下限・上限 */
export function bpmRange(bpm: number, maxPitchPercent = DEFAULT_MAX_PITCH_PERCENT) {
  return {
    min: bpm / (1 + maxPitchPercent / 100),
    max: bpm * (1 + maxPitchPercent / 100),
  };
}

export function formatBpm(bpm: number): string {
  return Number.isInteger(bpm) ? String(bpm) : bpm.toFixed(1);
}
