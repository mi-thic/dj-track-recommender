"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { CamelotBadge } from "@/components/CamelotBadge";
import { EnergyMeter } from "@/components/EnergyMeter";
import { TagChips } from "@/components/TagChips";
import { TagFilter } from "@/components/TagFilter";
import { formatBpm } from "@/lib/bpm";
import { parseCamelot } from "@/lib/camelot";
import { formatDuration } from "@/lib/format";
import { countTags, hasAllTags, mergeTagSuggestions, normalizeTag } from "@/lib/tags";
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
  const [tagFilter, setTagFilter] = useState<string[]>([]);

  // 一括タグ編集
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkTag, setBulkTag] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const genres = useMemo(
    () => Array.from(new Set(tracks.map((t) => t.genre).filter((g): g is string => !!g))).sort(),
    [tracks],
  );

  const tagCounts = useMemo(() => countTags(tracks), [tracks]);
  const tagSuggestions = useMemo(
    () => mergeTagSuggestions(tagCounts.map((t) => t.tag)),
    [tagCounts],
  );

  // Spotify を使っていないライブラリで空の枠が並ばないよう、
  // 1 曲でもジャケットがあるときだけ画像の列を作る
  const showArt = useMemo(() => tracks.some((t) => t.albumArtUrl !== null), [tracks]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = bpmMin ? Number(bpmMin) : null;
    const max = bpmMax ? Number(bpmMax) : null;

    const filtered = tracks.filter((track) => {
      if (q) {
        const haystack =
          `${track.title} ${track.artist} ${track.label ?? ""} ${track.camelot} ${track.tags.join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (genre && track.genre !== genre) return false;
      if (!hasAllTags(track.tags, tagFilter)) return false;
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
  }, [tracks, query, genre, tagFilter, bpmMin, bpmMax, sortKey, sortDir]);

  // 削除などで消えた曲は選択から外して数える
  const existingIds = useMemo(() => new Set(tracks.map((t) => t.id)), [tracks]);
  const selectedIds = useMemo(
    () => [...selected].filter((id) => existingIds.has(id)),
    [selected, existingIds],
  );
  const visibleSelectedCount = visible.filter((t) => selected.has(t.id)).length;
  const allVisibleSelected = visible.length > 0 && visibleSelectedCount === visible.length;

  const headerCheckbox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerCheckbox.current) {
      headerCheckbox.current.indeterminate = visibleSelectedCount > 0 && !allVisibleSelected;
    }
  }, [visibleSelectedCount, allVisibleSelected]);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const track of visible) {
        if (allVisibleSelected) next.delete(track.id);
        else next.add(track.id);
      }
      return next;
    });
  }

  async function applyBulkTag(mode: "add" | "remove") {
    const tag = normalizeTag(bulkTag);
    if (!tag || selectedIds.length === 0) return;

    setBulkBusy(true);
    setBulkMessage(null);
    try {
      const response = await fetch("/api/tracks/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackIds: selectedIds, [mode]: [tag] }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setBulkMessage({
          tone: "error",
          text: data.issues?.[0]?.message ?? data.error ?? "タグの更新に失敗しました",
        });
        return;
      }

      let text =
        mode === "add"
          ? `${data.updated} 曲に「${tag}」を付けました`
          : `${data.updated} 曲から「${tag}」を外しました`;
      if (data.unchanged > 0) {
        text += `（${data.unchanged} 曲は${mode === "add" ? "付いていた" : "付いていなかった"}ため変更なし）`;
      }
      if (data.capped > 0) {
        text += `。${data.capped} 曲はタグが上限（${data.maxTagsPerTrack} 個）のため付けられませんでした`;
      }
      setBulkMessage({ tone: "ok", text });
      startTransition(() => router.refresh());
    } catch {
      setBulkMessage({ tone: "error", text: "サーバーに接続できませんでした" });
    } finally {
      setBulkBusy(false);
    }
  }

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
      className={`flex items-center gap-1 whitespace-nowrap text-left transition hover:text-white ${
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
          placeholder="タイトル / アーティスト / レーベル / タグで検索"
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
        {(query || genre || bpmMin || bpmMax || tagFilter.length > 0) && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setGenre("");
              setBpmMin("");
              setBpmMax("");
              setTagFilter([]);
            }}
            className="rounded-lg border border-deck-700 px-3 py-2 text-sm text-deck-400 transition hover:bg-deck-800 hover:text-white"
          >
            クリア
          </button>
        )}
      </div>

      <TagFilter available={tagCounts} selected={tagFilter} onChange={setTagFilter} />

      <p className="text-xs text-deck-600">
        {visible.length} 曲を表示（全 {tracks.length} 曲）
        {tagCounts.length === 0 ? "。左端のチェックで曲を選ぶと、まとめてタグを付けられます" : ""}
      </p>

      {selectedIds.length > 0 ? (
        <div className="sticky top-16 z-20 space-y-2 rounded-xl border border-neon/40 bg-deck-900/95 px-4 py-3 shadow-lg backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-white">{selectedIds.length} 曲を選択中</span>
            <input
              className={`${inputClass} min-w-44 flex-1 py-1.5`}
              value={bulkTag}
              onChange={(e) => setBulkTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void applyBulkTag("add");
                }
              }}
              list="bulk-tag-suggestions"
              placeholder="タグ（例: ピーク）"
              aria-label="まとめて付ける / 外すタグ"
              maxLength={30}
            />
            <datalist id="bulk-tag-suggestions">
              {tagSuggestions.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={() => applyBulkTag("add")}
              disabled={bulkBusy || !normalizeTag(bulkTag)}
              className="rounded-lg bg-neon px-3.5 py-1.5 text-sm font-semibold text-deck-950 transition hover:bg-neon-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              付ける
            </button>
            <button
              type="button"
              onClick={() => applyBulkTag("remove")}
              disabled={bulkBusy || !normalizeTag(bulkTag)}
              className="rounded-lg border border-deck-700 px-3.5 py-1.5 text-sm text-deck-400 transition hover:border-magenta/50 hover:text-magenta disabled:cursor-not-allowed disabled:opacity-40"
            >
              外す
            </button>
            <button
              type="button"
              onClick={() => {
                setSelected(new Set());
                setBulkMessage(null);
              }}
              className="text-xs text-deck-400 underline transition hover:text-white"
            >
              選択を解除
            </button>
          </div>
          {bulkMessage ? (
            <p className={`text-xs ${bulkMessage.tone === "ok" ? "text-lime-glow" : "text-magenta"}`}>
              {bulkMessage.text}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-deck-700/70 bg-deck-900/60">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-deck-700/70 text-xs text-deck-400">
              <th className="w-10 py-3 pl-4">
                <input
                  ref={headerCheckbox}
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  disabled={visible.length === 0}
                  className="h-3.5 w-3.5 accent-[var(--color-neon)]"
                  aria-label="表示中の曲をすべて選択"
                />
              </th>
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
                className={`border-b border-deck-800/70 transition last:border-0 hover:bg-deck-850/60 ${
                  selected.has(track.id) ? "bg-neon/5" : ""
                }`}
              >
                <td className="py-3 pl-4">
                  <input
                    type="checkbox"
                    checked={selected.has(track.id)}
                    onChange={() => toggleOne(track.id)}
                    className="h-3.5 w-3.5 accent-[var(--color-neon)]"
                    aria-label={`${track.title} を選択`}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {showArt ? (
                      track.albumArtUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={track.albumArtUrl}
                          alt=""
                          width={32}
                          height={32}
                          className="h-8 w-8 shrink-0 rounded"
                        />
                      ) : (
                        <span className="h-8 w-8 shrink-0 rounded bg-deck-800" aria-hidden />
                      )
                    ) : null}
                    <div className="min-w-0">
                      <Link
                        href={`/tracks/${track.id}`}
                        className="block font-medium text-white transition hover:text-neon"
                      >
                        {track.title}
                      </Link>
                      <TagChips tags={track.tags} max={4} className="mt-1" />
                    </div>
                  </div>
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
                  <div className="flex justify-end gap-1.5 whitespace-nowrap">
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
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-deck-600">
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
