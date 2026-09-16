interface Props {
  energy: number;
  className?: string;
}

/** エナジー 1-10 を 10 本のバーで表示する */
export function EnergyMeter({ energy, className = "" }: Props) {
  const level = Math.min(10, Math.max(1, Math.round(energy)));

  return (
    <span
      className={`inline-flex items-end gap-[2px] ${className}`}
      title={`エナジー ${level} / 10`}
      aria-label={`エナジー ${level} / 10`}
    >
      {Array.from({ length: 10 }, (_, i) => {
        const active = i < level;
        const height = 5 + i * 1.1;
        return (
          <span
            key={i}
            className="w-[3px] rounded-sm transition-colors"
            style={{
              height: `${height}px`,
              backgroundColor: active
                ? `hsl(${Math.round(190 - i * 17)} 85% 60%)`
                : "var(--color-deck-700)",
            }}
          />
        );
      })}
    </span>
  );
}
