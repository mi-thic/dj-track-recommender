import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "DJ Track Recommender",
  description: "BPM と Camelot キーで次に掛ける曲を提案する DJ 向け楽曲管理アプリ",
};

const NAV = [
  { href: "/", label: "ライブラリ" },
  { href: "/tracks/new", label: "楽曲登録" },
  { href: "/setlist", label: "セットリスト" },
  { href: "/camelot", label: "Camelot ホイール" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="antialiased">
        <div className="min-h-screen">
          <header className="sticky top-0 z-30 border-b border-deck-700/60 bg-deck-950/80 backdrop-blur">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
              <Link href="/" className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-neon/50 bg-neon/10 text-neon"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                </span>
                <span className="text-sm font-semibold tracking-wide text-white">
                  DJ Track Recommender
                </span>
              </Link>

              <nav className="flex flex-wrap items-center gap-1 text-sm">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-1.5 text-deck-400 transition hover:bg-deck-800 hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>

          <footer className="mx-auto max-w-7xl px-4 pb-10 text-xs text-deck-600 sm:px-6">
            BPM ±ピッチ幅と Camelot Wheel のハーモニックルールでスコアリングしています。
          </footer>
        </div>
      </body>
    </html>
  );
}
