/** 秒 → "m:ss" */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** "3:45" / "225" → 秒。パースできなければ null */
export function parseDuration(input: string | null | undefined): number | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) return Number(trimmed);

  const m = /^(\d+):([0-5]?\d)$/.exec(trimmed);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
