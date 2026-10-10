/**
 * 曲のタグ（ムード・場面）。
 *
 * ジャンルは 1 曲に 1 つで粒度が粗いので、「ピーク」「ボーカルあり」のように
 * 1 曲に複数付けられるタグで補う。推薦・自動生成・一覧の絞り込みに使う。
 * DB に依存しない純粋関数なので、クライアントからもサーバーからも使える。
 */

/** 1 つのタグの最大文字数 */
export const MAX_TAG_LENGTH = 30;
/** 1 曲に付けられるタグの最大数 */
export const MAX_TAGS_PER_TRACK = 20;

/** 入力補助に出す既定のタグ。自由入力もできる */
export const TAG_PRESETS: Array<{ group: string; tags: string[] }> = [
  {
    group: "場面",
    tags: ["オープニング", "ウォームアップ", "ビルドアップ", "ピーク", "クールダウン", "締め"],
  },
  {
    group: "特徴",
    tags: ["ボーカルあり", "インスト", "ブレイク長め", "ドロップ強め", "繋ぎ用", "ツール"],
  },
  {
    group: "その他",
    tags: ["定番", "新譜", "盛り上がる", "チル", "アンセム", "シンガロング"],
  },
];

export const PRESET_TAGS: string[] = TAG_PRESETS.flatMap((group) => group.tags);

/**
 * 1 つのタグを正規化する。前後の空白を落とし、連続空白を 1 つにする。
 * カンマはクエリパラメータの区切りに使うので取り除く。空になれば null。
 */
export function normalizeTag(value: string): string | null {
  const tag = value
    .normalize("NFKC")
    .replace(/[,、，]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TAG_LENGTH)
    .trim();
  return tag === "" ? null : tag;
}

/** 大文字小文字・全角半角の違いを同じタグとして扱うための比較キー */
export function tagKey(tag: string): string {
  return tag.normalize("NFKC").toLowerCase();
}

/**
 * タグの配列を正規化する。空・重複（大小文字違いを含む）を除き、
 * 先に出てきた表記と順番を残す。limit を超えた分は捨てる。
 */
export function normalizeTags(values: string[], limit = MAX_TAGS_PER_TRACK): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (result.length >= limit) break;
    const tag = normalizeTag(value);
    if (!tag) continue;
    const key = tagKey(tag);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }
  return result;
}

/** 既存のタグに add を足し、remove を外す（大小文字違いは同じタグとみなす） */
export function applyTagChanges(current: string[], add: string[], remove: string[]): string[] {
  const removeKeys = new Set(remove.map(tagKey));
  return normalizeTags([...current, ...add]).filter((tag) => !removeKeys.has(tagKey(tag)));
}

/** required をすべて持っていれば true（AND 条件）。required が空なら常に true */
export function hasAllTags(trackTags: string[], required: string[]): boolean {
  if (required.length === 0) return true;
  const keys = new Set(trackTags.map(tagKey));
  return required.every((tag) => keys.has(tagKey(tag)));
}

export interface TagCount {
  tag: string;
  count: number;
}

/** ライブラリ全体のタグと使用曲数。多い順、同数なら名前順 */
export function countTags(tracks: Array<{ tags: string[] }>): TagCount[] {
  const counts = new Map<string, TagCount>();
  for (const track of tracks) {
    for (const tag of track.tags) {
      const key = tagKey(tag);
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { tag, count: 1 });
    }
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "ja"),
  );
}

/** ライブラリで使っているタグを先に、既定のタグを後ろに並べた入力候補 */
export function mergeTagSuggestions(fromLibrary: string[]): string[] {
  return normalizeTags([...fromLibrary, ...PRESET_TAGS], Number.POSITIVE_INFINITY);
}
