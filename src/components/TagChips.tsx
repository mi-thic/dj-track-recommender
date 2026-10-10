interface Props {
  tags: string[];
  /** 表示する最大数。超えた分は「+N」にまとめる */
  max?: number;
  className?: string;
}

/** タグを小さなチップで並べる（表示専用） */
export function TagChips({ tags, max, className = "" }: Props) {
  if (tags.length === 0) return null;
  const shown = max !== undefined ? tags.slice(0, max) : tags;
  const hidden = tags.length - shown.length;

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {shown.map((tag) => (
        <span
          key={tag}
          className="rounded-full border border-deck-700 bg-deck-800/70 px-2 py-px text-[10px] leading-4 text-deck-200"
        >
          {tag}
        </span>
      ))}
      {hidden > 0 ? (
        <span className="text-[10px] text-deck-600" title={tags.slice(shown.length).join(" / ")}>
          +{hidden}
        </span>
      ) : null}
    </span>
  );
}
