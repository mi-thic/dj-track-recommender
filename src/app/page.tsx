import Link from "next/link";

import { CamelotBadge } from "@/components/CamelotBadge";
import { TrackTable } from "@/components/TrackTable";
import { formatBpm } from "@/lib/bpm";
import { prisma } from "@/lib/prisma";
import { toTrackDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const tracks = (
    await prisma.track.findMany({ orderBy: [{ artist: "asc" }, { title: "asc" }] })
  ).map(toTrackDTO);

  const totalTracks = tracks.length;
  const avgBpm = totalTracks > 0 ? tracks.reduce((sum, t) => sum + t.bpm, 0) / totalTracks : 0;
  const genreCount = new Set(tracks.map((t) => t.genre).filter(Boolean)).size;
  const avgEnergy =
    totalTracks > 0 ? tracks.reduce((sum, t) => sum + t.energy, 0) / totalTracks : 0;

  const keyCounts = new Map<string, number>();
  for (const track of tracks) {
    keyCounts.set(track.camelot, (keyCounts.get(track.camelot) ?? 0) + 1);
  }
  const topKeys = [...keyCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">ライブラリ</h1>
          <p className="mt-1 text-sm text-deck-400">
            登録した曲を選ぶと、BPM と Camelot キーから次に繋げる曲を提案します。
          </p>
        </div>
        <Link
          href="/tracks/new"
          className="rounded-lg bg-neon px-4 py-2.5 text-sm font-semibold text-deck-950 transition hover:bg-neon-soft"
        >
          + 楽曲を登録
        </Link>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="登録曲数" value={String(totalTracks)} unit="曲" />
        <StatCard label="平均 BPM" value={totalTracks ? formatBpm(Math.round(avgBpm * 10) / 10) : "—"} />
        <StatCard label="平均エナジー" value={totalTracks ? avgEnergy.toFixed(1) : "—"} unit="/ 10" />
        <StatCard label="ジャンル数" value={String(genreCount)} />
      </section>

      {topKeys.length > 0 ? (
        <section className="rounded-xl border border-deck-700/70 bg-deck-900/40 px-4 py-3">
          <h2 className="text-xs font-medium text-deck-400">よく使うキー</h2>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {topKeys.map(([camelot, count]) => (
              <span key={camelot} className="flex items-center gap-1.5">
                <CamelotBadge camelot={camelot} showMusicalKey />
                <span className="tabular text-xs text-deck-600">{count}</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {totalTracks === 0 ? (
        <section className="rounded-xl border border-dashed border-deck-700 px-6 py-16 text-center">
          <p className="text-sm text-deck-400">まだ楽曲が登録されていません。</p>
          <p className="mt-2 text-xs text-deck-600">
            <code className="rounded bg-deck-800 px-1.5 py-0.5">npm run db:seed</code>{" "}
            でサンプルデータを投入するか、右上から手動で登録してください。
          </p>
          <Link
            href="/tracks/new"
            className="mt-5 inline-block rounded-lg bg-neon px-4 py-2.5 text-sm font-semibold text-deck-950 transition hover:bg-neon-soft"
          >
            最初の 1 曲を登録
          </Link>
        </section>
      ) : (
        <TrackTable tracks={tracks} />
      )}
    </div>
  );
}

function StatCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl border border-deck-700/70 bg-deck-900/60 px-4 py-3.5">
      <p className="text-xs text-deck-400">{label}</p>
      <p className="tabular mt-1 text-2xl font-bold text-white">
        {value}
        {unit ? <span className="ml-1 text-sm font-normal text-deck-600">{unit}</span> : null}
      </p>
    </div>
  );
}
