"use client";

import Link from "next/link";
import { useState } from "react";

import { CamelotBadge } from "@/components/CamelotBadge";
import {
  camelotHue,
  getCamelotCompatibility,
  getCompatibleKeys,
  toMusicalKey,
  type CamelotLetter,
} from "@/lib/camelot";

interface Props {
  /** キーごとの登録曲数 */
  counts?: Record<string, number>;
}

const SIZE = 340;
const CENTER = SIZE / 2;
const OUTER = { r1: 164, r2: 118 }; // B（メジャー）
const INNER = { r1: 112, r2: 64 }; // A（マイナー）

function polar(radius: number, angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [CENTER + radius * Math.cos(rad), CENTER + radius * Math.sin(rad)];
}

function sectorPath(rOuter: number, rInner: number, startDeg: number, endDeg: number): string {
  const [x1, y1] = polar(rOuter, startDeg);
  const [x2, y2] = polar(rOuter, endDeg);
  const [x3, y3] = polar(rInner, endDeg);
  const [x4, y4] = polar(rInner, startDeg);
  return [
    `M ${x1} ${y1}`,
    `A ${rOuter} ${rOuter} 0 0 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rInner} ${rInner} 0 0 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}

export function CamelotWheel({ counts = {} }: Props) {
  const [selected, setSelected] = useState("8A");
  const compatible = getCompatibleKeys(selected);
  const compatibleSet = new Map(compatible.map((entry) => [entry.camelot, entry.compatibility]));

  const wedges: Array<{ camelot: string; number: number; letter: CamelotLetter; ring: typeof OUTER }> = [];
  for (let n = 1; n <= 12; n += 1) {
    wedges.push({ camelot: `${n}B`, number: n, letter: "B", ring: OUTER });
    wedges.push({ camelot: `${n}A`, number: n, letter: "A", ring: INNER });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-start">
      <div className="mx-auto">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-auto w-[340px] max-w-full"
          role="img"
          aria-label="Camelot ホイール"
        >
          {wedges.map(({ camelot, number, ring }) => {
            const start = (number - 1) * 30 - 15;
            const end = start + 30;
            const hue = camelotHue(camelot);
            const isSelected = camelot === selected;
            const relation = compatibleSet.get(camelot);

            const opacity = isSelected ? 1 : relation ? 0.55 : 0.12;
            const [lx, ly] = polar((ring.r1 + ring.r2) / 2, start + 15);
            const count = counts[camelot] ?? 0;

            return (
              <g
                key={camelot}
                onClick={() => setSelected(camelot)}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(camelot);
                  }
                }}
              >
                <title>
                  {camelot}（{toMusicalKey(camelot)}）
                  {count > 0 ? ` · ${count} 曲` : ""}
                  {relation ? ` · ${relation.label}` : ""}
                </title>
                <path
                  d={sectorPath(ring.r1, ring.r2, start, end)}
                  fill={`hsl(${hue} 70% 50% / ${opacity})`}
                  stroke={isSelected ? `hsl(${hue} 90% 75%)` : "var(--color-deck-950)"}
                  strokeWidth={isSelected ? 2 : 1.5}
                />
                <text
                  x={lx}
                  y={ly - 3}
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                  fontSize="13"
                  fontWeight="700"
                  fill={isSelected || relation ? "#fff" : "hsl(240 10% 55%)"}
                >
                  {camelot}
                </text>
                <text
                  x={lx}
                  y={ly + 10}
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                  fontSize="9"
                  fill={isSelected || relation ? "rgba(255,255,255,0.7)" : "hsl(240 10% 40%)"}
                >
                  {count > 0 ? `${toMusicalKey(camelot)} · ${count}` : toMusicalKey(camelot)}
                </text>
              </g>
            );
          })}

          <circle cx={CENTER} cy={CENTER} r={56} fill="var(--color-deck-900)" stroke="var(--color-deck-700)" />
          <text
            x={CENTER}
            y={CENTER - 4}
            textAnchor="middle"
            fontSize="26"
            fontWeight="800"
            fill={`hsl(${camelotHue(selected)} 85% 74%)`}
          >
            {selected}
          </text>
          <text x={CENTER} y={CENTER + 16} textAnchor="middle" fontSize="12" fill="var(--color-deck-400)">
            {toMusicalKey(selected)}
          </text>
        </svg>
      </div>

      <div className="space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-white">
            <CamelotBadge camelot={selected} size="md" showMusicalKey /> から繋げるキー
          </h2>
          <ul className="mt-3 space-y-2">
            {compatible.map(({ camelot, compatibility }) => (
              <li
                key={camelot}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-deck-800 bg-deck-900/50 px-3 py-2"
              >
                <CamelotBadge camelot={camelot} showMusicalKey />
                <span className="text-xs font-medium text-white">{compatibility.label}</span>
                <span className="tabular ml-auto text-xs text-deck-600">
                  {counts[camelot] ?? 0} 曲
                </span>
                <p className="w-full text-[11px] text-deck-400">{compatibility.description}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-deck-800 bg-deck-900/40 px-3 py-2.5 text-[11px] leading-relaxed text-deck-400">
          <p>
            外側のリングが <strong className="text-white">B（メジャー）</strong>、内側が{" "}
            <strong className="text-white">A（マイナー）</strong>。時計回りに 1 つ進むと完全 5 度上がり、
            同じ番号の A / B は平行調の関係です。
          </p>
          <p className="mt-1.5">
            自分の曲が各キーに何曲あるかも表示されます。
            <Link href="/" className="ml-1 text-neon transition hover:underline">
              ライブラリを見る →
            </Link>
          </p>
        </div>

        <p className="text-[11px] text-deck-600">
          例: {selected} → {compatible[1]?.camelot ?? "—"} は「
          {getCamelotCompatibility(selected, compatible[1]?.camelot ?? selected).label}」。
        </p>
      </div>
    </div>
  );
}
