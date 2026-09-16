import Link from "next/link";

import { TrackForm } from "@/components/TrackForm";
import { listLibraryGenres } from "@/lib/library";

export const dynamic = "force-dynamic";

export const metadata = { title: "楽曲登録 | DJ Track Recommender" };

export default async function NewTrackPage() {
  const genres = await listLibraryGenres();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/" className="text-xs text-deck-400 transition hover:text-white">
          ← ライブラリに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">楽曲を登録</h1>
        <p className="mt-1 text-sm text-deck-400">
          BPM と Camelot キーは推薦の計算に使われます。エナジーはフロアの熱量の目安です。
        </p>
      </div>

      <div className="rounded-xl border border-deck-700/70 bg-deck-900/50 p-5 sm:p-6">
        <TrackForm redirectTo="/" genreSuggestions={genres} />
      </div>
    </div>
  );
}
