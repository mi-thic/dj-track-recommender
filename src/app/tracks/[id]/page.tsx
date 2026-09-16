import Link from "next/link";
import { notFound } from "next/navigation";

import { CamelotBadge } from "@/components/CamelotBadge";
import { EnergyMeter } from "@/components/EnergyMeter";
import { RecommendationPanel } from "@/components/RecommendationPanel";
import { bpmRange, formatBpm } from "@/lib/bpm";
import { getCompatibleKeys, toMusicalKey } from "@/lib/camelot";
import { formatDuration } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { toTrackDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const track = await prisma.track.findUnique({ where: { id } });
  return { title: track ? `${track.title} | DJ Track Recommender` : "楽曲が見つかりません" };
}

export default async function TrackDetailPage({ params }: PageProps) {
  const { id } = await params;

  const track = await prisma.track.findUnique({ where: { id } });
  if (!track) notFound();

  const dto = toTrackDTO(track);

  const genreRows = await prisma.track.findMany({
    where: { genre: { not: null } },
    distinct: ["genre"],
    select: { genre: true },
    orderBy: { genre: "asc" },
  });
  const genres = genreRows.map((row) => row.genre).filter((g): g is string => !!g);

  const range = bpmRange(dto.bpm, 8);
  const compatibleKeys = getCompatibleKeys(dto.camelot);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-xs text-deck-400 transition hover:text-white">
          ← ライブラリに戻る
        </Link>
      </div>

      <section className="rounded-xl border border-deck-700/70 bg-deck-900/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-neon">NOW PLAYING</p>
            <h1 className="mt-1 text-2xl font-bold text-white">{dto.title}</h1>
            <p className="mt-0.5 text-deck-400">{dto.artist}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/tracks/${dto.id}/edit`}
              className="rounded-lg border border-deck-700 px-3.5 py-2 text-sm text-deck-400 transition hover:bg-deck-800 hover:text-white"
            >
              編集
            </Link>
            <Link
              href={`/setlist?start=${dto.id}`}
              className="rounded-lg bg-neon px-3.5 py-2 text-sm font-semibold text-deck-950 transition hover:bg-neon-soft"
            >
              ここからセットを組む
            </Link>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="BPM">
            <span className="tabular text-xl font-bold text-white">{formatBpm(dto.bpm)}</span>
          </Field>
          <Field label="Camelot">
            <CamelotBadge camelot={dto.camelot} size="md" />
          </Field>
          <Field label="調">
            <span className="text-white">{toMusicalKey(dto.camelot) ?? "—"}</span>
          </Field>
          <Field label="エナジー">
            <span className="flex items-center gap-2">
              <EnergyMeter energy={dto.energy} />
              <span className="tabular text-white">{dto.energy}</span>
            </span>
          </Field>
          <Field label="ジャンル">
            <span className="text-white">{dto.genre ?? "—"}</span>
          </Field>
          <Field label="尺">
            <span className="tabular text-white">{formatDuration(dto.durationSec)}</span>
          </Field>
        </dl>

        {(dto.label || dto.releaseYear || dto.notes) && (
          <div className="mt-5 space-y-2 border-t border-deck-800 pt-4 text-sm">
            {dto.label || dto.releaseYear ? (
              <p className="text-deck-400">
                {dto.label ?? "—"}
                {dto.releaseYear ? ` / ${dto.releaseYear}` : ""}
              </p>
            ) : null}
            {dto.notes ? <p className="whitespace-pre-wrap text-deck-200">{dto.notes}</p> : null}
          </div>
        )}

        <p className="mt-5 text-xs text-deck-600">
          ピッチ ±8% で同期できる BPM 帯:{" "}
          <span className="tabular text-deck-400">
            {range.min.toFixed(1)} – {range.max.toFixed(1)}
          </span>
        </p>
      </section>

      <section className="rounded-xl border border-deck-700/70 bg-deck-900/40 px-4 py-3.5">
        <h2 className="text-xs font-medium text-deck-400">
          {dto.camelot} から繋げるキー
        </h2>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {compatibleKeys.map(({ camelot, compatibility }) => (
            <span
              key={camelot}
              className="flex items-center gap-1.5 rounded-lg border border-deck-800 bg-deck-900/60 px-2 py-1"
              title={compatibility.description}
            >
              <CamelotBadge camelot={camelot} />
              <span className="text-[10px] text-deck-400">{compatibility.label}</span>
            </span>
          ))}
        </div>
      </section>

      <RecommendationPanel trackId={dto.id} genres={genres} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-deck-400">{label}</dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}
