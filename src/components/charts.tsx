/**
 * Chart primitives, hand-rolled to the dataviz mark specs: 2px lines, ~10%
 * area washes, hairline solid gridlines, 4px rounded data ends (square at the
 * baseline), 2px surface gaps and rings, crosshair + tooltip on hover.
 */

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export function useContainerWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [0];
  let v = 0;
  while (v < max - step * 0.001) {
    v += step;
    ticks.push(Math.round(v * 100) / 100);
  }
  return ticks;
}

// ---------------------------------------------------------------------------

export interface TooltipState {
  x: number;
  y: number;
  title: string;
  rows: { label: string; value: string; colorVar?: string }[];
}

export function TooltipBox({ tip, width }: { tip: TooltipState; width: number }) {
  const flip = tip.x > width - 170;
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-md border px-2.5 py-2 text-xs shadow-sm"
      style={{
        left: flip ? tip.x - 158 : tip.x + 12,
        top: Math.max(0, tip.y - 10),
        background: "var(--surface-1)",
        borderColor: "var(--border)",
        minWidth: 120,
      }}
    >
      <div style={{ color: "var(--text-muted)" }} className="mb-1">
        {tip.title}
      </div>
      {tip.rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5 py-0.5">
          {r.colorVar && (
            <span
              aria-hidden
              style={{ background: `var(${r.colorVar})`, width: 10, height: 2.5, borderRadius: 2 }}
            />
          )}
          <span className="tnum font-semibold" style={{ color: "var(--text-primary)" }}>
            {r.value}
          </span>
          <span style={{ color: "var(--text-secondary)" }}>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkline — de-emphasis line, accent end dot with surface ring.
// ---------------------------------------------------------------------------

export function Sparkline({
  values,
  width = 104,
  height = 30,
  accentLast = true,
}: {
  values: number[];
  width?: number;
  height?: number;
  accentLast?: boolean;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pad = 5;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - min) / (max - min || 1)) * (height - pad * 2);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const lx = x(values.length - 1);
  const ly = y(values[values.length - 1]);
  return (
    <svg width={width} height={height} aria-hidden className="shrink-0">
      <path d={d} fill="none" stroke="var(--baseline)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {accentLast && (
        <>
          <circle cx={lx} cy={ly} r={6} fill="var(--surface-1)" />
          <circle cx={lx} cy={ly} r={4} fill="var(--accent)" />
        </>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// AreaTrend — single-series line + wash with crosshair tooltip.
// ---------------------------------------------------------------------------

export function AreaTrend({
  values,
  labels,
  height = 220,
  colorVar = "--series-1",
  formatValue = (v: number) => Math.round(v).toLocaleString("en-GB"),
  valueName = "units",
  markers = [],
}: {
  values: number[];
  labels: string[];
  height?: number;
  colorVar?: string;
  formatValue?: (v: number) => string;
  valueName?: string;
  markers?: { index: number; label: string }[];
}) {
  const [ref, width] = useContainerWidth();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [hoverI, setHoverI] = useState<number | null>(null);

  const padL = 44;
  const padR = 12;
  const padT = 10;
  const padB = 24;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = height - padT - padB;
  const max = Math.max(...values, 1);
  const ticks = niceTicks(max);
  const tickMax = ticks[ticks.length - 1];
  const x = (i: number) => padL + (i / (values.length - 1)) * plotW;
  const y = (v: number) => padT + plotH - (v / tickMax) * plotH;

  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${line}L${x(values.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)}L${padL},${(padT + plotH).toFixed(1)}Z`;

  const xLabelEvery = Math.ceil(values.length / Math.max(3, Math.floor(plotW / 90)));

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.min(
      values.length - 1,
      Math.max(0, Math.round(((px - padL) / plotW) * (values.length - 1))),
    );
    setHoverI(i);
    setTip({
      x: x(i),
      y: y(values[i]),
      title: labels[i],
      rows: [{ label: valueName, value: formatValue(values[i]), colorVar }],
    });
  }

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          onPointerMove={onMove}
          onPointerLeave={() => {
            setTip(null);
            setHoverI(null);
          }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
              <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" fontSize={11} fill="var(--text-muted)" className="tnum">
                {t >= 1000 ? `${(t / 1000).toLocaleString("en-GB")}k` : t.toLocaleString("en-GB")}
              </text>
            </g>
          ))}
          {labels.map((l, i) =>
            i % xLabelEvery === 0 ? (
              <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
                {l}
              </text>
            ) : null,
          )}
          {markers.map((m) => (
            <g key={m.index}>
              <line x1={x(m.index)} x2={x(m.index)} y1={padT} y2={padT + plotH} stroke="var(--baseline)" strokeWidth={1} />
              <text x={x(m.index) + 4} y={padT + 10} fontSize={10.5} fill="var(--text-muted)">
                {m.label}
              </text>
            </g>
          ))}
          <path d={area} fill={`var(${colorVar})`} opacity={0.1} />
          <path d={line} fill="none" stroke={`var(${colorVar})`} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {hoverI !== null && (
            <g>
              <line x1={x(hoverI)} x2={x(hoverI)} y1={padT} y2={padT + plotH} stroke="var(--baseline)" strokeWidth={1} />
              <circle cx={x(hoverI)} cy={y(values[hoverI])} r={6} fill="var(--surface-1)" />
              <circle cx={x(hoverI)} cy={y(values[hoverI])} r={4} fill={`var(${colorVar})`} />
            </g>
          )}
          <line x1={padL} x2={width - padR} y1={padT + plotH} y2={padT + plotH} stroke="var(--baseline)" strokeWidth={1} />
        </svg>
      )}
      {tip && <TooltipBox tip={tip} width={width} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HStackBar — one horizontal stacked bar: part-to-whole with 2px surface gaps,
// in-segment labels only where they fit, legend below.
// ---------------------------------------------------------------------------

export interface HSegment {
  label: string;
  value: number;
  colorVar: string;
}

export function HStackBar({
  segments,
  format = (v: number) => Math.round(v).toLocaleString("en-GB"),
  height = 34,
  showLegend = true,
}: {
  segments: HSegment[];
  format?: (v: number) => string;
  height?: number;
  showLegend?: boolean;
}) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [ref, width] = useContainerWidth();
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;

  return (
    <div ref={ref} className="relative w-full">
      <div className="flex w-full overflow-hidden" style={{ gap: 2, height }} role="img">
        {segments.map((s, i) => {
          const pct = (s.value / total) * 100;
          const showLabel = pct >= 9;
          const first = i === 0;
          const last = i === segments.length - 1;
          return (
            <div
              key={s.label}
              tabIndex={0}
              className="flex items-center justify-center text-[11px] font-semibold"
              style={{
                width: `${pct}%`,
                minWidth: s.value > 0 ? 3 : 0,
                background: `var(${s.colorVar})`,
                borderRadius: `${first ? "4px" : "0"} ${last ? "4px" : "0"} ${last ? "4px" : "0"} ${first ? "4px" : "0"}`,
              }}
              onPointerMove={(e) => {
                const rect = ref.current?.getBoundingClientRect();
                if (!rect) return;
                setTip({
                  x: e.clientX - rect.left,
                  y: -6,
                  title: s.label,
                  rows: [{ label: `· ${Math.round(pct)}% of total`, value: format(s.value), colorVar: s.colorVar }],
                });
              }}
              onFocus={() => setTip(null)}
              onPointerLeave={() => setTip(null)}
            >
              {showLabel && <span style={{ color: pickInk(s.colorVar) }}>{Math.round(pct)}%</span>}
            </div>
          );
        })}
      </div>
      {showLegend && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          {segments.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              <span aria-hidden style={{ background: `var(${s.colorVar})`, width: 10, height: 10, borderRadius: 2 }} />
              {s.label}
              <span className="tnum" style={{ color: "var(--text-muted)" }}>
                {format(s.value)}
              </span>
            </span>
          ))}
        </div>
      )}
      {tip && <TooltipBox tip={tip} width={width} />}
    </div>
  );
}

/** In-segment label ink by fill luminance (orange/teal/pink need dark ink). */
function pickInk(colorVar: string): string {
  return ["--series-2", "--series-3", "--series-5"].includes(colorVar) ? "#10131f" : "#ffffff";
}

// ---------------------------------------------------------------------------
// GroupedColumns — small grouped column chart (e.g. cover weeks by category,
// UK vs DE). Rounded caps, square baselines, per-column tooltip, cap labels.
// ---------------------------------------------------------------------------

export function GroupedColumns({
  groups,
  seriesNames,
  colorVars = ["--series-1", "--series-2"],
  height = 210,
  format = (v: number) => (Math.round(v * 10) / 10).toLocaleString("en-GB"),
  refLine,
}: {
  groups: { label: string; values: number[] }[];
  seriesNames: string[];
  colorVars?: string[];
  height?: number;
  format?: (v: number) => string;
  refLine?: { value: number; label: string };
}) {
  const [ref, width] = useContainerWidth();
  const [tip, setTip] = useState<TooltipState | null>(null);

  const padL = 34;
  const padR = 8;
  const padT = 14;
  const padB = 34;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = height - padT - padB;
  const max = Math.max(...groups.flatMap((g) => g.values), refLine?.value ?? 0, 1);
  const ticks = niceTicks(max, 3);
  const tickMax = ticks[ticks.length - 1];
  const y = (v: number) => padT + plotH - (v / tickMax) * plotH;

  const groupW = plotW / groups.length;
  const barW = Math.min(24, (groupW * 0.55) / seriesNames.length);
  const gap = 2;

  function roundedColumn(cx: number, v: number): string {
    const top = y(v);
    const bottom = padT + plotH;
    const r = Math.min(4, barW / 2, Math.max(0, bottom - top));
    const x0 = cx;
    const x1 = cx + barW;
    return `M${x0},${bottom}L${x0},${top + r}Q${x0},${top} ${x0 + r},${top}L${x1 - r},${top}Q${x1},${top} ${x1},${top + r}L${x1},${bottom}Z`;
  }

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
              <text x={padL - 6} y={y(t) + 3.5} textAnchor="end" fontSize={11} fill="var(--text-muted)" className="tnum">
                {t.toLocaleString("en-GB")}
              </text>
            </g>
          ))}
          {refLine && (
            <line x1={padL} x2={width - padR} y1={y(refLine.value)} y2={y(refLine.value)} stroke="var(--baseline)" strokeWidth={1} />
          )}
          {groups.map((g, gi) => {
            const totalBars = seriesNames.length * barW + (seriesNames.length - 1) * gap;
            const start = padL + gi * groupW + (groupW - totalBars) / 2;
            return (
              <g
                key={g.label}
                onPointerMove={(e) => {
                  const rect = ref.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTip({
                    x: e.clientX - rect.left,
                    y: padT,
                    title: g.label,
                    rows: g.values.map((v, si) => ({
                      label: seriesNames[si],
                      value: format(v),
                      colorVar: colorVars[si],
                    })),
                  });
                }}
                onPointerLeave={() => setTip(null)}
              >
                <rect
                  x={padL + gi * groupW}
                  y={padT}
                  width={groupW}
                  height={plotH}
                  fill="transparent"
                />
                {g.values.map((v, si) => (
                  <g key={si}>
                    <path d={roundedColumn(start + si * (barW + gap), v)} fill={`var(${colorVars[si]})`} />
                    {groupW >= 56 && (
                      <text
                        x={start + si * (barW + gap) + barW / 2}
                        y={y(v) - 4}
                        textAnchor="middle"
                        fontSize={10.5}
                        className="tnum"
                        fill="var(--text-secondary)"
                      >
                        {format(v)}
                      </text>
                    )}
                  </g>
                ))}
                <text
                  x={padL + gi * groupW + groupW / 2}
                  y={height - 16}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--text-muted)"
                >
                  {g.label.length * 6 > groupW && g.label.includes(" ") ? (
                    (() => {
                      // Two lines, split at the word break nearest the middle.
                      const words = g.label.split(" ");
                      let cut = 1;
                      while (cut < words.length - 1 && words.slice(0, cut + 1).join(" ").length <= g.label.length / 2) cut++;
                      const cx = padL + gi * groupW + groupW / 2;
                      return (
                        <>
                          <tspan x={cx} dy={0}>
                            {words.slice(0, cut).join(" ")}
                          </tspan>
                          <tspan x={cx} dy={12}>
                            {words.slice(cut).join(" ")}
                          </tspan>
                        </>
                      );
                    })()
                  ) : (
                    g.label
                  )}
                </text>
              </g>
            );
          })}
          <line x1={padL} x2={width - padR} y1={padT + plotH} y2={padT + plotH} stroke="var(--baseline)" strokeWidth={1} />
        </svg>
      )}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        {seriesNames.map((s, i) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span aria-hidden style={{ background: `var(${colorVars[i]})`, width: 10, height: 10, borderRadius: 2 }} />
            {s}
          </span>
        ))}
        {refLine && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden style={{ background: "var(--baseline)", width: 12, height: 1.5 }} />
            {refLine.label}
          </span>
        )}
      </div>
      {tip && <TooltipBox tip={tip} width={width} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meter — a ratio against a limit; unfilled track is a lighter step of the
// same ramp, overflow switches the fill to the serious status step.
// ---------------------------------------------------------------------------

export function Meter({
  pct,
  target,
  children,
}: {
  pct: number;
  target?: number;
  children?: ReactNode;
}) {
  const fill = Math.min(100, pct);
  const over = pct > 100;
  return (
    <div>
      <div
        className="relative h-3.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--meter-track)" }}
        role="img"
        aria-label={`${Math.round(pct)}% full`}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${fill}%`, background: over ? "var(--status-serious)" : "var(--seq-450)" }}
        />
        {target !== undefined && (
          <div
            className="absolute top-0 h-full"
            style={{ left: `${target}%`, width: 2, background: "var(--surface-1)" }}
          />
        )}
      </div>
      {children}
    </div>
  );
}
