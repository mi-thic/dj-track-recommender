"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { CamelotBadge } from "@/components/CamelotBadge";
import { EnergyMeter } from "@/components/EnergyMeter";
import { formatBpm } from "@/lib/bpm";
import { parseCamelot } from "@/lib/camelot";
import { formatDuration } from "@/lib/format";
import type { TrackDTO } from "@/lib/types";

type SortKey = "artist" | "title" | "bpm" | "camelot" | "energy" | "createdAt";
type SortDir = "asc" | "desc";

const SORT_LABELS: Record<SortKey, string> = {
  artist: "アーティスト",
  title: "タイトル",
  bpm: "BPM",
  camelot: "キー",
  energy: "エナジー",
  createdAt: "登録日",
};

const inputClass =
  "rounded-lg border border-deck-700 bg-deck-900 px-3 py-2 text-sm text-white " +
  "placeholder:text-deck-600 outline-none transition focus:border-neon/70 focus:ring-2 focus:ring-neon/20";

export function TrackTable({ tracks }: { tracks: TrackDTO[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [bpmMin, setBpmMin] = useState("");
  const [bpmMax, setBpmMax] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("artist");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const genres = useMemo(
    () => Array.from(new Set(tracks.map((t) => t.genre).filter((g): g is string => !!g))).sort(),
    [tracks],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = bpmMin ? Number(bpmMin) : null;
    const max = bpmMax ? Number(bpmMax) : null;

    const filtered = tracks.filter((track) => {
      if (q) {
        const haystack = `${track.title} ${track.artist} ${track.label ?? ""} ${track.camelot}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (genre && track.genre !== genre) return false;
      if (min !== null && !Number.isNaN(min) && track.bpm < min) return false;
      if (max !== null && !Number.isNaN(max) && track.bpm > max) return false;
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      switch (sortKey) {
        case "bpm":
          return (a.bpm - b.bpm) * dir;
        case "energy":
          return (a.energy - b.energy) * dir;
        case "camelot": {
          const ka = parseCamelot(a.camelot);
          const kb = parseCamelot(b.camelot);
          const na = ka ? ka.number * 2 + (ka.letter === "B" ? 1 : 0) : 0;
          const nb = kb ? kb.number * 2 + (kb.letter === "B" ? 1 : 0) : 0;
          return (na - nb) * dir;
        }
        case "createdAt":
          return (Date.parse(a.createdAt) - Date.parse(b.createdAt)) * dir;
        case "title":
          return a.title.localeCompare(b.title, "ja") * dir;
        case "artist":
        default:
          return (a.artist.localeCompare(b.artist, "ja") || a.title.localeCompare(b.title, "ja")) * dir;
      }
    });
  }, [tracks, query, genre, bpmMin, bpmMax, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "createdAt" || key === "bpm" || key === "energy" ? "desc" : "asc");
    }
  }

  async function handleDelete(track: TrackDTO) {
    const ok = window.confirm(`「${track.title}」を削除します。よろしいですか？`);
    if (!ok) return;

    setDeletingId(track.id);
    try {
      const response = await fetch(`/api/tracks/${track.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        window.alert(data.error ?? "削除に失敗しました");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setDeletingId(null);
    }
  }

  const headerButton = (key: SortKey, extra = "") => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className={`flex items-center gap-1 text-left transition hover:text-white ${
        sortKey === key ? "text-white" : ""
      } ${extra}`}
    >
      {SORT_LABELS[key]}
      <span className="text-[10px] opacity-70">
        {sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : ""}
      </span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} min-w-56 flex-1`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="タイトル / アーティスト / レーベルで検索"
        />
        <select className={inputClass} value={genre} onChange={(e) => setGenre(e.target.value)}>
          <option value="">全ジャンル</option>
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <input
          className={`${inputClass} tabular w-24`}
          value={bpmMin}
          onChange={(e) => setBpmMin(e.target.value)}
          placeholder="BPM 最小"
          type="number"
        />
        <input
          className={`${inputClass} tabular w-24`}
          value={bpmMax}
          onChange={(e) => setBpmMax(e.target.value)}
          placeholder="BPM 最大"
          type="number"
        />
        {(query || genre || bpmMin || bpmMax) && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setGenre("");
              setBpmMin("");
              setBpmMax("");
            }}
            className="rounded-lg border border-deck-700 px-3 py-2 text-sm text-deck-400 transition hover:bg-deck-800 hover:text-white"
          >
            クリア
          </button>
        )}
      </div>

      <p className="text-xs text-deck-600">
        {visible.length} 曲を表示（全 {tracks.length} 曲）
      </p>

      <div className="overflow-x-auto rounded-xl border border-deck-700/70 bg-deck-900/60">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-deck-700/70 text-xs text-deck-400">
              <th className="px-4 py-3 text-left font-medium">{headerButton("title")}</th>
              <th className="px-4 py-3 text-left font-medium">{headerButton("artist")}</th>
              <th className="px-4 py-3 text-right font-medium">
                <div className="flex justify-end">{headerButton("bpm")}</div>
              </th>
              <th className="px-4 py-3 text-left font-medium">{headerButton("camelot")}</th>
              <th className="px-4 py-3 text-left font-medium">{headerButton("energy")}</th>
              <th className="px-4 py-3 text-left font-medium">ジャンル</th>
              <th className="px-4 py-3 text-right font-medium">尺</th>
              <th className="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((track) => (
              <tr
                key={track.id}
                className="border-b border-deck-800/70 transition last:border-0 hover:bg-deck-850/60"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/tracks/${track.id}`}
                    className="font-medium text-white transition hover:text-neon"
                  >
                    {track.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-deck-400">{track.artist}</td>
                <td className="tabular px-4 py-3 text-right text-white">{formatBpm(track.bpm)}</td>
                <td className="px-4 py-3">
                  <CamelotBadge camelot={track.camelot} showMusicalKey />
                </td>
                <td className="px-4 py-3">
                  <EnergyMeter energy={track.energy} />
                </td>
                <td className="px-4 py-3 text-deck-400">{track.genre ?? "—"}</td>
                <td className="tabular px-4 py-3 text-right text-deck-400">
                  {formatDuration(track.durationSec)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <Link
                      href={`/tracks/${track.id}`}
                      className="rounded-md border border-neon/40 px-2 py-1 text-xs text-neon transition hover:bg-neon/10"
                    >
                      次曲
                    </Link>
                    <Link
                      href={`/tracks/${track.id}/edit`}
                      className="rounded-md border border-deck-700 px-2 py-1 text-xs text-deck-400 transition hover:bg-deck-800 hover:text-white"
                    >
                      編集
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(track)}
                      disabled={deletingId === track.id || isPending}
                      className="rounded-md border border-deck-700 px-2 py-1 text-xs text-deck-400 transition hover:border-magenta/50 hover:text-magenta disabled:opacity-40"
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-deck-600">
                  条件に合う楽曲がありません。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
