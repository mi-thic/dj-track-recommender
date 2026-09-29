import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { SpotifyTrack } from "../src/lib/spotify/api";
import { normalizeForMatch, rankCandidates, scoreMatch } from "../src/lib/spotify/match";

function candidate(
  name: string,
  artists: string[],
  durationSec: number,
  popularity: number | null = null,
): SpotifyTrack {
  return {
    id: `${name}-${durationSec}`,
    name,
    artists,
    album: "A",
    albumArtUrl: null,
    durationSec,
    releaseYear: null,
    isrc: null,
    url: "",
    uri: "",
    popularity,
  };
}

describe("normalizeForMatch", () => {
  const cases: Array<[string, string]> = [
    ["Midnight Circuit - Extended Mix", "midnight circuit"],
    ["Neon Corridor (Original Mix)", "neon corridor"],
    ["Open Sky (feat. Mia)", "open sky"],
    ["Café Del Mar", "cafe del mar"],
    ["Zero Hour [Club Edit]", "zero hour"],
    ["深夜の回路 (Extended Mix)", "深夜の回路"],
  ];
  for (const [input, expected] of cases) {
    test(`${input} → ${expected}`, () => assert.equal(normalizeForMatch(input), expected));
  }
});

describe("scoreMatch: 自動で紐付けてよいか", () => {
  type Local = { title: string; artist: string; durationSec: number | null };
  const cases: Array<[string, Local, SpotifyTrack, boolean]> = [
    [
      "完全一致",
      { title: "Midnight Circuit", artist: "Kade Rivers", durationSec: 372 },
      candidate("Midnight Circuit", ["Kade Rivers"], 372),
      true,
    ],
    [
      "Extended Mix の表記ゆれ",
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
      "45 秒差（Extended と Original の範囲）",
      { title: "Low Orbit", artist: "Halcyon Bros", durationSec: 410 },
      candidate("Low Orbit", ["Halcyon Bros"], 365),
      true,
    ],
    [
      "別アーティストの同名曲",
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
      "同名だが曲尺が 186 秒違う（Radio Edit）",
      { title: "Hard Reset", artist: "Vess", durationSec: 366 },
      candidate("Hard Reset - Radio Edit", ["Vess"], 180),
      false,
    ],
  ];

  for (const [label, local, cand, expected] of cases) {
    test(`${label} → ${expected ? "自動紐付け" : "要確認"}`, () => {
      const match = scoreMatch(local, cand);
      assert.equal(match.confident, expected, `score=${match.score.toFixed(3)} (${match.reason})`);
    });
  }
});

describe("rankCandidates", () => {
  test("曲尺が分からなくても、本家を Radio Edit / Club Edit より上に並べる", () => {
    const ranked = rankCandidates({ title: "Strobe", artist: "deadmau5", durationSec: null }, [
      candidate("Strobe - Radio Edit", ["deadmau5"], 214),
      candidate("Strobe - Club Edit", ["deadmau5"], 381),
      candidate("Strobe", ["deadmau5"], 634),
    ]);
    assert.equal(ranked[0].candidate.name, "Strobe");
    assert.ok(ranked[0].match.score > ranked[1].match.score);
  });

  test("こちらにもミックス表記があれば、候補側の表記では減点しない", () => {
    const [top] = rankCandidates(
      { title: "Strobe (Radio Edit)", artist: "deadmau5", durationSec: null },
      [candidate("Strobe - Radio Edit", ["deadmau5"], 214)],
    );
    assert.equal(top.match.score, 1);
  });

  test("同点なら人気度の高い方を先にする", () => {
    const ranked = rankCandidates({ title: "Glue", artist: "Bicep", durationSec: null }, [
      candidate("Glue", ["Bicep"], 269, 20),
      candidate("Glue", ["Bicep"], 270, 80),
    ]);
    assert.equal(ranked[0].match.score, ranked[1].match.score);
    assert.deepEqual(ranked.map((r) => r.candidate.popularity), [80, 20]);
  });
});
