"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { CamelotBadge } from "@/components/CamelotBadge";
import { EnergyMeter } from "@/components/EnergyMeter";
import { formatBpm } from "@/lib/bpm";
import { formatDuration } from "@/lib/format";
import type { EnergySource } from "@/lib/rekordbox";

interface PreviewTrack {
  title: string;
  artist: string;
  bpm: number;
  camelot: string;
  genre: string | null;
  energy: number;
  durationSec: number | null;
  label: string | null;
}

interface ImportResponse {
  product: { name: string; version: string } | null;
  summary: {
    totalEntries: number;
    selected: number;
    parseSkipped: number;
    duplicateInFile: number;
    create: number;
    update: number;
    skip: number;
  };
  playlists: Array<{ path: string; count: number }>;
  skipped: Array<{ title: string; artist: string; reason: string }>;
  skippedTotal: number;
  preview: Array<{ action: "create" | "update" | "skip"; track: PreviewTrack }>;
  dryRun: boolean;
  applied?: { created: number; updated: number };
}

const inputClass =
  "rounded-lg border border-deck-700 bg-deck-900 px-3 py-2 text-sm text-white " +
  "outline-none transition focus:border-neon/70 focus:ring-2 focus:ring-neon/20";

const labelClass = "mb-1.5 block text-xs font-medium text-deck-400";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const ACTION_STYLE: Record<string, { label: string; className: string }> = {
  create: { label: "新規", className: "border-lime-glow/50 bg-lime-glow/10 text-lime-glow" },
  update: { label: "更新", className: "border-neon/50 bg-neon/10 text-neon-soft" },
  skip: { label: "スキップ", className: "border-deck-600 bg-deck-800 text-deck-400" },
};

export function RekordboxImport() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [energySource, setEnergySource] = useState<EnergySource>("fixed");
  const [defaultEnergy, setDefaultEnergy] = useState(5);
  const [playlist, setPlaylist] = useState("");
  const [onDuplicate, setOnDuplicate] = useState<"skip" | "update">("skip");

  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);

  async function send(dryRun: boolean) {
    if (!file) {
      setError("XML ファイルを選択してください");
      return;
    }

    setError(null);
    if (dryRun) setAnalyzing(true);
    else setImporting(true);

    try {
      const body = new FormData();
      body.set("file", file);
      body.set("dryRun", String(dryRun));
      body.set("energySource", energySource);
      body.set("defaultEnergy", String(defaultEnergy));
      body.set("playlist", playlist);
      body.set("onDuplicate", onDuplicate);

      const response = await fetch("/api/import/rekordbox", { method: "POST", body });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "インポートに失敗しました");
        return;
      }

      setResult(data as ImportResponse);
      if (!dryRun) router.refresh();
    } catch {
      setError("サーバーに接続できませんでした");
    } finally {
      setAnalyzing(false);
      setImporting(false);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
    setPlaylist("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const summary = result?.summary;
  const applied = result?.applied;

  return (
    <div className="space-y-6">
      {/* ファイル選択 */}
      <section className="rounded-xl border border-deck-700/70 bg-deck-900/50 p-5">
        <label className={labelClass} htmlFor="xml">
          コレクション XML <span className="text-magenta">*</span>
        </label>
        <input
          id="xml"
          ref={fileRef}
          type="file"
          accept=".xml,text/xml,application/xml"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult(null);
            setPlaylist("");
          }}
          className="block w-full text-sm text-deck-400 file:mr-3 file:rounded-lg file:border-0 file:bg-deck-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-deck-600"
        />
        {file ? (
          <p className="mt-2 text-xs text-deck-600">
            {file.name} / {formatFileSize(file.size)}
          </p>
        ) : (
          <p className="mt-2 text-xs text-deck-600">
            rekordbox の「ファイル &gt; ライブラリ &gt; コレクションを XML 形式でエクスポート」で出力したファイルを選んでください。
          </p>
        )}
      </section>

      {/* オプション */}
      <section className="grid gap-4 rounded-xl border border-deck-700/70 bg-deck-900/50 p-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="energySource">
            エナジーの決め方
          </label>
          <select
            id="energySource"
            className={`${inputClass} w-full`}
            value={energySource}
            onChange={(e) => setEnergySource(e.target.value as EnergySource)}
          >
            <option value="fixed">一律の既定値を使う</option>
            <option value="rating">rekordbox のレーティングから換算</option>
            <option value="comment">コメント欄の Energy 表記から読む</option>
          </select>
          <p className="mt-1.5 text-[11px] text-deck-600">
            {energySource === "rating"
              ? "★1 → 2、★5 → 10 に換算します。未評価の曲は既定値。"
              : energySource === "comment"
                ? "「Energy 7」「エナジー7」「E7」を探します。見つからない曲は既定値。"
                : "rekordbox にはエナジー項目が無いため、全曲同じ値で取り込みます。"}
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="defaultEnergy">
            既定のエナジー: <span className="tabular text-neon">{defaultEnergy}</span> / 10
          </label>
          <input
            id="defaultEnergy"
            type="range"
            min={1}
            max={10}
            value={defaultEnergy}
            onChange={(e) => setDefaultEnergy(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--color-neon)]"
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="onDuplicate">
            既に登録済みの曲
          </label>
          <select
            id="onDuplicate"
            className={`${inputClass} w-full`}
            value={onDuplicate}
            onChange={(e) => setOnDuplicate(e.target.value as "skip" | "update")}
          >
            <option value="skip">スキップする</option>
            <option value="update">rekordbox の情報で更新する</option>
          </select>
          <p className="mt-1.5 text-[11px] text-deck-600">
            更新してもアプリ側で設定したエナジーとメモは残します（コメントが入っている曲のメモは上書き）。
          </p>
        </div>

        {result && result.playlists.length > 0 ? (
          <div>
            <label className={labelClass} htmlFor="playlist">
              取り込む範囲
            </label>
            <select
              id="playlist"
              className={`${inputClass} w-full`}
              value={playlist}
              onChange={(e) => setPlaylist(e.target.value)}
            >
              <option value="">コレクション全体</option>
              {result.playlists.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.path}（{p.count} 曲）
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-deck-600">
              変更したらもう一度「解析する」を押してください。
            </p>
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => send(true)}
          disabled={!file || analyzing || importing}
          className="rounded-lg border border-neon/50 px-4 py-2.5 text-sm font-semibold text-neon transition hover:bg-neon/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {analyzing ? "解析中…" : "解析する"}
        </button>
        <button
          type="button"
          onClick={() => send(false)}
          disabled={!result || result.summary.create + result.summary.update === 0 || importing || analyzing}
          className="rounded-lg bg-neon px-5 py-2.5 text-sm font-semibold text-deck-950 transition hover:bg-neon-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {importing ? "取り込み中…" : "インポート実行"}
        </button>
        {file ? (
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-deck-700 px-4 py-2.5 text-sm text-deck-400 transition hover:bg-deck-800 hover:text-white"
          >
            クリア
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-magenta/50 bg-magenta/10 px-3 py-2.5 text-sm text-magenta">
          {error}
        </p>
      ) : null}

      {applied ? (
        <div className="rounded-lg border border-lime-glow/50 bg-lime-glow/10 px-4 py-3 text-sm text-lime-glow">
          <p className="font-semibold">
            インポート完了: 新規 {applied.created} 曲 / 更新 {applied.updated} 曲
          </p>
          <Link href="/" className="mt-1 inline-block text-xs underline">
            ライブラリで確認する →
          </Link>
        </div>
      ) : null}

      {/* 解析結果 */}
      {summary ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-lg font-semibold text-white">解析結果</h2>
            {result?.product ? (
              <span className="text-xs text-deck-600">
                {result.product.name} {result.product.version}
              </span>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="XML の総曲数" value={summary.totalEntries} />
            <Stat label="対象範囲" value={summary.selected} />
            <Stat label="新規" value={summary.create} tone="lime" />
            <Stat label="更新" value={summary.update} tone="neon" />
            <Stat label="登録済み" value={summary.skip} />
            <Stat
              label="取り込めず"
              value={summary.parseSkipped + summary.duplicateInFile}
              tone={summary.parseSkipped > 0 ? "amber" : "plain"}
            />
          </div>

          {result && result.preview.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-deck-700/70 bg-deck-900/60">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-deck-700/70 text-xs text-deck-400">
                    <th className="px-4 py-3 text-left font-medium">処理</th>
                    <th className="px-4 py-3 text-left font-medium">タイトル</th>
                    <th className="px-4 py-3 text-left font-medium">アーティスト</th>
                    <th className="px-4 py-3 text-right font-medium">BPM</th>
                    <th className="px-4 py-3 text-left font-medium">キー</th>
                    <th className="px-4 py-3 text-left font-medium">エナジー</th>
                    <th className="px-4 py-3 text-left font-medium">ジャンル</th>
                    <th className="px-4 py-3 text-right font-medium">尺</th>
                  </tr>
                </thead>
                <tbody>
                  {result.preview.map((row, index) => {
                    const style = ACTION_STYLE[row.action];
                    return (
                      <tr key={index} className="border-b border-deck-800/70 last:border-0">
                        <td className="px-4 py-2.5">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${style.className}`}
                          >
                            {style.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-white">{row.track.title}</td>
                        <td className="px-4 py-2.5 text-deck-400">{row.track.artist}</td>
                        <td className="tabular px-4 py-2.5 text-right text-white">
                          {formatBpm(row.track.bpm)}
                        </td>
                        <td className="px-4 py-2.5">
                          <CamelotBadge camelot={row.track.camelot} showMusicalKey />
                        </td>
                        <td className="px-4 py-2.5">
                          <EnergyMeter energy={row.track.energy} />
                        </td>
                        <td className="px-4 py-2.5 text-deck-400">{row.track.genre ?? "—"}</td>
                        <td className="tabular px-4 py-2.5 text-right text-deck-400">
                          {formatDuration(row.track.durationSec)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {summary.selected > result.preview.length ? (
                <p className="border-t border-deck-800 px-4 py-2.5 text-xs text-deck-600">
                  先頭 {result.preview.length} 件のみ表示しています（対象 {summary.selected} 曲）。
                </p>
              ) : null}
            </div>
          ) : null}

          {result && result.skippedTotal > 0 ? (
            <details className="rounded-xl border border-amber-glow/40 bg-amber-glow/5 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-amber-glow">
                取り込めなかった {result.skippedTotal} 曲
              </summary>
              <p className="mt-2 text-[11px] text-deck-400">
                BPM やキーが未解析の曲は取り込めません。rekordbox で解析（グリッド・キー検出）を済ませてから再度エクスポートしてください。
              </p>
              <ul className="mt-2 space-y-1 text-xs text-deck-400">
                {result.skipped.map((entry, index) => (
                  <li key={index} className="flex flex-wrap gap-x-2">
                    <span className="text-deck-200">{entry.title}</span>
                    <span className="text-deck-600">{entry.artist}</span>
                    <span className="text-amber-glow/80">{entry.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

// Tailwind はクラス名を静的に走査するため、動的な文字列連結では生成されない
const STAT_TONE = {
  lime: "text-lime-glow",
  neon: "text-neon",
  amber: "text-amber-glow",
  plain: "text-white",
} as const;

type StatTone = keyof typeof STAT_TONE;

function Stat({ label, value, tone = "plain" }: { label: string; value: number; tone?: StatTone }) {
  const color = STAT_TONE[tone];
  return (
    <div className="rounded-xl border border-deck-700/70 bg-deck-900/60 px-3.5 py-3">
      <p className="text-[11px] text-deck-400">{label}</p>
      <p className={`tabular mt-0.5 text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
