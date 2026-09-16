import { Suspense } from "react";

import { SetlistBuilder } from "@/components/SetlistBuilder";

export const metadata = { title: "セットリスト | DJ Track Recommender" };

export default function SetlistPage() {
  return (
    <Suspense fallback={<p className="text-sm text-deck-600">読み込み中…</p>}>
      <SetlistBuilder />
    </Suspense>
  );
}
