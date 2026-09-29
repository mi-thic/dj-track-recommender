import Link from "next/link";

import { SetlistList } from "@/components/SetlistList";
import { listSetlists } from "@/lib/setlists";

export const dynamic = "force-dynamic";

export const metadata = { title: "セットリスト | DJ Track Recommender" };

export default async function SetlistsPage() {
  const setlists = await listSetlists();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">セットリスト</h1>
          <p className="mt-1 text-sm text-deck-400">
            保存したセットを開いて続きを組んだり、複製して別案を作ったりできます。
          </p>
        </div>
        <Link
          href="/setlist"
          className="rounded-lg bg-neon px-4 py-2.5 text-sm font-semibold text-deck-950 transition hover:bg-neon-soft"
        >
          + 新しいセットを組む
        </Link>
      </div>

      <SetlistList setlists={setlists} />
    </div>
  );
}
