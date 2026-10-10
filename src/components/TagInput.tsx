"use client";

import { useId, useState } from "react";

import { MAX_TAGS_PER_TRACK, normalizeTag, normalizeTags, tagKey } from "@/lib/tags";

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  /** 候補として並べるタグ（ライブラリで使っているもの → 既定の順） */
  suggestions: string[];
  /** 候補を最大いくつ出すか */
  maxSuggestions?: number;
  placeholder?: string;
  id?: string;
}

/**
 * タグの入力欄。Enter / カンマで確定、空欄で Backspace を押すと最後のタグを外す。
 * 下に並ぶ候補をクリックしても追加できる。
 */
export function TagInput({
  value,
  onChange,
  suggestions,
  maxSuggestions = 24,
  placeholder = "タグを入力して Enter",
  id,
}: Props) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const [draft, setDraft] = useState("");

  const full = value.length >= MAX_TAGS_PER_TRACK;
  const selectedKeys = new Set(value.map(tagKey));
  const query = tagKey(draft.trim());
  const visibleSuggestions = suggestions
    .filter((tag) => !selectedKeys.has(tagKey(tag)))
    .filter((tag) => !query || tagKey(tag).includes(query))
    .slice(0, maxSuggestions);

  function add(raw: string) {
    const tag = normalizeTag(raw);
    if (!tag || full) return;
    onChange(normalizeTags([...value, tag]));
    setDraft("");
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-deck-700 bg-deck-900 px-2 py-1.5 transition focus-within:border-neon/70 focus-within:ring-2 focus-within:ring-neon/20">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-neon/40 bg-neon/10 py-0.5 pl-2.5 pr-1 text-xs text-neon-soft"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              className="rounded-full px-1 leading-none text-neon/70 transition hover:bg-neon/20 hover:text-white"
              aria-label={`タグ「${tag}」を外す`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={inputId}
          value={draft}
          onChange={(e) => {
            // カンマを打ったらその時点で確定する
            const next = e.target.value;
            if (/[,，]$/.test(next)) add(next.slice(0, -1));
            else setDraft(next);
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter") {
              e.preventDefault(); // フォーム送信を防ぐ
              add(draft);
            } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
              remove(value[value.length - 1]);
            }
          }}
          onBlur={() => {
            if (draft.trim()) add(draft);
          }}
          disabled={full}
          placeholder={full ? `タグは ${MAX_TAGS_PER_TRACK} 個までです` : value.length === 0 ? placeholder : ""}
          className="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm text-white outline-none placeholder:text-deck-600 disabled:cursor-not-allowed"
        />
      </div>

      {visibleSuggestions.length > 0 && !full ? (
        <div className="flex flex-wrap gap-1.5" aria-label="タグの候補">
          {visibleSuggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => add(tag)}
              className="rounded-full border border-deck-700 px-2.5 py-0.5 text-[11px] text-deck-400 transition hover:border-neon/50 hover:text-white"
            >
              + {tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
