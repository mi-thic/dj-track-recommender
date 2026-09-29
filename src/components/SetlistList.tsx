"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LocalDateTime } from "@/components/LocalDateTime";
import { formatDuration } from "@/lib/format";
import type { SetlistSummaryDTO } from "@/lib/types";

const actionButton =
  "rounded-md border border-deck-700 px-2.5 py-1 text-xs text-deck-400 transition " +
  "hover:bg-deck-800 hover:text-white disabled:opacity-40";

export function SetlistList({ setlists }: { setlists: SetlistSummaryDTO[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function duplicate(setlist: SetlistSummaryDTO) {
    setBusyId(setlist.id);
    setError(null);
    try {
      const response = await fetch(`/api/setlists/${setlist.id}/duplicate`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "複製に失敗しました");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(setlist: SetlistSummaryDTO) {
    if (!window.confirm(`「${setlist.name}」を削除します。曲はライブラリに残ります。よろしいですか？`)) {
      return;
    }
    setBusyId(setlist.id);
    setError(null);
    try {
      const response = await fetch(`/api/setlists/${setlist.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "削除に失敗しました");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (setlists.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-deck-700 px-6 py-16 text-center">
        <p className="text-sm text-deck-400">保存したセットはまだありません。</p>
        <Link
          href="/setlist"
          className="mt-5 inline-block rounded-lg bg-neon px-4 py-2.5 text-sm font-semibold text-deck-950 transition hover:bg-neon-soft"
        >
          最初のセットを組む
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-lg border border-magenta/50 bg-magenta/10 px-3 py-2.5 text-sm text-magenta">
          {error}
        </p>
      ) : null}

      <ul className="space-y-2">
        {setlists.map((setlist) => (
          <li
            key={setlist.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-deck-700/70 bg-deck-900/60 px-4 py-3 transition hover:border-neon/40"
          >
            <div className="min-w-0 flex-1">
              <Link
                href={`/setlist?id=${setlist.id}`}
                className="block truncate font-semibold text-white transition hover:text-neon"
              >
                {setlist.name}
              </Link>
              <p className="mt-0.5 text-xs text-deck-600">
                更新 <LocalDateTime iso={setlist.updatedAt} />
              </p>
            </div>
            <span className="tabular text-sm text-deck-200">{setlist.trackCount} 曲</span>
            <span className="tabular w-14 text-right text-sm text-deck-400">
              {setlist.totalDurationSec > 0 ? formatDuration(setlist.totalDurationSec) : "—"}
            </span>
            <div className="flex gap-1.5">
              <Link href={`/setlist?id=${setlist.id}`} className={`${actionButton} border-neon/40 text-neon`}>
                開く
              </Link>
              <button
                type="button"
                onClick={() => duplicate(setlist)}
                disabled={busyId === setlist.id}
                className={actionButton}
              >
                複製
              </button>
              <button
                type="button"
                onClick={() => remove(setlist)}
                disabled={busyId === setlist.id}
                className={`${actionButton} hover:border-magenta/50 hover:text-magenta`}
              >
                削除
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
