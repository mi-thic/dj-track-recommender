import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { recommendNextTracks, scoreRank } from "../src/lib/recommend";
import type { TrackDTO } from "../src/lib/types";

function track(
  id: string,
  bpm: number,
  camelot: string,
  energy = 5,
  genre: string | null = "House",
): TrackDTO {
  return {
    id,
    title: id,
    artist: "Test",
    bpm,
    camelot,
    musicalKey: null,
    genre,
    energy,
    durationSec: 300,
    releaseYear: null,
    label: null,
    notes: null,
    spotifyId: null,
    spotifyUrl: null,
    albumArtUrl: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const ids = (results: Array<{ track: TrackDTO }>) => results.map((r) => r.track.id);

const FROM = track("from", 128, "8A", 5);

describe("recommendNextTracks", () => {
  test("自分自身と excludeIds（プレイ済み）は候補に出さない", () => {
    const pool = [FROM, track("a", 128, "8A"), track("b", 128, "9A")];
    assert.deepEqual(ids(recommendNextTracks(FROM, pool)).sort(), ["a", "b"]);
    assert.deepEqual(ids(recommendNextTracks(FROM, pool, { excludeIds: ["a"] })), ["b"]);
  });

  test("テンポもキーも合う曲が、キーの合わない曲より上に来る", () => {
    const pool = [track("clash", 128, "3A"), track("smooth", 128, "9A")];
    assert.deepEqual(ids(recommendNextTracks(FROM, pool)), ["smooth", "clash"]);
  });

  test("keyCompatibleOnly でキーの合わない曲を除外する", () => {
    const pool = [track("clash", 128, "3A"), track("smooth", 128, "9A")];
    assert.deepEqual(ids(recommendNextTracks(FROM, pool, { keyCompatibleOnly: true })), ["smooth"]);
  });

  test("テンポもキーも合わない曲は下限スコア未満で落ちる", () => {
    // BPM 0 点・キー 0 点・エナジーのみ 91 点 → 13.65 点 < 既定の 30 点
    const pool = [track("far", 90, "3A")];
    assert.deepEqual(recommendNextTracks(FROM, pool), []);
    assert.equal(recommendNextTracks(FROM, pool, { minScore: 0 }).length, 1);
  });

  test("ジャンルで絞り込める", () => {
    const pool = [track("house", 128, "8A", 5, "House"), track("techno", 128, "8A", 5, "Techno")];
    assert.deepEqual(ids(recommendNextTracks(FROM, pool, { genre: "Techno" })), ["techno"]);
  });

  test("エナジーは維持〜+1 が理想で、大きく下げるほど順位が落ちる", () => {
    const pool = [
      track("down2", 128, "8A", 3),
      track("keep", 128, "8A", 5),
      track("up1", 128, "8A", 6),
    ];
    const result = recommendNextTracks(FROM, pool);
    const byId = Object.fromEntries(result.map((r) => [r.track.id, r]));
    assert.equal(byId.keep.energy.score, byId.up1.energy.score, "0 と +1 は同点");
    assert.ok(byId.keep.score > byId.down2.score);
    assert.equal(result.at(-1)?.track.id, "down2");
  });

  test("完全一致の曲はほぼ満点", () => {
    const [top] = recommendNextTracks(FROM, [track("same", 128, "8A", 5)]);
    assert.ok(top.score > 98, `score=${top.score}`);
  });

  test("重みを変えるとランキングが変わる（テンポだけ見るならキー違いでも同 BPM が勝つ）", () => {
    const pool = [track("sameBpmClash", 128, "3A"), track("slowerSameKey", 122, "8A")];
    const byDefault = ids(recommendNextTracks(FROM, pool, { minScore: 0 }));
    const byTempoOnly = ids(
      recommendNextTracks(FROM, pool, { minScore: 0, weights: { bpm: 1, key: 0, energy: 0 } }),
    );
    assert.equal(byDefault[0], "slowerSameKey");
    assert.equal(byTempoOnly[0], "sameBpmClash");
  });

  test("結果はスコア降順で limit 件まで", () => {
    const pool = Array.from({ length: 20 }, (_, i) => track(`t${i}`, 120 + i * 0.5, "8A"));
    const result = recommendNextTracks(FROM, pool, { limit: 5 });
    assert.equal(result.length, 5);
    const scores = result.map((r) => r.score);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  });

  test("ダブルタイムで繋ぐ候補には理由にその旨が入る", () => {
    const [top] = recommendNextTracks(track("dnb", 174, "8A"), [track("half", 87, "8A")]);
    assert.ok(top.reasons.some((r) => r.includes("ダブルタイム")), top.reasons.join(" / "));
  });

  test("候補が空なら空配列", () => {
    assert.deepEqual(recommendNextTracks(FROM, []), []);
  });
});

describe("scoreRank", () => {
  const cases: Array<[number, string]> = [
    [100, "excellent"],
    [85, "excellent"],
    [84.9, "good"],
    [70, "good"],
    [69.9, "fair"],
    [55, "fair"],
    [54.9, "risky"],
    [0, "risky"],
  ];
  for (const [score, tone] of cases) {
    test(`${score} 点は ${tone}`, () => assert.equal(scoreRank(score).tone, tone));
  }
});
