import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { bpmRange, formatBpm, matchBpm } from "../src/lib/bpm";

const close = (actual: number, expected: number, epsilon = 0.01) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} ≒ ${expected}`);

describe("matchBpm", () => {
  test("同じ BPM は満点・ピッチ調整なし", () => {
    const m = matchBpm(128, 128);
    assert.equal(m.score, 100);
    assert.equal(m.ratio, 1);
    assert.equal(m.pitchPercent, 0);
  });

  test("ピッチ差 1% 以内は実質無調整として満点", () => {
    const m = matchBpm(124, 125);
    close(m.pitchPercent, -0.8);
    assert.equal(m.score, 100);
  });

  test("許容幅に近づくほど線形に減点する", () => {
    // 124 → 128 に合わせるには +3.23%。1%〜8% の間で線形に 100 → 0
    const m = matchBpm(128, 124);
    close(m.pitchPercent, 3.2258);
    close(m.score, 100 * (1 - (3.2258 - 1) / 7), 0.05);
    assert.equal(m.label, "ピッチ +3.2%");
  });

  test("ピッチの符号は「次の曲をどちらへ動かすか」を表す", () => {
    assert.ok(matchBpm(128, 124).pitchPercent > 0, "遅い曲は上げる");
    assert.ok(matchBpm(124, 128).pitchPercent < 0, "速い曲は下げる");
    assert.equal(matchBpm(120, 126).bpmDiff, 6);
  });

  test("許容幅を超えたら 0 点", () => {
    assert.equal(matchBpm(128, 120, { maxPitchPercent: 4 }).score, 0);
    assert.ok(matchBpm(128, 120, { maxPitchPercent: 8 }).score > 0);
  });

  test("ダブルタイム: 140 に 70 の曲を倍速で合わせる（0.85 倍に減衰）", () => {
    const m = matchBpm(140, 70);
    assert.equal(m.ratio, 2);
    assert.equal(m.effectiveBpm, 140);
    close(m.score, 85);
    assert.match(m.label, /ダブルタイム/);
  });

  test("ハーフタイム: 70 に 140 の曲を半速で合わせる", () => {
    const m = matchBpm(70, 140);
    assert.equal(m.ratio, 0.5);
    close(m.score, 85);
    assert.match(m.label, /ハーフタイム/);
  });

  test("ハーフ/ダブルを禁止すると倍テンポの曲は候補外", () => {
    const m = matchBpm(140, 70, { allowHalfDouble: false });
    assert.equal(m.ratio, 1);
    assert.equal(m.score, 0);
  });

  test("等倍で合うならハーフ/ダブルより等倍を選ぶ", () => {
    assert.equal(matchBpm(128, 128).ratio, 1);
  });

  test("どの倍率でも合わなければ 0 点で等倍を返す", () => {
    const m = matchBpm(128, 100);
    assert.equal(m.score, 0);
    assert.equal(m.ratio, 1);
  });
});

describe("bpmRange / formatBpm", () => {
  test("±8% で同期できる BPM 帯", () => {
    const range = bpmRange(128, 8);
    close(range.min, 118.52);
    close(range.max, 138.24);
  });

  test("整数はそのまま、小数は 1 桁", () => {
    assert.equal(formatBpm(128), "128");
    assert.equal(formatBpm(127.5), "127.5");
  });
});
