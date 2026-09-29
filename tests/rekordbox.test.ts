import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  energyFromComment,
  energyFromRating,
  openKeyToCamelot,
  parseRekordboxXml,
  resolveCamelot,
  selectPlaylistTracks,
} from "../src/lib/rekordbox";

describe("キー表記の解決", () => {
  test("Open Key（1d = C メジャー = 8B）", () => {
    assert.equal(openKeyToCamelot("1d"), "8B");
    assert.equal(openKeyToCamelot("1m"), "8A");
    assert.equal(openKeyToCamelot("12d"), "7B"); // F メジャー
    assert.equal(openKeyToCamelot("6m"), "1A"); // A♭ マイナー
    assert.equal(openKeyToCamelot(" 5 D "), "12B"); // E メジャー、空白と大文字を吸収
  });

  test("Open Key として不正なら null", () => {
    for (const input of ["13m", "0d", "1x", "m1", ""]) {
      assert.equal(openKeyToCamelot(input), null, JSON.stringify(input));
    }
  });

  test("rekordbox の 3 通りの表示設定をすべて同じ Camelot に解決する", () => {
    // A マイナー: Alphanumeric / Open Key / クラシック
    for (const tonality of ["8A", "8a", "1m", "Am"]) {
      assert.equal(resolveCamelot(tonality), "8A", tonality);
    }
  });

  test("未解析・解釈不能なら null", () => {
    for (const input of [null, undefined, "", "  ", "Hmm"]) {
      assert.equal(resolveCamelot(input), null, JSON.stringify(input));
    }
  });
});

describe("エナジーの読み取り", () => {
  test("コメント欄の明示的な表記", () => {
    assert.equal(energyFromComment("Energy 7 / long intro"), 7);
    assert.equal(energyFromComment("エナジー9 breakdown at 3:20"), 9);
    assert.equal(energyFromComment("energy: 4"), 4);
  });

  test("E7 のような短縮形", () => {
    assert.equal(energyFromComment("E4"), 4);
    assert.equal(energyFromComment("Remix E5"), 5);
  });

  test("E で始まる単語や他の数字を誤検出しない", () => {
    for (const comment of ["Edit version", "BPM 128", "CUE12", "", null]) {
      assert.equal(energyFromComment(comment), null, JSON.stringify(comment));
    }
  });

  test("範囲外は 1〜10 に丸める", () => {
    assert.equal(energyFromComment("Energy 15"), 10);
    assert.equal(energyFromComment("Energy 0"), 1);
  });

  test("レーティングは ★1 → 2 … ★5 → 10（0〜255 と 0〜5 の両方に対応）", () => {
    const cases: Array<[number | null, number | null]> = [
      [null, null],
      [0, null],
      [51, 2],
      [102, 4],
      [153, 6],
      [204, 8],
      [255, 10],
      [3, 6],
      [5, 10],
    ];
    for (const [raw, expected] of cases) {
      assert.equal(energyFromRating(raw), expected, `rating=${raw}`);
    }
  });
});

describe("parseRekordboxXml", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <PRODUCT Name="rekordbox" Version="6.8.5"/>
  <COLLECTION Entries="4">
    <TRACK TrackID="1" Name="Alpha" Artist="A" AverageBpm="126.00" Tonality="Am" TotalTime="372" Year="2024" Comments="Energy 7" Rating="204"/>
    <TRACK TrackID="2" Name="Bravo" Artist="" AverageBpm="128.50" Tonality="1d" TotalTime="0" Year="0"/>
    <TRACK TrackID="3" Name="NoKey" Artist="C" AverageBpm="125.00" Tonality=""/>
    <TRACK TrackID="4" Name="NoBpm" Artist="D" AverageBpm="0.00" Tonality="Am"/>
  </COLLECTION>
  <PLAYLISTS>
    <NODE Type="0" Name="ROOT" Count="1">
      <NODE Type="0" Name="Crates" Count="1">
        <NODE Name="Peak" Type="1" KeyType="0" Entries="1">
          <TRACK Key="2"/>
        </NODE>
      </NODE>
    </NODE>
  </PLAYLISTS>
</DJ_PLAYLISTS>`;

  test("解析できる曲とできない曲を振り分け、理由を付ける", () => {
    const result = parseRekordboxXml(xml, { energySource: "comment" });
    assert.equal(result.totalEntries, 4);
    assert.deepEqual(result.product, { name: "rekordbox", version: "6.8.5" });
    assert.deepEqual(result.tracks.map((t) => t.title), ["Alpha", "Bravo"]);
    assert.deepEqual(
      result.skipped.map((s) => [s.title, s.reason]),
      [
        ["NoKey", "キーが未解析です"],
        ["NoBpm", "BPM が範囲外です (0)"],
      ],
    );
  });

  test("各項目の変換（空アーティスト・0 の曲尺/年は未設定扱い）", () => {
    const [alpha, bravo] = parseRekordboxXml(xml, { energySource: "comment" }).tracks;
    assert.equal(alpha.camelot, "8A");
    assert.equal(alpha.energy, 7);
    assert.equal(alpha.durationSec, 372);
    assert.equal(alpha.releaseYear, 2024);
    assert.equal(alpha.rekordboxId, "1");

    assert.equal(bravo.artist, "Unknown Artist");
    assert.equal(bravo.camelot, "8B");
    assert.equal(bravo.bpm, 128.5);
    assert.equal(bravo.durationSec, null);
    assert.equal(bravo.releaseYear, null);
    assert.equal(bravo.energy, 5, "コメントに記載が無ければ既定値");
  });

  test("エナジーの決め方を切り替えられる", () => {
    const byRating = parseRekordboxXml(xml, { energySource: "rating" }).tracks;
    assert.equal(byRating[0].energy, 8);
    const fixed = parseRekordboxXml(xml, { energySource: "fixed", defaultEnergy: 3 }).tracks;
    assert.deepEqual(fixed.map((t) => t.energy), [3, 3]);
  });

  test("フォルダ階層つきのプレイリストで絞り込める（曲が 1 つだけでも配列扱い）", () => {
    const result = parseRekordboxXml(xml);
    assert.deepEqual(result.playlists.map((p) => [p.path, p.count]), [["Crates > Peak", 1]]);
    assert.deepEqual(selectPlaylistTracks(result, "Crates > Peak").map((t) => t.title), ["Bravo"]);
    assert.equal(selectPlaylistTracks(result, null).length, 2, "未指定ならコレクション全体");
    assert.deepEqual(selectPlaylistTracks(result, "存在しない"), []);
  });

  test("rekordbox 以外の XML は分かるメッセージで失敗する", () => {
    assert.throws(() => parseRekordboxXml("<root/>"), /rekordbox の XML ではない/);
  });

  test("途中で切れた XML は、途中までの曲だけ黙って取り込まずに失敗する", () => {
    // タグの切れ目で途切れると XMLParser 単体では例外にならないため、構文検証で止める
    const cut = xml.slice(0, xml.indexOf("<TRACK TrackID=\"3\""));
    assert.throws(() => parseRekordboxXml(cut), /途中で切れています/);
    assert.throws(() => parseRekordboxXml("<DJ_PLAYLISTS><COLLECTION>"), /途中で切れています/);
  });
});
