"use client";

import { tagKey, type TagCount } from "@/lib/tags";

interface Props {
  /** ライブラリにあるタグ（多い順） */
  available: TagCount[];
  selected: string[];
  onChange: (tags: string[]) => void;
  /** 件数を表示するか */
  showCounts?: boolean;
  label?: string;
}

/**
 * タグで絞り込むトグル。選んだタグを「すべて」持つ曲に絞る（AND）。
 * ライブラリにタグが 1 つも無ければ何も表示しない。
 */
export function TagFilter({ available, selected, onChange, showCounts = true, label = "タグ" }: Props) {
  if (available.length === 0) return null;

  const selectedKeys = new Set(selected.map(tagKey));

  function toggle(tag: string) {
    const key = tagKey(tag);
    onChange(
      selectedKeys.has(key) ? selected.filter((t) => tagKey(t) !== key) : [...selected, tag],
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${label}で絞り込む`}>
      <span className="mr-1 text-xs text-deck-400">{label}</span>
      {available.map(({ tag, count }) => {
        const active = selectedKeys.has(tagKey(tag));
        return (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            aria-pressed={active}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
              active
                ? "border-neon/60 bg-neon/15 text-neon-soft"
                : "border-deck-700 text-deck-400 hover:border-deck-600 hover:text-white"
            }`}
          >
            {tag}
            {showCounts ? <span className="tabular ml-1 opacity-60">{count}</span> : null}
          </button>
        );
      })}
      {selected.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange([])}
          className="ml-1 text-[11px] text-deck-600 underline transition hover:text-white"
        >
          解除
        </button>
      ) : null}
      {selected.length > 1 ? (
        <span className="text-[10px] text-deck-600">（すべて含む曲）</span>
      ) : null}
    </div>
  );
}
