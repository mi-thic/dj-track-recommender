import Link from "next/link";
import { Suspense } from "react";

import { SpotifySettings } from "@/components/SpotifySettings";

export const metadata = { title: "Spotify 連携 | DJ Track Recommender" };

export default function SpotifyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/" className="text-xs text-deck-400 transition hover:text-white">
          ← ライブラリに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">Spotify 連携</h1>
        <p className="mt-1 text-sm text-deck-400">
          曲を Spotify と紐付けてジャケットを表示し、組んだセットリストをプレイリストとして書き出します。
        </p>
      </div>

      <section className="rounded-xl border border-deck-700/70 bg-deck-900/40 px-4 py-3.5 text-xs leading-relaxed text-deck-400">
        <p className="font-medium text-white">BPM とキーは Spotify から取得できません</p>
        <p className="mt-1.5">
          Spotify は 2024 年 11 月 27 日に Audio Features / Audio Analysis を廃止し、新規アプリからは 403 になります。
          BPM・キー・エナジーを返していたのがこの API のため、これらは rekordbox のインポートか手入力で登録してください。
        </p>
        <p className="mt-1.5">
          この画面で使うのは検索・トラック情報・プレイリスト作成だけで、いずれも現在も利用できます。
        </p>
      </section>

      <Suspense fallback={<p className="text-sm text-deck-600">読み込み中…</p>}>
        <SpotifySettings />
      </Suspense>
    </div>
  );
}
