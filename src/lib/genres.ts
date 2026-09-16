/**
 * 楽曲登録フォームのジャンル候補。
 *
 * ジャンル欄は自由入力なのでここに無いものも登録できる。
 * この一覧はあくまで入力補助で、実際のライブラリにあるジャンルと
 * マージして表示する（mergeGenreSuggestions を参照）。
 */

/** ハウス系 */
const HOUSE = [
  "House",
  "Deep House",
  "Tech House",
  "Progressive House",
  "Melodic House",
  "Afro House",
  "Organic House",
  "Soulful House",
  "Funky House",
  "Jackin' House",
  "Bass House",
  "Disco House",
  "French House",
  "Tribal House",
  "Electro House",
  "Future House",
  "Big Room",
];

/** テクノ系 */
const TECHNO = [
  "Techno",
  "Melodic Techno",
  "Peak Time Techno",
  "Hard Techno",
  "Minimal / Deep Tech",
  "Detroit Techno",
  "Dub Techno",
  "Acid Techno",
  "Industrial Techno",
  "Hard Groove",
];

/** トランス系 */
const TRANCE = [
  "Trance",
  "Progressive Trance",
  "Uplifting Trance",
  "Tech Trance",
  "Psytrance",
  "Hard Trance",
  "Goa Trance",
];

/** ベース / ブレイクス系 */
const BASS = [
  "Drum & Bass",
  "Liquid Drum & Bass",
  "Neurofunk",
  "Jungle",
  "Breakbeat",
  "UK Garage",
  "2-Step",
  "Bassline",
  "Dubstep",
  "Future Bass",
  "Trap",
  "Hardstyle",
  "Hardcore",
  "Gabber",
  "Footwork",
];

/** ディスコ / ファンク系 */
const DISCO = [
  "Disco",
  "Nu Disco",
  "Italo Disco",
  "Funk",
  "Soul",
  "Boogie",
  "Balearic",
];

/** ダウンテンポ系 */
const DOWNTEMPO = [
  "Downtempo",
  "Ambient",
  "Chillout",
  "Trip Hop",
  "Lo-fi",
  "Dub",
];

/** その他のダンス / ワールド */
const WORLD = [
  "Amapiano",
  "Afrobeats",
  "Reggaeton",
  "Moombahton",
  "Baile Funk",
  "Dancehall",
  "Reggae",
  "Latin",
];

/** クラブ以外・邦楽 */
const OTHER = [
  "Hip Hop",
  "R&B",
  "Pop",
  "Rock",
  "Jazz",
  "Electronica",
  "Synthwave",
  "City Pop",
  "J-Pop",
  "K-Pop",
  "アニソン",
  "ボーカロイド",
];

export const GENRE_SUGGESTIONS: string[] = [
  ...HOUSE,
  ...TECHNO,
  ...TRANCE,
  ...BASS,
  ...DISCO,
  ...DOWNTEMPO,
  ...WORLD,
  ...OTHER,
];

/**
 * ライブラリで実際に使われているジャンルを先頭に、既定の候補を後ろに並べる。
 * 大文字小文字の違いはライブラリ側の表記を優先して 1 つにまとめる。
 */
export function mergeGenreSuggestions(fromLibrary: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const genre of [...fromLibrary, ...GENRE_SUGGESTIONS]) {
    const value = genre.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(value);
  }

  return merged;
}
