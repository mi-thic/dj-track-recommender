import { camelotHue, toMusicalKey } from "@/lib/camelot";

interface Props {
  camelot: string;
  /** 一般的な調表記も併記する */
  showMusicalKey?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function CamelotBadge({ camelot, showMusicalKey = false, size = "sm", className = "" }: Props) {
  const hue = camelotHue(camelot);
  const musical = toMusicalKey(camelot);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-semibold tabular ${
        size === "md" ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs"
      } ${className}`}
      style={{
        color: `hsl(${hue} 85% 74%)`,
        borderColor: `hsl(${hue} 70% 45% / 0.55)`,
        backgroundColor: `hsl(${hue} 70% 45% / 0.14)`,
      }}
      title={musical ? `${camelot}（${musical}）` : camelot}
    >
      {camelot}
      {showMusicalKey && musical ? (
        <span className="font-normal opacity-70">{musical}</span>
      ) : null}
    </span>
  );
}
