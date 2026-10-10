import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  applyTagChanges,
  countTags,
  hasAllTags,
  MAX_TAG_LENGTH,
  MAX_TAGS_PER_TRACK,
  mergeTagSuggestions,
  normalizeTag,
  normalizeTags,
  PRESET_TAGS,
} from "../src/lib/tags";

describe("normalizeTag", () => {
  test("前後の空白を落とし、連続した空白を 1 つにする", () => {
    assert.equal(normalizeTag("  ブレイク   長め "), "ブレイク 長め");
  });

  test("カンマ（クエリの区切り文字）と読点は空白に置き換える", () => {
    assert.equal(normalizeTag("a,b"), "a b");
    assert.equal(normalizeTag("ピーク、定番"), "ピーク 定番");
  });

  test("全角英数字は半角にそろえる", () => {
    assert.equal(normalizeTag("ＰＥＡＫ２"), "PEAK2");
  });

  test("空になれば null", () => {
    assert.equal(normalizeTag("   "), null);
    assert.equal(normalizeTag(",,"), null);
  });

  test(`${MAX_TAG_LENGTH} 文字で切る`, () => {
    assert.equal(normalizeTag("あ".repeat(MAX_TAG_LENGTH + 10))?.length, MAX_TAG_LENGTH);
  });
});

describe("normalizeTags", () => {
  test("空と重複（大小文字違いを含む）を除き、先に出た表記と順番を残す", () => {
    assert.deepEqual(normalizeTags(["Peak", "", "ボーカル", "peak", " PEAK "]), ["Peak", "ボーカル"]);
  });

  test(`既定では ${MAX_TAGS_PER_TRACK} 個までにする`, () => {
    const many = Array.from({ length: MAX_TAGS_PER_TRACK + 5 }, (_, i) => `t${i}`);
    assert.equal(normalizeTags(many).length, MAX_TAGS_PER_TRACK);
  });
});

describe("applyTagChanges", () => {
  test("付けるタグを末尾に足し、外すタグを取り除く。他のタグは残す", () => {
    assert.deepEqual(applyTagChanges(["定番", "ピーク"], ["ボーカルあり"], ["ピーク"]), ["定番", "ボーカルあり"]);
  });

  test("既にあるタグを足しても重複しない（大小文字違いも同じタグ）", () => {
    assert.deepEqual(applyTagChanges(["Peak"], ["peak"], []), ["Peak"]);
  });

  test("外すタグは大小文字を区別しない", () => {
    assert.deepEqual(applyTagChanges(["Peak", "チル"], [], ["PEAK"]), ["チル"]);
  });

  test("両方に入っていれば外す方が勝つ", () => {
    assert.deepEqual(applyTagChanges([], ["ピーク"], ["ピーク"]), []);
  });
});

describe("hasAllTags", () => {
  test("指定したタグをすべて持つときだけ true（AND）", () => {
    assert.equal(hasAllTags(["ピーク", "ボーカルあり"], ["ピーク", "ボーカルあり"]), true);
    assert.equal(hasAllTags(["ピーク"], ["ピーク", "ボーカルあり"]), false);
  });

  test("大小文字・全角半角の違いは無視する", () => {
    assert.equal(hasAllTags(["Peak"], ["ＰＥＡＫ"]), true);
  });

  test("指定が空なら常に true", () => {
    assert.equal(hasAllTags([], []), true);
  });
});

describe("countTags", () => {
  test("使用曲数の多い順、同数なら名前順。表記は最初に出たものを使う", () => {
    const result = countTags([
      { tags: ["チル", "Peak"] },
      { tags: ["peak"] },
      { tags: ["アンセム"] },
    ]);
    assert.deepEqual(result, [
      { tag: "Peak", count: 2 },
      { tag: "アンセム", count: 1 },
      { tag: "チル", count: 1 },
    ]);
  });
});

describe("mergeTagSuggestions", () => {
  test("ライブラリのタグを先に、既定のタグを後に並べ、重複を除く", () => {
    const result = mergeTagSuggestions(["自分用タグ", "ピーク"]);
    assert.deepEqual(result.slice(0, 2), ["自分用タグ", "ピーク"]);
    assert.equal(result.filter((t) => t === "ピーク").length, 1);
    assert.equal(result.length, PRESET_TAGS.length + 1);
  });
});
