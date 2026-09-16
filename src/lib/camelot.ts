/**
 * Camelot Wheel（ハーモニックミキシング）ユーティリティ。
 *
 * Camelot 表記は `<1-12><A|B>`。
 *  - A = マイナー（短調）
 *  - B = メジャー（長調）
 * 時計回りに 1 つ進むと完全 5 度上がる。
 */

export type CamelotLetter = "A" | "B";

export interface CamelotKey {
  number: number; // 1-12
  letter: CamelotLetter;
}

/** ミックスの関係性 */
export type MixRelation =
  | "perfect" // 同一キー
  | "energy-up" // +1 同レター
  | "energy-down" // -1 同レター
  | "relative" // 同番号・別レター（平行調）
  | "energy-boost" // +2 同レター（全音上げ）
  | "diagonal-up" // +1 かつ別レター
  | "diagonal-down" // -1 かつ別レター
  | "none";

export interface CamelotCompatibility {
  relation: MixRelation;
  /** 0-100 のハーモニック適合スコア */
  score: number;
  label: string;
  description: string;
  compatible: boolean;
}

/** Camelot → 一般的な調表記 */
export const CAMELOT_TO_MUSICAL_KEY: Record<string, string> = {
  "1A": "A♭m", "1B": "B",
  "2A": "E♭m", "2B": "F♯",
  "3A": "B♭m", "3B": "D♭",
  "4A": "Fm", "4B": "A♭",
  "5A": "Cm", "5B": "E♭",
  "6A": "Gm", "6B": "B♭",
  "7A": "Dm", "7B": "F",
  "8A": "Am", "8B": "C",
  "9A": "Em", "9B": "G",
  "10A": "Bm", "10B": "D",
  "11A": "F♯m", "11B": "A",
  "12A": "D♭m", "12B": "E",
};

/** 全 24 キー（1A,1B,2A,2B,... の順） */
export const ALL_CAMELOT_KEYS: string[] = Array.from({ length: 12 }, (_, i) => i + 1).flatMap(
  (n) => [`${n}A`, `${n}B`],
);

const CAMELOT_PATTERN = /^\s*(1[0-2]|[1-9])\s*([ABab])\s*$/;

/** "8a" / " 8 A " などを正規化してパースする。不正なら null */
export function parseCamelot(input: string | null | undefined): CamelotKey | null {
  if (!input) return null;
  const m = CAMELOT_PATTERN.exec(input);
  if (!m) return null;
  return {
    number: Number(m[1]),
    letter: m[2].toUpperCase() as CamelotLetter,
  };
}

export function formatCamelot(key: CamelotKey): string {
  return `${key.number}${key.letter}`;
}

export function isValidCamelot(input: string | null | undefined): boolean {
  return parseCamelot(input) !== null;
}

/** Camelot 文字列を正規化（"8a" -> "8A"）。不正なら null */
export function normalizeCamelot(input: string | null | undefined): string | null {
  const key = parseCamelot(input);
  return key ? formatCamelot(key) : null;
}

export function toMusicalKey(camelot: string): string | null {
  const normalized = normalizeCamelot(camelot);
  return normalized ? (CAMELOT_TO_MUSICAL_KEY[normalized] ?? null) : null;
}

/** 一般的な調表記（"Am", "F#m", "Bb" など）から Camelot を逆引き */
export function musicalKeyToCamelot(input: string): string | null {
  const cleaned = input
    .trim()
    .replace(/♯/g, "#")
    .replace(/♭/g, "b")
    .replace(/\s+/g, "")
    .toLowerCase();
  if (!cleaned) return null;

  const isMinor = /(m|min|minor)$/.test(cleaned) && !/maj/.test(cleaned);
  const root = cleaned.replace(/(maj|major|minor|min|m)$/, "");

  // 異名同音を吸収するためピッチクラスで比較する
  const PITCH: Record<string, number> = {
    c: 0, "b#": 0,
    "c#": 1, db: 1,
    d: 2,
    "d#": 3, eb: 3,
    e: 4, fb: 4,
    f: 5, "e#": 5,
    "f#": 6, gb: 6,
    g: 7,
    "g#": 8, ab: 8,
    a: 9,
    "a#": 10, bb: 10,
    b: 11, cb: 11,
  };
  const pitch = PITCH[root];
  if (pitch === undefined) return null;

  const letter: CamelotLetter = isMinor ? "A" : "B";
  for (const camelot of ALL_CAMELOT_KEYS) {
    const key = parseCamelot(camelot)!;
    if (key.letter !== letter) continue;
    const musical = CAMELOT_TO_MUSICAL_KEY[camelot];
    const musicalRoot = musical
      .replace(/♯/g, "#")
      .replace(/♭/g, "b")
      .replace(/m$/, "")
      .toLowerCase();
    if (PITCH[musicalRoot] === pitch) return camelot;
  }
  return null;
}

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

const RELATION_META: Record<
  Exclude<MixRelation, "none">,
  { score: number; label: string; description: string }
> = {
  perfect: {
    score: 100,
    label: "完全一致",
    description: "同じキー。最も安全で長いブレンドが可能。",
  },
  "energy-up": {
    score: 95,
    label: "エナジーアップ (+1)",
    description: "時計回りに 1 つ。明るく高揚する定番の繋ぎ。",
  },
  "energy-down": {
    score: 93,
    label: "エナジーダウン (-1)",
    description: "反時計回りに 1 つ。落ち着いた展開を作る。",
  },
  relative: {
    score: 90,
    label: "平行調 (A↔B)",
    description: "同番号のメジャー / マイナー。ムードを切り替える。",
  },
  "energy-boost": {
    score: 72,
    label: "エナジーブースト (+2)",
    description: "全音上げ。勢いよく持ち上げるが少し攻めた繋ぎ。",
  },
  "diagonal-up": {
    score: 66,
    label: "ダイアゴナル (+1 / 転調)",
    description: "番号 +1 かつメジャー / マイナー切替。上級者向け。",
  },
  "diagonal-down": {
    score: 62,
    label: "ダイアゴナル (-1 / 転調)",
    description: "番号 -1 かつメジャー / マイナー切替。上級者向け。",
  },
};

const INCOMPATIBLE: CamelotCompatibility = {
  relation: "none",
  score: 0,
  label: "非推奨",
  description: "Camelot 上の隣接関係になく、キーがぶつかりやすい。",
  compatible: false,
};

/** from → to のハーモニック適合を判定する */
export function getCamelotCompatibility(
  from: string | CamelotKey,
  to: string | CamelotKey,
): CamelotCompatibility {
  const a = typeof from === "string" ? parseCamelot(from) : from;
  const b = typeof to === "string" ? parseCamelot(to) : to;
  if (!a || !b) return INCOMPATIBLE;

  const diff = mod12(b.number - a.number);
  const sameLetter = a.letter === b.letter;

  let relation: MixRelation = "none";
  if (sameLetter) {
    if (diff === 0) relation = "perfect";
    else if (diff === 1) relation = "energy-up";
    else if (diff === 11) relation = "energy-down";
    else if (diff === 2) relation = "energy-boost";
  } else {
    if (diff === 0) relation = "relative";
    else if (diff === 1) relation = "diagonal-up";
    else if (diff === 11) relation = "diagonal-down";
  }

  if (relation === "none") return INCOMPATIBLE;
  const meta = RELATION_META[relation];
  return { relation, ...meta, compatible: true };
}

/** from から繋げられるキー一覧（スコア降順） */
export function getCompatibleKeys(
  from: string | CamelotKey,
): Array<{ camelot: string; compatibility: CamelotCompatibility }> {
  return ALL_CAMELOT_KEYS.map((camelot) => ({
    camelot,
    compatibility: getCamelotCompatibility(from, camelot),
  }))
    .filter((entry) => entry.compatibility.compatible)
    .sort((x, y) => y.compatibility.score - x.compatibility.score);
}

/** Camelot 番号に対応する色相（0-359）。バッジやホイールの着色に使う */
export function camelotHue(camelot: string | CamelotKey): number {
  const key = typeof camelot === "string" ? parseCamelot(camelot) : camelot;
  if (!key) return 0;
  return ((key.number - 1) * 30 + 15) % 360;
}
