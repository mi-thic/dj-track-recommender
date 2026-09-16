import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="text-5xl font-bold text-deck-700">404</p>
      <h1 className="mt-4 text-lg font-semibold text-white">ページが見つかりません</h1>
      <p className="mt-2 text-sm text-deck-400">
        URL が変わったか、楽曲が削除された可能性があります。
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-neon px-4 py-2.5 text-sm font-semibold text-deck-950 transition hover:bg-neon-soft"
      >
        ライブラリに戻る
      </Link>
    </div>
  );
}
