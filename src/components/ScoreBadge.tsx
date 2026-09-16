import { scoreRank } from "@/lib/recommend";

const TONE_CLASS: Record<string, string> = {
  excellent: "border-lime-glow/50 bg-lime-glow/12 text-lime-glow",
  good: "border-neon/50 bg-neon/12 text-neon-soft",
  fair: "border-amber-glow/50 bg-amber-glow/12 text-amber-glow",
  risky: "border-magenta/50 bg-magenta/12 text-magenta",
};

export function ScoreBadge({ score }: { score: number }) {
  const rank = scoreRank(score);
  return (
    <span
      className={`inline-flex items-baseline gap-1.5 rounded-lg border px-2.5 py-1 ${TONE_CLASS[rank.tone]}`}
    >
      <span className="tabular text-base font-bold leading-none">{Math.round(score)}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
        {rank.label}
      </span>
    </span>
  );
}
