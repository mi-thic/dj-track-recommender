import { SpotifyLogo } from "@/components/SpotifyLogo";

/**
 * Spotify のコンテンツ（ジャケット画像・楽曲メタデータ）を表示する画面に
 * 置く帰属表示。ロゴから Spotify へリンクバックする。
 */

interface Props {
  /** full: 説明文つき / compact: 一覧の下などに置く 1 行 */
  variant?: "full" | "compact";
  className?: string;
}

export function SpotifyAttribution({ variant = "full", className = "" }: Props) {
  if (variant === "compact") {
    return (
      <a
        href="https://www.spotify.com/"
        target="_blank"
        rel="noreferrer noopener"
        className={`inline-flex items-center gap-2 text-[11px] text-deck-600 transition hover:text-deck-400 ${className}`}
      >
        <SpotifyLogo size={14} decorative />
        ジャケット画像は Spotify 提供
      </a>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-deck-700/70 bg-deck-900/40 px-4 py-3 ${className}`}
    >
      <SpotifyLogo size={21} withWordmark />
      <p className="text-[11px] leading-relaxed text-deck-400">
        楽曲のメタデータとジャケット画像は{" "}
        <a
          href="https://www.spotify.com/"
          target="_blank"
          rel="noreferrer noopener"
          className="underline transition hover:text-white"
        >
          Spotify
        </a>{" "}
        から提供されています。表示中の楽曲名をクリックすると Spotify のページが開きます。
        本アプリは Spotify AB とは提携していません。
      </p>
    </div>
  );
}
