import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  energyFit,
  energyTargets,
  generateAutoSet,
  MAX_ENERGY_JUMP,
  TEMPO_BAND_PERCENT,
  tempoBandPenalty,
  type AutoSetOptions,
  type EnergyShape,
} from "../src/lib/autoset";
import { ALL_CAMELOT_KEYS } from "../src/lib/camelot";
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

/** 再現性のある疑似乱数（Math.random だとテストが揺れる） */
function lcg(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}

/** 120〜132 BPM・全キー・エナジー 1〜10 が混ざったライブラリ */
function library(size: number, seed = 42): TrackDTO[] {
  const rand = lcg(seed);
  return Array.from({ length: size }, (_, i) =>
    track(
      `t${String(i).padStart(3, "0")}`,
      Math.round((120 + rand() * 12) * 10) / 10,
      ALL_CAMELOT_KEYS[Math.floor(rand() * 24)],
      1 + Math.floor(rand() * 10),
      rand() < 0.5 ? "House" : "Techno",
    ),
  );
}

const ids = (tracks: TrackDTO[]) => tracks.map((t) => t.id);

/** 100〜180 BPM に散らばったライブラリ（テンポが流れやすい） */
function wideLibrary(size: number, seed: number): TrackDTO[] {
  const rand = lcg(seed);
  return Array.from({ length: size }, (_, i) =>
    track(
      `w${String(i).padStart(3, "0")}`,
      Math.round((100 + rand() * 80) * 10) / 10,
      ALL_CAMELOT_KEYS[Math.floor(rand() * 24)],
      1 + Math.floor(rand() * 10),
    ),
  );
}

/** セット上で実際に鳴っているテンポの、1 曲目からの最大のずれ（%） */
function maxTempoDeviation(result: ReturnType<typeof generateAutoSet>): number {
  let scale = 1;
  let worst = 0;
  const anchor = result.tracks[0].bpm;
  result.tracks.forEach((t, i) => {
    if (i > 0) scale *= result.transitions[i - 1].bpm.ratio;
    worst = Math.max(worst, (Math.abs(t.bpm * scale - anchor) / anchor) * 100);
  });
  return worst;
}

describe("energyTargets", () => {
  test("1 曲目は起点のエナジーそのもの", () => {
    for (const shape of ["arc", "build", "steady", "cooldown"] as EnergyShape[]) {
      assert.equal(energyTargets(4, 10, shape)[0], 4, shape);
    }
  });

  test("右肩上がりは単調増加して 9 で終わる", () => {
    const t = energyTargets(4, 10, "build");
    assert.equal(t.at(-1), 9);
    assert.ok(t.every((v, i) => i === 0 || v >= t[i - 1]));
  });

  test("クールダウンは単調減少して 3 で終わる", () => {
    const t = energyTargets(8, 10, "cooldown");
    assert.equal(t.at(-1), 3);
    assert.ok(t.every((v, i) => i === 0 || v <= t[i - 1]));
  });

  test("山型は 7 割あたりでピークを迎え、最後は起点とピークの中間まで下がる", () => {
    const t = energyTargets(4, 11, "arc");
    const peakIndex = t.indexOf(Math.max(...t));
    assert.equal(peakIndex, 7);
    assert.equal(t[peakIndex], 9);
    assert.equal(t.at(-1), 6.5);
  });

  test("一定は全曲同じ", () => {
    assert.deepEqual(energyTargets(6, 5, "steady"), [6, 6, 6, 6, 6]);
  });

  test("起点が既にピークより高ければ、上げる形でも下げない", () => {
    assert.ok(energyTargets(10, 6, "build").every((v) => v === 10));
  });
});

describe("energyFit", () => {
  test("目標どおりなら満点、離れるほど減点", () => {
    assert.equal(energyFit(5, 6, 6), 100);
    assert.ok(energyFit(5, 7, 6) < 100);
    assert.ok(energyFit(5, 8, 6) < energyFit(5, 7, 6));
  });

  test("目標どおりでも 1 曲で 3 以上跳ねると減点する", () => {
    assert.equal(energyFit(5, 7, 7), 100, "+2 までは許容");
    assert.ok(energyFit(3, 7, 7) < 100, "+4 は減点");
  });
});

describe("tempoBandPenalty", () => {
  test(`1 曲目の ±${TEMPO_BAND_PERCENT}% 以内は減点しない`, () => {
    assert.equal(tempoBandPenalty(128, 128), 0);
    assert.equal(tempoBandPenalty(135.6, 128), 0); // +5.9%
    assert.equal(tempoBandPenalty(120.4, 128), 0); // -5.9%
  });

  test("帯を外れるほど大きく減点する", () => {
    const a = tempoBandPenalty(140, 128); // +9.4%
    const b = tempoBandPenalty(150, 128); // +17.2%
    assert.ok(a > 0 && b > a);
  });
});

describe("generateAutoSet", () => {
  test("貪欲法だと袋小路で止まるが、ビームサーチなら最後まで組める", () => {
    // S→A が一番良く見えるが、A からはどの曲にもテンポが合わない。
    // S→B は少し劣るが、B→C と続けられる。
    const S = track("S", 128, "8A");
    const A = track("A", 136, "8A"); // S→A: キー完全一致
    const B = track("B", 120, "9A"); // S→B: キーはエナジーアップ、テンポ差が大きめ
    const C = track("C", 116, "9A"); // B からしか繋がらない
    const options: AutoSetOptions = {
      length: 3,
      shape: "steady",
      keyCompatibleOnly: true,
      allowHalfDouble: false,
    };

    const greedy = generateAutoSet([S], [A, B, C], { ...options, beamWidth: 1 });
    assert.deepEqual(ids(greedy.tracks), ["S", "A"]);
    assert.equal(greedy.stoppedEarly, true);

    const beam = generateAutoSet([S], [A, B, C], options);
    assert.deepEqual(ids(beam.tracks), ["S", "B", "C"]);
    assert.equal(beam.stoppedEarly, false);
  });

  const pool = library(80);
  const start = track("start", 126, "8A", 4);

  for (const shape of ["arc", "build", "steady", "cooldown"] as EnergyShape[]) {
    test(`${shape}: 同じ曲を 2 回使わず、全ての繋ぎがテンポ的に繋げられる`, () => {
      const result = generateAutoSet([start], pool, { length: 12, shape });
      assert.equal(result.tracks.length, 12);
      assert.equal(new Set(ids(result.tracks)).size, 12);
      assert.equal(result.transitions.length, 11);
      assert.ok(result.transitions.every((t) => t.bpm.score > 0));
      assert.equal(result.targets.length, 12);
      // ピーク直後に 9 → 2 のような、フロアを冷やす急な落差を作らない
      const jumps = result.tracks.slice(1).map((t, i) => Math.abs(t.energy - result.tracks[i].energy));
      assert.ok(Math.max(...jumps) <= MAX_ENERGY_JUMP, `最大の落差 ${Math.max(...jumps)}`);
    });
  }

  test("キーとテンポが完璧でも、エナジーが急に動く曲は選ばない", () => {
    // 減点だけなら crash（75 点）が keep（約 33 点）に勝ってしまう状況を作る
    const peak = track("peak", 128, "8A", 9);
    const crash = track("crash", 128, "8A", 2); // キー完全一致・同テンポだがエナジー 9 → 2
    const keep = track("keep", 136, "3A", 8); // キーは合わずテンポもギリギリだが、エナジーは保てる
    const result = generateAutoSet([peak], [crash, keep], { length: 2, shape: "steady" });
    assert.deepEqual(ids(result.tracks), ["peak", "keep"]);
  });

  test("キー適合のみを指定すると、点数の高いキー違いの曲より、キーの合う曲を選ぶ", () => {
    // ランダムなライブラリでは指定が無くても全曲適合になりがちで区別できないため、
    // 指定の有無で選ぶ曲が変わる状況を作る
    const S = track("S", 128, "8A");
    const clash = track("clash", 128, "3A"); // 同テンポだがキーが合わない（65 点）
    const fits = track("fits", 138, "9A"); // キーは合うがテンポ差が大きい（約 62.6 点）
    const pick = (keyCompatibleOnly: boolean) =>
      generateAutoSet([S], [clash, fits], { length: 2, shape: "steady", keyCompatibleOnly }).tracks[1].id;
    assert.equal(pick(false), "clash", "指定が無ければ、点数どおりキー違いの曲も選ぶ");
    assert.equal(pick(true), "fits");
  });

  test("キー適合のみを指定すると、全ての繋ぎがハーモニックに合う", () => {
    const result = generateAutoSet([start], pool, { length: 10, shape: "arc", keyCompatibleOnly: true });
    assert.ok(result.transitions.every((t) => t.key.compatible));
  });

  test("クールダウンなら後半ほどエナジーが下がる", () => {
    const high = track("high", 126, "8A", 9);
    const { tracks } = generateAutoSet([high], pool, { length: 12, shape: "cooldown" });
    const mean = (list: TrackDTO[]) => list.reduce((s, t) => s + t.energy, 0) / list.length;
    assert.ok(mean(tracks.slice(6)) < mean(tracks.slice(0, 6)));
    assert.ok(tracks.at(-1)!.energy <= 5, `最後の曲のエナジー ${tracks.at(-1)!.energy}`);
  });

  test("右肩上がりなら最後の曲は最初より高い", () => {
    const { tracks } = generateAutoSet([start], pool, { length: 12, shape: "build" });
    assert.ok(tracks.at(-1)!.energy > tracks[0].energy);
  });

  test("今のセットの続きを組むときは、固定した曲の順番を変えない", () => {
    const fixed = [start, pool[0], pool[1]];
    const result = generateAutoSet(fixed, pool, { length: 8, shape: "arc" });
    assert.deepEqual(ids(result.tracks.slice(0, 3)), ids(fixed));
    assert.equal(result.generatedFrom, 3);
    assert.equal(result.tracks.length, 8);
    assert.equal(result.transitions.length, 7, "固定部分の繋ぎも表示用に含める");
  });

  test("除外した曲とジャンル外の曲は選ばない", () => {
    const excludeIds = ids(pool.slice(0, 20));
    const result = generateAutoSet([start], pool, {
      length: 8,
      shape: "steady",
      excludeIds,
      genre: "Techno",
    });
    const picked = result.tracks.slice(1);
    assert.ok(picked.every((t) => !excludeIds.includes(t.id)));
    assert.ok(picked.every((t) => t.genre === "Techno"));
  });

  test("候補が足りなければ途中で止めて、そのことを返す", () => {
    const result = generateAutoSet([start], pool.slice(0, 3), { length: 10, shape: "steady" });
    assert.ok(result.tracks.length < 10);
    assert.equal(result.stoppedEarly, true);
  });

  test("同じ入力なら同じセットを返す", () => {
    const a = generateAutoSet([start], pool, { length: 15, shape: "arc" });
    const b = generateAutoSet([start], pool, { length: 15, shape: "arc" });
    assert.deepEqual(ids(a.tracks), ids(b.tracks));
  });

  // 計算量が桁違いに悪化していないかの見張り。手元の実測は 150ms 前後で、
  // CI の実行環境の遅さを見込んでも数倍の余裕がある上限にしている
  test("数千曲のライブラリでも 1 秒以内に組める", () => {
    const big = library(3000, 7);
    const began = performance.now();
    const result = generateAutoSet([start], big, { length: 30, shape: "arc" });
    const elapsed = performance.now() - began;
    assert.equal(result.tracks.length, 30);
    assert.ok(elapsed < 1000, `${Math.round(elapsed)}ms`);
  });

  test("テンポを保つ設定だと、長いセットでも 1 曲目からのずれが小さい", () => {
    const pool = wideLibrary(200, 11);
    const starts = pool.filter((_, i) => i % 20 === 0);
    const mean = (keepTempo: boolean) =>
      starts
        .map((s) => maxTempoDeviation(generateAutoSet([s], pool, { length: 20, shape: "arc", keepTempo })))
        .reduce((a, b) => a + b, 0) / starts.length;
    const kept = mean(true);
    const free = mean(false);
    assert.ok(kept < free, `保つ ${kept.toFixed(1)}% / 保たない ${free.toFixed(1)}%`);
    assert.ok(kept <= 10, `保つ設定での平均ずれ ${kept.toFixed(1)}%`);
  });

  test("ダブルタイムで繋いだ曲は、元の BPM ではなくフロアで鳴るテンポで判定する", () => {
    // 87 BPM の曲をダブルで繋げばフロアは 174 のまま。元の 87 で判定すると
    // 1 曲目から 50% ずれた扱いになり、良い繋ぎなのに避けてしまう
    const start = track("start", 174, "8A");
    const half = track("half", 87, "8A"); // ダブルタイムでぴったり・キー完全一致
    const near = track("near", 166, "8A"); // 等倍で繋がるが、テンポ差が大きめ
    const result = generateAutoSet([start], [half, near], { length: 2, shape: "steady" });
    assert.deepEqual(ids(result.tracks), ["start", "half"]);
    assert.equal(result.transitions[0].bpm.ratio, 2);
  });

  test("テンポ帯の減点は曲順選びにだけ使い、繋ぎの点数には混ぜない", () => {
    const pool = wideLibrary(200, 11);
    const result = generateAutoSet([pool[0]], pool, { length: 15, shape: "arc" });
    const mean = result.transitions.reduce((a, t) => a + t.score, 0) / result.transitions.length;
    assert.equal(result.averageScore, Math.round(mean * 10) / 10);
  });

  test("1 曲目が無ければ例外", () => {
    assert.throws(() => generateAutoSet([], pool, { length: 5, shape: "arc" }), /1 曲目/);
  });
});
