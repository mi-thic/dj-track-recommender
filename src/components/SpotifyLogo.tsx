/**
 * Spotify のアイコンロゴ。
 *
 * Spotify のデザインガイドラインに従い、
 *  - 形状を変えない（回転・変形・装飾を加えない）
 *  - 色は公式グリーン (#1DB954) / 黒 / 白 のいずれかのみ
 *  - 周囲に余白を確保する
 * という条件で使う。帰属表示以外の用途には使わない。
 */

interface Props {
  /** 正方形アイコンの一辺（px）。ガイドライン上の下限は 21px */
  size?: number;
  /** "Spotify" のワードマークを右に並べる */
  withWordmark?: boolean;
  /** 隣接するテキストが "Spotify" と読める場合に true。読み上げの重複を避ける */
  decorative?: boolean;
  className?: string;
}

export function SpotifyLogo({
  size = 21,
  withWordmark = false,
  decorative = false,
  className = "",
}: Props) {
  // ワードマークを併記する場合、アイコン側は読み上げ対象から外す
  const hidden = decorative || withWordmark;

  const icon = (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      {...(hidden ? { "aria-hidden": true } : { role: "img", "aria-label": "Spotify" })}
      focusable="false"
      className="shrink-0"
      style={{ fill: "var(--color-spotify)" }}
    >
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );

  if (!withWordmark) {
    return <span className={className}>{icon}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {icon}
      <span
        className="font-semibold tracking-tight"
        style={{ color: "var(--color-spotify)", fontSize: size * 0.8 }}
      >
        Spotify
      </span>
    </span>
  );
}
