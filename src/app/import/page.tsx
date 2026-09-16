import Link from "next/link";

import { RekordboxImport } from "@/components/RekordboxImport";

export const metadata = { title: "rekordbox インポート | DJ Track Recommender" };

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/" className="text-xs text-deck-400 transition hover:text-white">
          ← ライブラリに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">rekordbox からインポート</h1>
        <p className="mt-1 text-sm text-deck-400">
          rekordbox のコレクション XML を読み込んで、BPM・キー・ジャンル・曲尺をまとめて登録します。
        </p>
      </div>

      <section className="rounded-xl border border-deck-700/70 bg-deck-900/40 px-4 py-3.5 text-xs leading-relaxed text-deck-400">
        <p className="font-medium text-white">XML の書き出し方</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>rekordbox のメニューから「ファイル &gt; ライブラリ &gt; コレクションを XML 形式で保存」を選ぶ</li>
          <li>保存先を指定して書き出す</li>
          <li>そのファイルをこのページで選択する</li>
        </ol>
        <p className="mt-2">
          キー表記はクラシック（Am）・Alphanumeric（8A）・Open Key（1m）のいずれでも読み取れます。
          BPM またはキーが未解析の曲は取り込めないため、先に rekordbox 側で解析を済ませておいてください。
        </p>
      </section>

      <RekordboxImport />
    </div>
  );
}
