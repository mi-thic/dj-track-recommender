"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ALL_CAMELOT_KEYS, toMusicalKey } from "@/lib/camelot";
import { formatDuration, parseDuration } from "@/lib/format";
import type { TrackDTO } from "@/lib/types";

interface Props {
  /** 指定すると編集モードになる */
  track?: TrackDTO;
  /** 保存後の遷移先。既定は一覧 */
  redirectTo?: string;
}

interface FormState {
  title: string;
  artist: string;
  bpm: string;
  camelot: string;
  genre: string;
  energy: number;
  duration: string;
  releaseYear: string;
  label: string;
  notes: string;
}

function initialState(track?: TrackDTO): FormState {
  return {
    title: track?.title ?? "",
    artist: track?.artist ?? "",
    bpm: track ? String(track.bpm) : "",
    camelot: track?.camelot ?? "8A",
    genre: track?.genre ?? "",
    energy: track?.energy ?? 5,
    duration: track?.durationSec != null ? formatDuration(track.durationSec) : "",
    releaseYear: track?.releaseYear != null ? String(track.releaseYear) : "",
    label: track?.label ?? "",
    notes: track?.notes ?? "",
  };
}

const inputClass =
  "w-full rounded-lg border border-deck-700 bg-deck-900 px-3 py-2 text-sm text-white " +
  "placeholder:text-deck-600 outline-none transition focus:border-neon/70 focus:ring-2 focus:ring-neon/20";

const labelClass = "mb-1.5 block text-xs font-medium text-deck-400";

export function TrackForm({ track, redirectTo }: Props) {
  const router = useRouter();
  const isEdit = Boolean(track);

  const [form, setForm] = useState<FormState>(() => initialState(track));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Array<{ path: string; message: string }>>([]);
  const [success, setSuccess] = useState<string | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const durationSec = parseDuration(form.duration);
  const durationInvalid = form.duration.trim() !== "" && durationSec === null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIssues([]);
    setSuccess(null);

    if (durationInvalid) {
      setError("曲尺は 3:45 のような mm:ss 形式、または秒数で入力してください");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: form.title,
        artist: form.artist,
        bpm: form.bpm,
        camelot: form.camelot,
        musicalKey: toMusicalKey(form.camelot),
        genre: form.genre,
        energy: form.energy,
        durationSec,
        releaseYear: form.releaseYear,
        label: form.label,
        notes: form.notes,
      };

      const response = await fetch(isEdit ? `/api/tracks/${track!.id}` : "/api/tracks", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "保存に失敗しました");
        setIssues(data.issues ?? []);
        return;
      }

      if (isEdit) {
        setSuccess("更新しました");
        router.refresh();
        if (redirectTo) router.push(redirectTo);
      } else {
        setSuccess(`「${form.title}」を登録しました`);
        setForm(initialState());
        router.refresh();
        if (redirectTo) router.push(redirectTo);
      }
    } catch {
      setError("サーバーに接続できませんでした");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="title">
            タイトル <span className="text-magenta">*</span>
          </label>
          <input
            id="title"
            className={inputClass}
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Midnight Circuit"
            required
            maxLength={200}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="artist">
            アーティスト <span className="text-magenta">*</span>
          </label>
          <input
            id="artist"
            className={inputClass}
            value={form.artist}
            onChange={(e) => update("artist", e.target.value)}
            placeholder="Kade Rivers"
            required
            maxLength={200}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="bpm">
            BPM <span className="text-magenta">*</span>
          </label>
          <input
            id="bpm"
            className={`${inputClass} tabular`}
            value={form.bpm}
            onChange={(e) => update("bpm", e.target.value)}
            placeholder="128"
            inputMode="decimal"
            type="number"
            step="0.1"
            min={40}
            max={300}
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="camelot">
            Camelot キー <span className="text-magenta">*</span>
          </label>
          <div className="flex items-center gap-2">
            <select
              id="camelot"
              className={`${inputClass} tabular`}
              value={form.camelot}
              onChange={(e) => update("camelot", e.target.value)}
              required
            >
              {ALL_CAMELOT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key} — {toMusicalKey(key)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="genre">
            ジャンル
          </label>
          <input
            id="genre"
            className={inputClass}
            value={form.genre}
            onChange={(e) => update("genre", e.target.value)}
            placeholder="Tech House"
            list="genre-suggestions"
            maxLength={60}
          />
          <datalist id="genre-suggestions">
            {["House", "Tech House", "Techno", "Progressive House", "Melodic Techno", "Drum & Bass", "Trance", "Disco", "Hip Hop"].map(
              (g) => (
                <option key={g} value={g} />
              ),
            )}
          </datalist>
        </div>

        <div>
          <label className={labelClass} htmlFor="duration">
            曲尺（mm:ss）
          </label>
          <input
            id="duration"
            className={`${inputClass} tabular ${durationInvalid ? "border-magenta" : ""}`}
            value={form.duration}
            onChange={(e) => update("duration", e.target.value)}
            placeholder="6:12"
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="energy">
            エナジー: <span className="tabular text-neon">{form.energy}</span> / 10
          </label>
          <input
            id="energy"
            type="range"
            min={1}
            max={10}
            step={1}
            value={form.energy}
            onChange={(e) => update("energy", Number(e.target.value))}
            className="w-full accent-[var(--color-neon)]"
          />
          <div className="mt-1 flex justify-between text-[10px] text-deck-600">
            <span>1 ウォームアップ</span>
            <span>5 ビルド</span>
            <span>10 ピークタイム</span>
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="releaseYear">
            リリース年
          </label>
          <input
            id="releaseYear"
            className={`${inputClass} tabular`}
            value={form.releaseYear}
            onChange={(e) => update("releaseYear", e.target.value)}
            placeholder="2024"
            type="number"
            min={1900}
            max={2200}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="label">
            レーベル
          </label>
          <input
            id="label"
            className={inputClass}
            value={form.label}
            onChange={(e) => update("label", e.target.value)}
            placeholder="Night Shift Records"
            maxLength={120}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="notes">
            メモ（キューポイント、繋ぎのコツなど）
          </label>
          <textarea
            id="notes"
            className={`${inputClass} min-h-24 resize-y`}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="イントロ 32 小節。ブレイクが長いので早めに混ぜる。"
            maxLength={2000}
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-magenta/50 bg-magenta/10 px-3 py-2.5 text-sm text-magenta">
          <p>{error}</p>
          {issues.length > 0 ? (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs opacity-90">
              {issues.map((issue, i) => (
                <li key={i}>
                  {issue.path ? `${issue.path}: ` : ""}
                  {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-lg border border-lime-glow/50 bg-lime-glow/10 px-3 py-2.5 text-sm text-lime-glow">
          {success}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-neon px-5 py-2.5 text-sm font-semibold text-deck-950 transition hover:bg-neon-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "保存中…" : isEdit ? "変更を保存" : "楽曲を登録"}
        </button>
        {isEdit ? (
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-deck-700 px-4 py-2.5 text-sm text-deck-400 transition hover:bg-deck-800 hover:text-white"
          >
            キャンセル
          </button>
        ) : null}
      </div>
    </form>
  );
}
