/**
 * ローカルの楽曲と Spotify の検索結果を突き合わせるスコアリング。
 *
 * DJ のライブラリは "Track (Extended Mix)" のような表記ゆれが多いため、
 * ミックス表記や feat. を落としてから比較する。純粋関数なので単体で試せる。
 */

import type { SpotifyTrack } from "./api";

/** この値以上なら自動で紐付けてよいとみなす */
export const AUTO_LINK_THRESHOLD = 0.82;

/** ミックス表記など、曲名の同一性に影響しない部分 */
const MIX_WORDS =
  "mix|edit|version|remaster(?:ed)?|dub|instrumental|radio|extended|club|original|vip|bootleg|rework|re-?edit";

const NOISE_PATTERNS: RegExp[] = [
  new RegExp(`\\([^()]*?(?:${MIX_WORDS})[^()]*?\\)`, "gi"),
  new RegExp(`\\[[^\\[\\]]*?(?:${MIX_WORDS})[^\\[\\]]*?\\]`, "gi"),
  new RegExp(`\\s-\\s[^-]*?(?:${MIX_WORDS})\\s*$`, "gi"),
  /\((?:feat|ft)\.?[^()]*\)/gi,
  /\b(?:feat|ft)\.?\s.*$/gi,
];

/** 比較用に文字列を正規化する（大小・記号・ミックス表記・アクセントを吸収） */
export function normalizeForMatch(value: string): string {
  let text = value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

  for (const pattern of NOISE_PATTERNS) {
    text = text.replace(pattern, " ");
  }

  // 記号を落とす。日本語などの非ラテン文字は残す
  text = text.replace(/[^\p{L}\p{N}]+/gu, " ");
  return text.trim().replace(/\s+/g, " ");
}

function bigrams(value: string): Map<string, number> {
  const counts = new Map<string, number>();
  const compact = value.replace(/\s+/g, "");
  for (let i = 0; i < compact.length - 1; i += 1) {
    const pair = compact.slice(i, i + 2);
    counts.set(pair, (counts.get(pair) ?? 0) + 1);
  }
  return counts;
}

/** 文字バイグラムの Dice 係数（0〜1） */
export function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const left = bigrams(a);
  const right = bigrams(b);
  if (left.size === 0 || right.size === 0) {
    // 1 文字同士などバイグラムが作れない場合は完全一致のみ 1
    return a === b ? 1 : 0;
  }

  let overlap = 0;
  let leftTotal = 0;
  for (const [pair, count] of left) {
    leftTotal += count;
    const other = right.get(pair);
    if (other) overlap += Math.min(count, other);
  }
  let rightTotal = 0;
  for (const count of right.values()) rightTotal += count;

  return (2 * overlap) / (leftTotal + rightTotal);
}

export interface LocalTrackForMatch {
  title: string;
  artist: string;
  durationSec: number | null;
}

export interface MatchScore {
  /** 0〜1 の総合スコア */
  score: number;
  titleScore: number;
  artistScore: number;
  /** 曲尺の差（秒）。どちらかが不明なら null */
  durationDiffSec: number | null;
  /** 自動で紐付けてよいか */
  confident: boolean;
  reason: string;
}

/** ローカル曲と Spotify の候補 1 件の一致度を採点する */
export function scoreMatch(local: LocalTrackForMatch, candidate: SpotifyTrack): MatchScore {
  const titleScore = diceCoefficient(
    normalizeForMatch(local.title),
    normalizeForMatch(candidate.name),
  );

  const normalizedLocalArtist = normalizeForMatch(local.artist);
  const artistScore = Math.max(
    diceCoefficient(normalizedLocalArtist, normalizeForMatch(candidate.artists.join(" "))),
    ...candidate.artists.map((name) =>
      diceCoefficient(normalizedLocalArtist, normalizeForMatch(name)),
    ),
    0,
  );

  const durationDiffSec =
    local.durationSec !== null && candidate.durationSec > 0
      ? Math.abs(local.durationSec - candidate.durationSec)
      : null;

  // 曲尺は「同じバージョンか」の強い手がかりになる。
  // クラブミックスに Radio Edit を自動で紐付けてしまわないよう、
  // 大きくずれている場合は閾値を割るだけの減点をする。
  let durationAdjust = 0;
  if (durationDiffSec !== null) {
    if (durationDiffSec <= 3) durationAdjust = 0.06;
    else if (durationDiffSec <= 10) durationAdjust = 0.02;
    else if (durationDiffSec <= 30) durationAdjust = 0;
    else if (durationDiffSec <= 60) durationAdjust = -0.12;
    else durationAdjust = -0.25;
  }

  const score = Math.max(
    0,
    Math.min(1, titleScore * 0.6 + artistScore * 0.35 + durationAdjust + 0.05),
  );

  const confident = score >= AUTO_LINK_THRESHOLD && titleScore >= 0.7 && artistScore >= 0.6;

  let reason: string;
  if (confident) {
    reason = "タイトル・アーティストとも十分に一致";
  } else if (titleScore < 0.7) {
    reason = "タイトルの一致度が低い";
  } else if (artistScore < 0.6) {
    reason = "アーティスト名の一致度が低い";
  } else if (durationDiffSec !== null && durationDiffSec > 60) {
    reason = `曲尺が ${durationDiffSec} 秒ずれている（Radio Edit など別バージョンの可能性）`;
  } else if (durationDiffSec !== null && durationDiffSec > 30) {
    reason = `曲尺が ${durationDiffSec} 秒ずれている`;
  } else {
    reason = "一致度が閾値に届かない";
  }

  return { score, titleScore, artistScore, durationDiffSec, confident, reason };
}

export interface RankedCandidate {
  candidate: SpotifyTrack;
  match: MatchScore;
}

/** 候補をスコア降順に並べる */
export function rankCandidates(
  local: LocalTrackForMatch,
  candidates: SpotifyTrack[],
): RankedCandidate[] {
  return candidates
    .map((candidate) => ({ candidate, match: scoreMatch(local, candidate) }))
    .sort((a, b) => b.match.score - a.match.score);
}
