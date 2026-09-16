/**
 * rekordbox のコレクション XML（ファイル > コレクションを XML 形式でエクスポート）を
 * 取り込み用のレコードに変換する。DB には依存しない純粋関数。
 *
 * 想定する構造:
 *   <DJ_PLAYLISTS>
 *     <PRODUCT Name="rekordbox" Version="6.x"/>
 *     <COLLECTION Entries="N">
 *       <TRACK TrackID Name Artist AverageBpm Tonality Genre TotalTime Year Label
 *              Rating Comments Location .../>
 *     </COLLECTION>
 *     <PLAYLISTS><NODE Type="0" Name="ROOT">…</NODE></PLAYLISTS>
 *   </DJ_PLAYLISTS>
 */

import { XMLParser } from "fast-xml-parser";

import { musicalKeyToCamelot, normalizeCamelot, toMusicalKey } from "./camelot";

/** エナジー値をどこから決めるか */
export type EnergySource = "fixed" | "rating" | "comment";

export interface RekordboxTrackInput {
  rekordboxId: string | null;
  title: string;
  artist: string;
  bpm: number;
  camelot: string;
  musicalKey: string | null;
  genre: string | null;
  energy: number;
  durationSec: number | null;
  releaseYear: number | null;
  label: string | null;
  notes: string | null;
  /** 取り込み対象外。プレイリスト照合に使う */
  location: string | null;
}

export interface SkippedEntry {
  title: string;
  artist: string;
  reason: string;
}

export interface RekordboxPlaylist {
  /** "Crates > Peak Time" のような表示用パス */
  path: string;
  count: number;
  trackKeys: string[];
  keyType: "id" | "location";
}

export interface RekordboxParseResult {
  product: { name: string; version: string } | null;
  totalEntries: number;
  tracks: RekordboxTrackInput[];
  skipped: SkippedEntry[];
  playlists: RekordboxPlaylist[];
}

export interface ParseOptions {
  energySource?: EnergySource;
  /** energySource が fixed のとき、および他の方法で決まらなかったときの値 */
  defaultEnergy?: number;
}

/* ------------------------------------------------------------------ */
/* キー表記の解決                                                      */
/* ------------------------------------------------------------------ */

/** Open Key 表記（1m〜12m / 1d〜12d）を Camelot に変換する */
export function openKeyToCamelot(input: string): string | null {
  const m = /^\s*(\d{1,2})\s*([md])\s*$/i.exec(input);
  if (!m) return null;
  const number = Number(m[1]);
  if (number < 1 || number > 12) return null;
  // Open Key 1d = C major = Camelot 8B
  const camelotNumber = ((number + 6) % 12) + 1;
  const letter = m[2].toLowerCase() === "m" ? "A" : "B";
  return `${camelotNumber}${letter}`;
}

/**
 * rekordbox の Tonality を Camelot に解決する。
 * rekordbox はキー表記を「クラシック（Am）」「Alphanumeric（8A）」
 * 「Open Key（1m）」から選べるため、3 通りすべてを受け付ける。
 */
export function resolveCamelot(tonality: string | null | undefined): string | null {
  if (!tonality) return null;
  const value = tonality.trim();
  if (!value) return null;
  return normalizeCamelot(value) ?? openKeyToCamelot(value) ?? musicalKeyToCamelot(value);
}

/* ------------------------------------------------------------------ */
/* エナジーの解決                                                      */
/* ------------------------------------------------------------------ */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** コメント欄の "Energy 7" / "エナジー7" / "E7" からエナジーを読む */
export function energyFromComment(comments: string | null): number | null {
  if (!comments) return null;
  const explicit = /(?:energy|エナジー|エネルギー)\s*[:：=]?\s*(\d{1,2})/i.exec(comments);
  if (explicit) return clamp(Number(explicit[1]), 1, 10);
  // 明示的な表記が無い場合だけ "E7" のような短縮形を見る（誤検出を避けるため後回し）
  const short = /(?:^|[\s,;/])E\s?(\d{1,2})(?![\d])/i.exec(comments);
  if (short) return clamp(Number(short[1]), 1, 10);
  return null;
}

/** rekordbox の Rating（0/51/102/153/204/255 または 0〜5）を 1〜10 に変換 */
export function energyFromRating(raw: number | null): number | null {
  if (raw === null || Number.isNaN(raw) || raw <= 0) return null;
  const stars = raw > 5 ? Math.round(raw / 51) : raw;
  if (stars <= 0) return null;
  return clamp(stars * 2, 1, 10);
}

/* ------------------------------------------------------------------ */
/* XML パース                                                          */
/* ------------------------------------------------------------------ */

const ATTR_PREFIX = "@_";

type RawNode = Record<string, unknown>;

function attr(node: RawNode, name: string): string | null {
  const value = node[`${ATTR_PREFIX}${name}`];
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function numAttr(node: RawNode, name: string): number | null {
  const text = attr(node, name);
  if (text === null) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** PLAYLISTS の NODE ツリーを再帰的に辿ってプレイリスト一覧を作る */
function collectPlaylists(node: RawNode, trail: string[], out: RekordboxPlaylist[]): void {
  const name = attr(node, "Name") ?? "";
  const type = attr(node, "Type");
  const children = asArray(node.NODE as RawNode | RawNode[] | undefined);

  // Type="0" はフォルダ、Type="1" はプレイリスト
  if (type === "1") {
    const keyType = attr(node, "KeyType") === "1" ? "location" : "id";
    const keys = asArray(node.TRACK as RawNode | RawNode[] | undefined)
      .map((entry) => attr(entry, "Key"))
      .filter((key): key is string => key !== null);
    out.push({
      path: [...trail, name].filter(Boolean).join(" > "),
      count: keys.length,
      trackKeys: keys,
      keyType,
    });
    return;
  }

  // ROOT 自体はパスに含めない
  const nextTrail = name && name !== "ROOT" ? [...trail, name] : trail;
  for (const child of children) {
    collectPlaylists(child, nextTrail, out);
  }
}

export function parseRekordboxXml(
  xml: string,
  options: ParseOptions = {},
): RekordboxParseResult {
  const energySource: EnergySource = options.energySource ?? "fixed";
  const defaultEnergy = clamp(options.defaultEnergy ?? 5, 1, 10);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ATTR_PREFIX,
    // 値は文字列のまま受け取り、こちらで明示的に変換する
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
  });

  let doc: RawNode;
  try {
    doc = parser.parse(xml) as RawNode;
  } catch (error) {
    throw new Error(
      `XML を解析できませんでした: ${error instanceof Error ? error.message : "不明なエラー"}`,
    );
  }

  const root = doc?.DJ_PLAYLISTS as RawNode | undefined;
  if (!root) {
    throw new Error(
      "rekordbox の XML ではないようです（DJ_PLAYLISTS 要素が見つかりません）。rekordbox の「ファイル > コレクションを XML 形式でエクスポート」で出力したファイルを選んでください。",
    );
  }

  const productNode = root.PRODUCT as RawNode | undefined;
  const product = productNode
    ? {
        name: attr(productNode, "Name") ?? "unknown",
        version: attr(productNode, "Version") ?? "unknown",
      }
    : null;

  const collection = root.COLLECTION as RawNode | undefined;
  const rawTracks = asArray(collection?.TRACK as RawNode | RawNode[] | undefined);
  const totalEntries = numAttr(collection ?? {}, "Entries") ?? rawTracks.length;

  const tracks: RekordboxTrackInput[] = [];
  const skipped: SkippedEntry[] = [];

  for (const raw of rawTracks) {
    const title = attr(raw, "Name");
    const artist = attr(raw, "Artist") ?? "Unknown Artist";

    if (!title) {
      skipped.push({ title: "(タイトルなし)", artist, reason: "タイトルが空です" });
      continue;
    }

    const bpm = numAttr(raw, "AverageBpm");
    if (bpm === null || bpm < 40 || bpm > 300) {
      skipped.push({
        title,
        artist,
        reason: bpm === null ? "BPM が未解析です" : `BPM が範囲外です (${bpm})`,
      });
      continue;
    }

    const tonality = attr(raw, "Tonality");
    const camelot = resolveCamelot(tonality);
    if (!camelot) {
      skipped.push({
        title,
        artist,
        reason: tonality ? `キー表記を解釈できません (${tonality})` : "キーが未解析です",
      });
      continue;
    }

    const comments = attr(raw, "Comments");
    let energy = defaultEnergy;
    if (energySource === "comment") {
      energy = energyFromComment(comments) ?? defaultEnergy;
    } else if (energySource === "rating") {
      energy = energyFromRating(numAttr(raw, "Rating")) ?? defaultEnergy;
    }

    const totalTime = numAttr(raw, "TotalTime");
    const year = numAttr(raw, "Year");

    tracks.push({
      rekordboxId: attr(raw, "TrackID"),
      title,
      artist,
      bpm: Math.round(bpm * 100) / 100,
      camelot,
      musicalKey: toMusicalKey(camelot),
      genre: attr(raw, "Genre"),
      energy,
      durationSec: totalTime && totalTime > 0 ? Math.round(totalTime) : null,
      releaseYear: year && year >= 1900 && year <= 2200 ? year : null,
      label: attr(raw, "Label"),
      notes: comments,
      location: attr(raw, "Location"),
    });
  }

  const playlists: RekordboxPlaylist[] = [];
  const playlistsRoot = root.PLAYLISTS as RawNode | undefined;
  if (playlistsRoot) {
    for (const node of asArray(playlistsRoot.NODE as RawNode | RawNode[] | undefined)) {
      collectPlaylists(node, [], playlists);
    }
  }

  return { product, totalEntries, tracks, skipped, playlists };
}

/** 指定プレイリストに含まれる曲だけに絞り込む。path が空なら全件 */
export function selectPlaylistTracks(
  result: RekordboxParseResult,
  path: string | null,
): RekordboxTrackInput[] {
  if (!path) return result.tracks;

  const playlist = result.playlists.find((entry) => entry.path === path);
  if (!playlist) return [];

  const keys = new Set(playlist.trackKeys);
  return result.tracks.filter((track) => {
    const key = playlist.keyType === "location" ? track.location : track.rekordboxId;
    return key !== null && keys.has(key);
  });
}
