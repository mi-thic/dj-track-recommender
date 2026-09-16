/**
 * Spotify マッチングの挙動確認スクリプト。
 *
 *   docker compose exec app npx tsx scripts/check-spotify-match.ts
 *   （ローカルに Node がある場合は npx tsx scripts/check-spotify-match.ts）
 *
 * Spotify の認証情報が無くても動く。しきい値やミックス表記の扱いを
 * 変えたときに、意図した判定のままか確かめるために使う。
 */
import type { SpotifyTrack } from "../src/lib/spotify/api";
import { normalizeForMatch, scoreMatch } from "../src/lib/spotify/match";

function candidate(name: string, artists: string[], durationSec: number): SpotifyTrack {
  return {
    id: "x",
    name,
    artists,
    album: "A",
    albumArtUrl: null,
    durationSec,
    releaseYear: null,
    isrc: null,
    url: "",
    uri: "",
    popularity: null,
  };
}

type LocalTrack = { title: string; artist: string; durationSec: number | null };

/** [説明, ローカル曲, Spotify の候補, 自動紐付けされるべきか] */
const cases: Array<[string, LocalTrack, SpotifyTrack, boolean]> = [
  [
    "完全一致",
    { title: "Midnight Circuit", artist: "Kade Rivers", durationSec: 372 },
    candidate("Midnight Circuit", ["Kade Rivers"], 372),
    true,
  ],
  [
    "Extended Mix 表記ゆれ",
    { title: "Midnight Circuit", artist: "Kade Rivers", durationSec: 372 },
    candidate("Midnight Circuit - Extended Mix", ["Kade Rivers"], 374),
    true,
  ],
  [
    "(Original Mix) 付き",
    { title: "Neon Corridor (Original Mix)", artist: "Nova Kai", durationSec: 402 },
    candidate("Neon Corridor", ["Nova Kai"], 400),
    true,
  ],
  [
    "feat. 表記",
    { title: "Open Sky (feat. Mia)", artist: "Rina Sato feat. Mia", durationSec: 448 },
    candidate("Open Sky", ["Rina Sato", "Mia"], 448),
    true,
  ],
  [
    "アクセント違い",
    { title: "Cafe Del Mar", artist: "Energy 52", durationSec: 400 },
    candidate("Café Del Mar", ["Energy 52"], 400),
    true,
  ],
  [
    "アーティスト違い（別人の同名曲）",
    { title: "Glass Avenue", artist: "Selah Fields", durationSec: 431 },
    candidate("Glass Avenue", ["Completely Different Artist"], 430),
    false,
  ],
  [
    "タイトル違い",
    { title: "Iron Lung", artist: "Dex Harlow", durationSec: 378 },
    candidate("Paper Moon", ["Dex Harlow"], 378),
    false,
  ],
  [
    "同名だが曲尺が大幅に違う（Radio Edit）",
    { title: "Hard Reset", artist: "Vess", durationSec: 366 },
    candidate("Hard Reset - Radio Edit", ["Vess"], 180),
    false,
  ],
  [
    "45 秒差（Extended と Original の範囲）",
    { title: "Low Orbit", artist: "Halcyon Bros", durationSec: 410 },
    candidate("Low Orbit", ["Halcyon Bros"], 365),
    true,
  ],
];

console.log("--- normalizeForMatch ---");
for (const sample of [
  "Midnight Circuit - Extended Mix",
  "Neon Corridor (Original Mix)",
  "Open Sky (feat. Mia)",
  "Café Del Mar",
  "Zero Hour [Club Edit]",
  "深夜の回路 (Extended Mix)",
]) {
  console.log(`  ${JSON.stringify(sample)} -> ${JSON.stringify(normalizeForMatch(sample))}`);
}

console.log("\n--- scoreMatch ---");
let failures = 0;
for (const [label, local, cand, expected] of cases) {
  const match = scoreMatch(local, cand);
  const ok = match.confident === expected;
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? "OK  " : "FAIL"} ${label.padEnd(32)} score=${match.score.toFixed(3)} ` +
      `title=${match.titleScore.toFixed(2)} artist=${match.artistScore.toFixed(2)} ` +
      `confident=${match.confident}` +
      (ok ? "" : `  期待=${expected} / ${match.reason}`),
  );
}

console.log(`\n${failures === 0 ? "すべて期待通り" : `${failures} 件が期待と異なる`}`);
process.exit(failures === 0 ? 0 : 1);
