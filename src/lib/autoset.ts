/**
 * セットの自動生成。DB に依存しない純粋関数。
 *
 * 1 曲ずつ「その場で一番良い曲」を選ぶ貪欲法だと、数曲先で繋げる曲が無くなる
 * 袋小路に入りやすい。そこで候補を常に beamWidth 本まで並行して伸ばし、
 * セット全体の合計スコアが高いものを残す（ビームサーチ）。
 *
 * 次曲推薦（recommend.ts）はエナジーを「維持〜+1」が理想として採点するが、
 * 自動生成ではセット全体の形（山型・クールダウンなど）を作りたいので、
 * 曲ごとの目標エナジーにどれだけ近いかで採点する。
 */

import { matchBpm, type BpmMatch } from "./bpm";
import { getCamelotCompatibility, type CamelotCompatibility } from "./camelot";
import type { TrackDTO } from "./types";

export type EnergyShape = "arc" | "build" | "steady" | "cooldown";

export const ENERGY_SHAPES: Record<EnergyShape, { label: string; description: string }> = {
  arc: {
    label: "山型",
    description: "徐々に上げてピークを作り、最後は少し落として締める",
  },
  build: {
    label: "右肩上がり",
    description: "最後の曲に向けて上げ続ける。ピークタイムへの繋ぎ向け",
  },
  steady: {
    label: "一定",
    description: "1 曲目のエナジーを保つ",
  },
  cooldown: {
    label: "クールダウン",
    description: "徐々に落としていく。クロージング向け",
  },
};

export const MIN_LENGTH = 2;
export const MAX_LENGTH = 40;

/** 山型・右肩上がりで目指すピーク */
const PEAK_ENERGY = 9;
/** クールダウンで目指す下限 */
const LOW_ENERGY = 3;
/** 山型でピークに達する位置（セット全体に対する割合） */
const ARC_PEAK_AT = 0.7;
/**
 * 1 曲で動かしてよいエナジーの上限。これを超える繋ぎは候補にしない。
 * 減点だけだとキーとテンポが完璧な曲に負けて、ピーク直後に 9 → 2 のような
 * フロアを冷やす繋ぎが選ばれてしまう。どの形でも 1 曲あたりの変化は 1 前後で足りる。
 */
export const MAX_ENERGY_JUMP = 3;

/**
 * テンポを保つ帯（1 曲目に対する %）。各繋ぎがピッチ範囲内でも、積み重なると
 * 20 曲で 1 曲目から 10% 以上ずれることが多い（実ライブラリで 48 本中 29 本）。
 * この帯の中は減点せず、外れた分だけ曲順選びで不利にする。
 * ±6% あれば、ビルドで 122 → 128 程度に上げるのは許容できる。
 */
export const TEMPO_BAND_PERCENT = 6;

/** セット上で鳴っているテンポが 1 曲目からどれだけ外れたかに応じた減点 */
export function tempoBandPenalty(playedBpm: number, anchorBpm: number): number {
  const deviation = (Math.abs(playedBpm - anchorBpm) / anchorBpm) * 100;
  return deviation <= TEMPO_BAND_PERCENT ? 0 : (deviation - TEMPO_BAND_PERCENT) * 3;
}

/** 1 曲目のエナジーを起点に、各曲の目標エナジーを返す（1 曲目は起点そのもの） */
export function energyTargets(startEnergy: number, length: number, shape: EnergyShape): number[] {
  if (length <= 1) return [startEnergy];

  return Array.from({ length }, (_, i) => {
    const t = i / (length - 1);
    let value: number;
    switch (shape) {
      case "build": {
        const peak = Math.max(startEnergy, PEAK_ENERGY);
        value = startEnergy + (peak - startEnergy) * t;
        break;
      }
      case "steady":
        value = startEnergy;
        break;
      case "cooldown": {
        const low = Math.min(startEnergy, LOW_ENERGY);
        value = startEnergy + (low - startEnergy) * t;
        break;
      }
      case "arc":
      default: {
        const peak = Math.max(startEnergy, PEAK_ENERGY);
        const end = (startEnergy + peak) / 2;
        value =
          t <= ARC_PEAK_AT
            ? startEnergy + (peak - startEnergy) * (t / ARC_PEAK_AT)
            : peak + (end - peak) * ((t - ARC_PEAK_AT) / (1 - ARC_PEAK_AT));
      }
    }
    return Math.round(value * 10) / 10;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 目標エナジーへの近さ（0〜100）。
 * 目標に沿っていても、1 曲で 3 以上跳ねるとフロアが置いていかれるので減点する。
 */
export function energyFit(previousEnergy: number, energy: number, target: number): number {
  let score = 100 - Math.abs(energy - target) * 18;
  const jump = Math.abs(energy - previousEnergy);
  if (jump > 2) score -= (jump - 2) * 10;
  return clamp(score, 0, 100);
}

/** 自動生成では曲線に沿うことが目的なので、推薦よりエナジーの比重を上げる */
export const AUTOSET_WEIGHTS = { bpm: 0.4, key: 0.35, energy: 0.25 } as const;

export interface AutoSetOptions {
  /** 1 曲目（と固定する曲）を含めた合計曲数 */
  length: number;
  shape: EnergyShape;
  maxPitchPercent?: number;
  allowHalfDouble?: boolean;
  keyCompatibleOnly?: boolean;
  genre?: string | null;
  /** セットのテンポを 1 曲目の ±TEMPO_BAND_PERCENT 付近に保つ。既定 true */
  keepTempo?: boolean;
  /** 候補から外す曲 */
  excludeIds?: string[];
  /** 並行して伸ばす候補の数。1 にすると貪欲法 */
  beamWidth?: number;
  /** 各候補から次に試す曲の数 */
  branching?: number;
}

export interface TransitionDetail {
  bpm: BpmMatch;
  key: CamelotCompatibility;
  energyFit: number;
  targetEnergy: number;
  score: number;
}

export interface AutoSetResult {
  /** 固定した曲 + 自動で選んだ曲 */
  tracks: TrackDTO[];
  /** tracks のうち、このインデックス以降が自動で選んだ曲 */
  generatedFrom: number;
  /** tracks[i] → tracks[i + 1] の繋ぎ（tracks.length - 1 件） */
  transitions: TransitionDetail[];
  /** 要求した曲数ぶんの目標エナジー（グラフの目標線に使う） */
  targets: number[];
  /** 自動で選んだ繋ぎの平均スコア。1 曲も選べなければ null */
  averageScore: number | null;
  requestedLength: number;
  /** 繋げる曲が尽きて、要求した曲数に届かなかった */
  stoppedEarly: boolean;
}

function describeTransition(
  from: TrackDTO,
  to: TrackDTO,
  target: number,
  options: AutoSetOptions,
): TransitionDetail {
  const bpm = matchBpm(from.bpm, to.bpm, {
    maxPitchPercent: options.maxPitchPercent,
    allowHalfDouble: options.allowHalfDouble,
  });
  const key = getCamelotCompatibility(from.camelot, to.camelot);
  const fit = energyFit(from.energy, to.energy, target);
  const score =
    bpm.score * AUTOSET_WEIGHTS.bpm + key.score * AUTOSET_WEIGHTS.key + fit * AUTOSET_WEIGHTS.energy;
  return { bpm, key, energyFit: fit, targetEnergy: target, score: Math.round(score * 10) / 10 };
}

/**
 * 繋げられない組み合わせは null。
 * テンポが合わない、エナジーが MAX_ENERGY_JUMP を超えて動く、キー適合のみ指定でキーが合わない。
 */
function scoreTransition(
  from: TrackDTO,
  to: TrackDTO,
  target: number,
  options: AutoSetOptions,
): TransitionDetail | null {
  const detail = describeTransition(from, to, target, options);
  if (detail.bpm.score <= 0) return null;
  if (Math.abs(to.energy - from.energy) > MAX_ENERGY_JUMP) return null;
  if (options.keyCompatibleOnly && !detail.key.compatible) return null;
  return detail;
}

interface BeamState {
  path: TrackDTO[];
  used: Set<string>;
  transitions: TransitionDetail[];
  /** 曲順の優劣を決める合計（繋ぎのスコア − テンポ帯からの減点）。固定部分は含めない */
  rank: number;
  /** 自動で選んだ繋ぎのスコア合計（表示用の平均点に使う） */
  total: number;
  /**
   * 最後の曲が、元の BPM の何倍で鳴っているか。
   * ハーフ/ダブルで繋ぐと元の BPM とフロアのテンポがずれるため、
   * 87 BPM の曲をダブルで繋げば 2（フロアは 174 のまま）になる。
   */
  scale: number;
}

const pathKey = (state: BeamState) => state.path.map((track) => track.id).join(",");

/**
 * prefix（1 曲以上）の続きを、合計 length 曲になるまで自動で組む。
 * prefix が 1 曲なら「その曲から組む」、複数なら「今のセットの続きを組む」。
 */
export function generateAutoSet(
  prefix: TrackDTO[],
  pool: TrackDTO[],
  options: AutoSetOptions,
): AutoSetResult {
  if (prefix.length === 0) throw new Error("1 曲目を指定してください");

  const length = clamp(Math.round(options.length), MIN_LENGTH, MAX_LENGTH);
  const beamWidth = Math.max(1, options.beamWidth ?? 8);
  const branching = Math.max(1, options.branching ?? 6);
  const targets = energyTargets(prefix[0].energy, Math.max(length, prefix.length), options.shape);

  const excluded = new Set([...(options.excludeIds ?? []), ...prefix.map((track) => track.id)]);
  const candidates = pool.filter(
    (track) =>
      !excluded.has(track.id) && (!options.genre || track.genre === options.genre),
  );

  // 固定部分の繋ぎも表示用に採点しておく（テンポが合わなくても除外しない）
  const fixedTransitions = prefix
    .slice(1)
    .map((track, i) => describeTransition(prefix[i], track, targets[i + 1], options));

  const keepTempo = options.keepTempo ?? true;
  const anchorBpm = prefix[0].bpm;
  const prefixScale = fixedTransitions.reduce((scale, t) => scale * t.bpm.ratio, 1);

  let beams: BeamState[] = [
    {
      path: [...prefix],
      used: new Set(prefix.map((track) => track.id)),
      transitions: fixedTransitions,
      rank: 0,
      total: 0,
      scale: prefixScale,
    },
  ];
  let stoppedEarly = false;

  for (let step = prefix.length; step < length; step += 1) {
    const expanded: BeamState[] = [];

    for (const state of beams) {
      const last = state.path[state.path.length - 1];
      const scored: Array<{ track: TrackDTO; detail: TransitionDetail; rank: number; scale: number }> = [];

      for (const track of candidates) {
        if (state.used.has(track.id)) continue;
        const detail = scoreTransition(last, track, targets[step], options);
        if (!detail) continue;
        const scale = state.scale * detail.bpm.ratio;
        const penalty = keepTempo ? tempoBandPenalty(track.bpm * scale, anchorBpm) : 0;
        scored.push({ track, detail, rank: detail.score - penalty, scale });
      }

      scored.sort((a, b) => b.rank - a.rank || a.track.id.localeCompare(b.track.id));

      for (const { track, detail, rank, scale } of scored.slice(0, branching)) {
        expanded.push({
          path: [...state.path, track],
          used: new Set(state.used).add(track.id),
          transitions: [...state.transitions, detail],
          rank: state.rank + rank,
          total: state.total + detail.score,
          scale,
        });
      }
    }

    if (expanded.length === 0) {
      stoppedEarly = true;
      break;
    }

    expanded.sort((a, b) => b.rank - a.rank || pathKey(a).localeCompare(pathKey(b)));
    beams = expanded.slice(0, beamWidth);
  }

  const best = beams[0];
  const generatedCount = best.path.length - prefix.length;

  return {
    tracks: best.path,
    generatedFrom: prefix.length,
    transitions: best.transitions,
    targets: targets.slice(0, Math.max(length, prefix.length)),
    averageScore:
      generatedCount > 0 ? Math.round((best.total / generatedCount) * 10) / 10 : null,
    requestedLength: length,
    stoppedEarly,
  };
}
