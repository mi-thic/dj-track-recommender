"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { formatBpm } from "@/lib/bpm";
import type { TrackDTO } from "@/lib/types";

/**
 * セットのエナジーと BPM の推移。
 *
 * 尺度の違う 2 つの量を 1 枚に重ねる 2 軸グラフにはせず、横軸（曲順）を共有した
 * 2 段のグラフにする。目標エナジーは系列ではなく参照線なので、無彩色の破線で描く。
 * 色は globals.css の --viz-* を使う（ダーク背景に対して検証済み）。
 *
 * 曲の詳細はグラフに重ねず、上の表示帯に十字線の位置へ追従して出す。
 * エナジー側は高さが小さく、重ねるとどこに出しても線の大部分が隠れるため。
 */

interface Props {
  tracks: TrackDTO[];
  /** 自動生成の目標エナジー（曲順に対応）。無ければ目標線を描かない */
  targets?: number[] | null;
}

const LEFT = 36;
const RIGHT = 16;
const TITLE = 20;
const ENERGY_H = 112;
const PANEL_GAP = 34;
const BPM_H = 84;
const AXIS_H = 24;

const ENERGY_TOP = TITLE;
const BPM_TOP = ENERGY_TOP + ENERGY_H + PANEL_GAP;
const HEIGHT = BPM_TOP + BPM_H + AXIS_H;

/** 曲の詳細を出す表示帯 */
const READOUT_H = 58;
const READOUT_W = 340;

const AXIS_TEXT = "var(--viz-axis-text)";
const PANEL_TITLE = "var(--color-deck-400)";

function useElementWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // 初期幅は直接読む。ResizeObserver の初回通知は描画が走るまで来ないため、
    // 裏タブで開いたときなどにグラフが出ないままになる
    setWidth(Math.floor(element.getBoundingClientRect().width));
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * BPM 軸の範囲と目盛り。目盛りは等間隔のきりの良い値にする
 * （中央値を丸めると 120 / 140 / 155 のように間隔が揃わず、読み違える）。
 * 幅に応じて刻みを選び、目盛りが 3〜4 本に収まるようにする。
 */
function bpmScale(values: number[]) {
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const span = max - min;
  const step = span <= 15 ? 5 : span <= 30 ? 10 : span <= 60 ? 20 : 50;
  const low = Math.floor(min / step) * step;
  let high = Math.ceil(max / step) * step;
  if (high === low) high += step;
  const ticks: number[] = [];
  for (let v = low; v <= high; v += step) ticks.push(v);
  return { low, high, ticks };
}

function linePath(points: Array<[number, number]>): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

export function SetFlowChart({ tracks, targets }: Props) {
  const [containerRef, width] = useElementWidth();
  const [active, setActive] = useState<number | null>(null);

  const count = tracks.length;
  const plotWidth = Math.max(0, width - LEFT - RIGHT);
  const x = (i: number) => LEFT + (count <= 1 ? plotWidth / 2 : (i * plotWidth) / (count - 1));

  const energyY = (value: number) => ENERGY_TOP + ENERGY_H - (value / 10) * ENERGY_H;
  const bpm = bpmScale(tracks.map((t) => t.bpm));
  const bpmY = (value: number) =>
    BPM_TOP + BPM_H - ((value - bpm.low) / (bpm.high - bpm.low)) * BPM_H;

  const targetPoints = (targets ?? [])
    .slice(0, count)
    .map((value, i): [number, number] => [x(i), energyY(value)]);
  const hasTargets = targetPoints.length >= 2;

  // 曲数が多いときは番号を間引く（最後の曲は必ず出す）
  const labelEvery = count <= 20 ? 1 : 5;

  function indexAt(clientX: number, rect: DOMRect): number {
    const relative = clientX - rect.left - LEFT;
    if (count <= 1) return 0;
    const i = Math.round((relative / plotWidth) * (count - 1));
    return Math.min(count - 1, Math.max(0, i));
  }

  function onPointerMove(event: PointerEvent<SVGRectElement>) {
    const svg = event.currentTarget.ownerSVGElement;
    if (svg) setActive(indexAt(event.clientX, svg.getBoundingClientRect()));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActive((i) => Math.min(count - 1, (i ?? -1) + 1));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActive((i) => Math.max(0, (i ?? count) - 1));
    } else if (event.key === "Escape") {
      setActive(null);
    }
  }

  const activeTrack = active !== null ? tracks[active] : null;
  const activeTarget = active !== null && hasTargets ? targets?.[active] : undefined;
  // 表示帯の箱は十字線の真上を中心に、はみ出さないよう左右端で止める
  const readoutLeft =
    active !== null ? Math.min(Math.max(0, x(active) - READOUT_W / 2), Math.max(0, width - READOUT_W)) : 0;

  return (
    <section
      className="rounded-xl border border-deck-700/70 px-4 pb-3 pt-3.5"
      style={{ background: "var(--viz-surface)" }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold text-white">エナジーと BPM の流れ</h2>
        {/* 凡例: 系列を見分ける確実な手段として常に出す。線の形で示す */}
        <ul className="flex items-center gap-4 text-[11px] text-deck-400">
          <li className="flex items-center gap-1.5">
            <LineKey color="var(--viz-series-1)" width={16} />
            エナジー
          </li>
          {hasTargets ? (
            <li className="flex items-center gap-1.5">
              <LineKey color="var(--viz-reference)" width={16} dashed />
              目標
            </li>
          ) : null}
          <li className="flex items-center gap-1.5">
            <LineKey color="var(--viz-series-2)" width={16} />
            BPM
          </li>
        </ul>
      </div>

      <div
        ref={containerRef}
        className="mt-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-neon/40"
        tabIndex={0}
        role="group"
        aria-label={`セット ${count} 曲のエナジーと BPM の推移。左右キーで曲を移動`}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((i) => i ?? 0)}
        onBlur={() => setActive(null)}
      >
        {/* 曲の詳細（グラフに重ねない） */}
        <div className="relative" style={{ height: READOUT_H }} aria-live="polite">
          {activeTrack && active !== null ? (
            <>
              <div
                className="absolute top-0 rounded-lg border border-deck-700 bg-deck-950 px-3 py-1.5"
                style={{ left: readoutLeft, width: Math.min(READOUT_W, width) }}
              >
                <p className="truncate text-xs text-white">
                  <span className="tabular text-deck-400">{active + 1}.</span>{" "}
                  <span className="font-semibold">{activeTrack.title}</span>{" "}
                  <span className="text-deck-400">{activeTrack.artist}</span>
                </p>
                <p className="mt-0.5 flex items-center gap-3 text-[11px]">
                  <Readout color="var(--viz-series-1)" value={String(activeTrack.energy)} label="エナジー" />
                  {activeTarget !== undefined ? (
                    <Readout color="var(--viz-reference)" dashed value={String(activeTarget)} label="目標" />
                  ) : null}
                  <Readout color="var(--viz-series-2)" value={formatBpm(activeTrack.bpm)} label="BPM" />
                  <span className="ml-auto text-deck-400">{activeTrack.camelot}</span>
                </p>
              </div>
              {/* 箱と十字線をつなぐ目印 */}
              <div
                className="absolute bottom-0 w-px"
                style={{ left: x(active), top: 50, background: "var(--viz-reference)", opacity: 0.6 }}
              />
            </>
          ) : (
            <p className="pt-3 text-[11px] text-deck-400">
              グラフにカーソルを合わせる（またはフォーカスして ← → キー）と、その曲の詳細を表示します。
            </p>
          )}
        </div>

        <div style={{ height: HEIGHT }}>
          {width > 0 ? (
            <svg width={width} height={HEIGHT} className="block select-none" aria-hidden>
              {/* パネル名 */}
              <text x={LEFT} y={ENERGY_TOP - 8} fill={PANEL_TITLE} fontSize="11">
                エナジー
              </text>
              <text x={LEFT} y={BPM_TOP - 8} fill={PANEL_TITLE} fontSize="11">
                BPM
              </text>

              {/* 目盛り線（実線の極細・控えめ） */}
              {[0, 5, 10].map((v) => (
                <g key={`e${v}`}>
                  <line x1={LEFT} x2={width - RIGHT} y1={energyY(v)} y2={energyY(v)} stroke="var(--viz-grid)" strokeWidth="1" />
                  <text x={LEFT - 8} y={energyY(v) + 3.5} textAnchor="end" fill={AXIS_TEXT} fontSize="10" className="tabular">
                    {v}
                  </text>
                </g>
              ))}
              {bpm.ticks.map((v) => (
                <g key={`b${v}`}>
                  <line x1={LEFT} x2={width - RIGHT} y1={bpmY(v)} y2={bpmY(v)} stroke="var(--viz-grid)" strokeWidth="1" />
                  <text x={LEFT - 8} y={bpmY(v) + 3.5} textAnchor="end" fill={AXIS_TEXT} fontSize="10" className="tabular">
                    {v}
                  </text>
                </g>
              ))}

              {/* 曲番号の軸 */}
              {tracks.map((_, i) =>
                i % labelEvery === 0 || i === count - 1 ? (
                  <text
                    key={`x${i}`}
                    x={x(i)}
                    y={HEIGHT - 6}
                    textAnchor="middle"
                    fill={active === i ? "white" : AXIS_TEXT}
                    fontSize="10"
                    className="tabular"
                  >
                    {i + 1}
                  </text>
                ) : null,
              )}

              {/* 十字線（上の表示帯から両パネルをまたぐ） */}
              {active !== null ? (
                <line
                  x1={x(active)}
                  x2={x(active)}
                  y1={0}
                  y2={BPM_TOP + BPM_H}
                  stroke="var(--viz-reference)"
                  strokeOpacity="0.6"
                  strokeWidth="1"
                />
              ) : null}

              {/* 目標エナジー（参照線なので点は打たない） */}
              {hasTargets ? (
                <path
                  d={linePath(targetPoints)}
                  fill="none"
                  stroke="var(--viz-reference)"
                  strokeWidth="2"
                  strokeDasharray="5 3"
                />
              ) : null}

              {/* エナジー */}
              <path
                d={linePath(tracks.map((t, i) => [x(i), energyY(t.energy)]))}
                fill="none"
                stroke="var(--viz-series-1)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {tracks.map((t, i) => (
                <circle
                  key={`ed${i}`}
                  cx={x(i)}
                  cy={energyY(t.energy)}
                  r={active === i ? 5.5 : 4}
                  fill="var(--viz-series-1)"
                  stroke="var(--viz-surface)"
                  strokeWidth="2"
                />
              ))}

              {/* BPM */}
              <path
                d={linePath(tracks.map((t, i) => [x(i), bpmY(t.bpm)]))}
                fill="none"
                stroke="var(--viz-series-2)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {tracks.map((t, i) => (
                <circle
                  key={`bd${i}`}
                  cx={x(i)}
                  cy={bpmY(t.bpm)}
                  r={active === i ? 5.5 : 4}
                  fill="var(--viz-series-2)"
                  stroke="var(--viz-surface)"
                  strokeWidth="2"
                />
              ))}

              {/* ホバー判定は描画領域全体（点を狙わなくても最寄りの曲に吸着する） */}
              <rect
                x={LEFT - 8}
                y={0}
                width={plotWidth + 16}
                height={HEIGHT}
                fill="transparent"
                onPointerMove={onPointerMove}
                onPointerLeave={() => setActive(null)}
              />
            </svg>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function LineKey({ color, width, dashed = false }: { color: string; width: number; dashed?: boolean }) {
  return (
    <svg width={width} height="8" aria-hidden className="shrink-0">
      <line
        x1="0"
        y1="4"
        x2={width}
        y2="4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap={dashed ? undefined : "round"}
        strokeDasharray={dashed ? "4 2" : undefined}
      />
    </svg>
  );
}

/** 値を先に強く、系列名は後ろに控えめに。系列は短い線のキーで示す */
function Readout({
  color,
  value,
  label,
  dashed = false,
}: {
  color: string;
  value: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <LineKey color={color} width={12} dashed={dashed} />
      <span className="tabular font-semibold text-white">{value}</span>
      <span className="text-deck-400">{label}</span>
    </span>
  );
}
