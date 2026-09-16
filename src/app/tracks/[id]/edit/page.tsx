import Link from "next/link";
import { notFound } from "next/navigation";

import { TrackForm } from "@/components/TrackForm";
import { prisma } from "@/lib/prisma";
import { toTrackDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditTrackPage({ params }: PageProps) {
  const { id } = await params;

  const track = await prisma.track.findUnique({ where: { id } });
  if (!track) notFound();

  const dto = toTrackDTO(track);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={`/tracks/${dto.id}`} className="text-xs text-deck-400 transition hover:text-white">
          ← 楽曲詳細に戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">楽曲を編集</h1>
        <p className="mt-1 text-sm text-deck-400">{dto.artist}</p>
      </div>

      <div className="rounded-xl border border-deck-700/70 bg-deck-900/50 p-5 sm:p-6">
        <TrackForm track={dto} redirectTo={`/tracks/${dto.id}`} />
      </div>
    </div>
  );
}
