import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ALL_CAMELOT_KEYS,
  getCamelotCompatibility,
  getCompatibleKeys,
  musicalKeyToCamelot,
  normalizeCamelot,
  parseCamelot,
  toMusicalKey,
} from "../src/lib/camelot";

describe("parseCamelot / normalizeCamelot", () => {
  test("大小文字と空白を吸収する", () => {
    assert.deepEqual(parseCamelot("8a"), { number: 8, letter: "A" });
    assert.deepEqual(parseCamelot(" 12 B "), { number: 12, letter: "B" });
    assert.equal(normalizeCamelot("11b"), "11B");
  });

  test("範囲外・不正な表記は null", () => {
    for (const input of ["13A", "0A", "8C", "A8", "", "  ", null, undefined]) {
      assert.equal(parseCamelot(input), null, `${JSON.stringify(input)} は不正`);
    }
  });

  test("24 キーすべてを持つ", () => {
    assert.equal(ALL_CAMELOT_KEYS.length, 24);
    assert.equal(new Set(ALL_CAMELOT_KEYS).size, 24);
  });
});

describe("getCamelotCompatibility", () => {
  const cases: Array<[string, string, string, number]> = [
    ["8A", "8A", "perfect", 100],
    ["8A", "9A", "energy-up", 95],
    ["8A", "7A", "energy-down", 93],
    ["8A", "8B", "relative", 90],
    ["8A", "10A", "energy-boost", 72],
    ["8A", "9B", "diagonal-up", 66],
    ["8A", "7B", "diagonal-down", 62],
  ];

  for (const [from, to, relation, score] of cases) {
    test(`${from} → ${to} は ${relation} (${score})`, () => {
      const result = getCamelotCompatibility(from, to);
      assert.equal(result.relation, relation);
      assert.equal(result.score, score);
      assert.equal(result.compatible, true);
    });
  }

  test("隣接しないキーは非互換で 0 点", () => {
    const result = getCamelotCompatibility("8A", "3A");
    assert.equal(result.relation, "none");
    assert.equal(result.score, 0);
    assert.equal(result.compatible, false);
  });

  test("12 と 1 の境目をまたいでも隣接として扱う", () => {
    assert.equal(getCamelotCompatibility("12A", "1A").relation, "energy-up");
    assert.equal(getCamelotCompatibility("1A", "12A").relation, "energy-down");
    assert.equal(getCamelotCompatibility("11A", "1A").relation, "energy-boost");
    assert.equal(getCamelotCompatibility("12B", "1A").relation, "diagonal-up");
  });

  test("平行調は双方向、エナジーアップ/ダウンは向きで入れ替わる", () => {
    assert.equal(getCamelotCompatibility("8A", "8B").relation, "relative");
    assert.equal(getCamelotCompatibility("8B", "8A").relation, "relative");
    assert.equal(getCamelotCompatibility("8A", "9A").relation, "energy-up");
    assert.equal(getCamelotCompatibility("9A", "8A").relation, "energy-down");
  });

  test("不正な入力は非互換として扱い、例外を投げない", () => {
    assert.equal(getCamelotCompatibility("xx", "8A").compatible, false);
    assert.equal(getCamelotCompatibility("8A", "").compatible, false);
  });
});

describe("getCompatibleKeys", () => {
  test("自分自身を先頭に、繋げられる 7 キーをスコア降順で返す", () => {
    const keys = getCompatibleKeys("8A");
    assert.deepEqual(
      keys.map((k) => k.camelot),
      ["8A", "9A", "7A", "8B", "10A", "9B", "7B"],
    );
    const scores = keys.map((k) => k.compatibility.score);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  });
});

describe("調表記 ↔ Camelot", () => {
  const cases: Array<[string, string]> = [
    ["Am", "8A"],
    ["C", "8B"],
    ["F#m", "11A"],
    ["Gbm", "11A"], // 異名同音
    ["Bb", "6B"],
    ["A#", "6B"], // 異名同音
    ["Dbm", "12A"],
    ["C#m", "12A"],
    ["Abm", "1A"],
    ["E", "12B"],
    ["A minor", "8A"],
    ["Amin", "8A"],
    ["Amaj", "11B"],
    ["F♯m", "11A"], // 記号の ♯
    ["E♭", "5B"], // 記号の ♭
  ];

  for (const [musical, camelot] of cases) {
    test(`${musical} → ${camelot}`, () => {
      assert.equal(musicalKeyToCamelot(musical), camelot);
    });
  }

  test("解釈できない表記は null（ドイツ式の H を含む）", () => {
    for (const input of ["H", "", "X#m", "Z"]) {
      assert.equal(musicalKeyToCamelot(input), null, `${JSON.stringify(input)}`);
    }
  });

  test("24 キーすべてで Camelot → 調表記 → Camelot が元に戻る", () => {
    for (const key of ALL_CAMELOT_KEYS) {
      const musical = toMusicalKey(key);
      assert.ok(musical, `${key} の調表記が無い`);
      assert.equal(musicalKeyToCamelot(musical), key, `${key} → ${musical} → ?`);
    }
  });

  test("toMusicalKey は小文字の Camelot も受け付け、不正なら null", () => {
    assert.equal(toMusicalKey("8a"), "Am");
    assert.equal(toMusicalKey("zz"), null);
  });
});
