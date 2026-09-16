"use client";

import { useState } from "react";

interface Props {
  trackIds: string[];
  /** 紐付いていない曲数の表示用 */
  unlinkedCount: number;
  defaultName: string;
}

interface ExportResult {
  playlist: { id: string; name: string; url: string };
  added: number;
  missing: Array<{ title: string; artist: string }>;
}

const inputClass =
  "w-full rounded-lg border border-deck-700 bg-deck-900 px-3 py-2 text-sm text-white " +
  "placeholder:text-deck-600 outline-none transition focus:border-neon/70 focus:ring-2 focus:ring-neon/20";

export function ExportToSpotify({ trackIds, unlinkedCount, defaultName }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/spotify/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, public: isPublic, trackIds }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "プレイリストの作成に失敗しました");
        return;
      }
      setResult(data as ExportResult);
    } catch {
      setError("サーバーに接続できませんでした");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-xl border border-lime-glow/50 bg-lime-glow/10 px-4 py-3 text-sm text-lime-glow">
        <p className="font-semibold">
          「{result.playlist.name}」に {result.added} 曲を書き出しました
        </p>
        <a
          href={result.playlist.url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-1 inline-block text-xs underline"
        >
          Spotify で開く →
        </a>
        {result.missing.length > 0 ? (
          <p className="mt-2 text-xs text-amber-glow">
            {result.missing.length} 曲は Spotify と紐付いていないため除外しました（
            {result.missing.map((m) => m.title).join(" / ")}）
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setOpen(false);
          }}
          className="mt-2 block text-xs text-deck-400 underline transition hover:text-white"
        >
          閉じる
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={trackIds.length === 0}
        className="rounded-lg border border-deck-700 px-3.5 py-2 text-sm text-deck-400 transition hover:bg-deck-800 hover:text-white disabled:opacity-40"
      >
        Spotify に書き出し
      </button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-xl border border-deck-700/70 bg-deck-900/60 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-white">Spotify プレイリストとして書き出す</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-deck-400 transition hover:text-white"
        >
          閉じる
        </button>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-deck-400" htmlFor="playlist-name">
          プレイリスト名
        </label>
        <input
          id="playlist-name"
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-deck-400" htmlFor="playlist-desc">
          説明（任意）
        </label>
        <input
          id="playlist-desc"
          className={inputClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="2026-09-16 のセット"
          maxLength={300}
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-deck-400">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="h-3.5 w-3.5 accent-[var(--color-neon)]"
        />
        公開プレイリストにする
      </label>

      {unlinkedCount > 0 ? (
        <p className="rounded-lg border border-amber-glow/40 bg-amber-glow/5 px-3 py-2 text-xs text-amber-glow">
          セット内 {unlinkedCount} 曲が Spotify と紐付いていないため除外されます。
          <a href="/spotify" className="ml-1 underline">
            紐付け画面へ
          </a>
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-magenta/50 bg-magenta/10 px-3 py-2 text-xs text-magenta">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={submitting || !name.trim()}
        className="rounded-lg bg-neon px-4 py-2 text-sm font-semibold text-deck-950 transition hover:bg-neon-soft disabled:opacity-40"
      >
        {submitting ? "作成中…" : "作成する"}
      </button>
    </div>
  );
}
