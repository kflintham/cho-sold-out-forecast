/**
 * One line's season, week by week: what sold (solid), the demand the engine
 * recovered for weeks the shelf was empty (missed, hatched), and — for the
 * current season — the weeks still to come (projected, outlined).
 */

import { useState } from "react";
import { seasonWeekDate } from "../data/dataset";
import type { LineForecast } from "../engine/forecast";
import { TooltipBox, niceTicks, useContainerWidth, type TooltipState } from "./charts";

const fmt = (v: number) => (Math.round(v * 10) / 10).toLocaleString("en-GB");
const day = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function SeasonChart({
  fc,
  showMissed = true,
  height = 240,
}: {
  fc: LineForecast;
  showMissed?: boolean;
  height?: number;
}) {
  const [ref, width] = useContainerWidth();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const weeks = fc.seasonWeeks;
  const demandAt = (w: number) => fc.demand * fc.curve[w];
  const rows = Array.from({ length: weeks }, (_, w) => {
    const traded = w < fc.weeksTraded;
    const sold = traded ? fc.line.sales[w] : 0;
    const stockEnd = traded ? fc.line.endStock[w] : null;
    const demand = demandAt(w);
    // A week that ended with stock saw every customer; only empty weeks miss.
    const missed = traded && stockEnd === 0 ? Math.max(0, demand - sold) : 0;
    const projected = traded ? 0 : demand;
    return { w, traded, sold, stockEnd, demand, missed, projected };
  });

  const padL = 30;
  const padR = 8;
  const padT = 22;
  const padB = 26;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = height - padT - padB;
  const max = Math.max(...rows.map((r) => Math.max(r.sold + (showMissed ? r.missed : 0), r.projected)), 1);
  const ticks = niceTicks(max, 3);
  const tickMax = ticks[ticks.length - 1];
  const y = (v: number) => padT + plotH - (v / tickMax) * plotH;
  const slot = plotW / weeks;
  const barW = Math.max(4, Math.min(28, slot * 0.66));
  const x0 = (w: number) => padL + w * slot + (slot - barW) / 2;
  const bottom = padT + plotH;
  const r = Math.min(4, barW / 2);

  const topRounded = (x: number, top: number, base: number) => {
    const h = base - top;
    if (h <= 0.5) return "";
    const rr = Math.min(r, h);
    return `M${x},${base}L${x},${top + rr}Q${x},${top} ${x + rr},${top}L${x + barW - rr},${top}Q${x + barW},${top} ${x + barW},${top + rr}L${x + barW},${base}Z`;
  };

  const labelEvery = slot < 18 ? 4 : slot < 30 ? 2 : 1;
  const soldOut = fc.soldOutWeek;
  const patternId = `miss-${fc.line.id}`;

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${fc.line.name}: weekly sales${showMissed ? " and missed demand" : ""}`}
          onPointerLeave={() => {
            setTip(null);
            setHover(null);
          }}
        >
          <defs>
            <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--series-2)" opacity="0.28" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--series-2)" strokeWidth="2.4" />
            </pattern>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
              <text x={padL - 6} y={y(t) + 3.5} textAnchor="end" fontSize={11} fill="var(--text-muted)" className="tnum">
                {t.toLocaleString("en-GB")}
              </text>
            </g>
          ))}

          {/* empty-shelf band */}
          {rows.map((row) =>
            row.traded && row.stockEnd === 0 && row.sold === 0 ? (
              <rect key={`oos-${row.w}`} x={padL + row.w * slot} y={padT} width={slot} height={plotH} fill="var(--surface-2)" opacity={0.7} />
            ) : null,
          )}
          {/* today divider for the current season */}
          {!fc.finished && (
            <g>
              <line
                x1={padL + fc.weeksTraded * slot}
                x2={padL + fc.weeksTraded * slot}
                y1={padT - 6}
                y2={bottom}
                stroke="var(--text-muted)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {soldOut !== fc.weeksTraded && (
                <text x={padL + fc.weeksTraded * slot + 4} y={padT - 8} fontSize={10.5} fill="var(--text-muted)">
                  today
                </text>
              )}
            </g>
          )}

          {rows.map((row) => {
            const x = x0(row.w);
            const soldTop = y(row.sold);
            const missTop = y(row.sold + row.missed);
            return (
              <g
                key={row.w}
                onPointerMove={(e) => {
                  const rect = ref.current?.getBoundingClientRect();
                  if (!rect) return;
                  setHover(row.w);
                  const rowsOut: TooltipState["rows"] = [];
                  if (row.traded) rowsOut.push({ label: "sold", value: String(row.sold), colorVar: "--series-1" });
                  if (row.traded && showMissed && row.missed > 0.05)
                    rowsOut.push({ label: "est. missed", value: fmt(row.missed), colorVar: "--series-2" });
                  if (!row.traded) rowsOut.push({ label: "projected demand", value: fmt(row.projected), colorVar: "--baseline" });
                  if (row.stockEnd !== null) rowsOut.push({ label: "left at week end", value: String(row.stockEnd) });
                  setTip({
                    x: e.clientX - rect.left,
                    y: padT,
                    title: `Week ${row.w + 1} · w/c ${day(seasonWeekDate(fc.line.season, row.w + 1))}`,
                    rows: rowsOut,
                  });
                }}
              >
                <rect x={padL + row.w * slot} y={padT} width={slot} height={plotH} fill="transparent" />
                {hover === row.w && (
                  <rect x={padL + row.w * slot} y={padT} width={slot} height={plotH} fill="var(--grid)" opacity={0.5} />
                )}
                {row.traded && <path d={topRounded(x, soldTop, bottom)} fill="var(--series-1)" />}
                {row.traded && showMissed && row.missed > 0.05 && (
                  <path
                    d={topRounded(x, missTop, row.sold > 0 ? soldTop - 2 : bottom)}
                    fill={`url(#${patternId})`}
                  />
                )}
                {!row.traded && row.projected > 0.05 && (
                  <path
                    d={topRounded(x + 0.75, y(row.projected), bottom)}
                    fill="none"
                    stroke="var(--baseline)"
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                  />
                )}
                {row.w % labelEvery === 0 && (
                  <text x={padL + row.w * slot + slot / 2} y={height - 8} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
                    {row.w + 1}
                  </text>
                )}
              </g>
            );
          })}

          {soldOut !== null && (
            <g pointerEvents="none">
              <line
                x1={padL + soldOut * slot}
                x2={padL + soldOut * slot}
                y1={padT - 6}
                y2={bottom}
                stroke="var(--status-critical)"
                strokeWidth={1.5}
              />
              <text
                x={padL + soldOut * slot + 4}
                y={padT - 8}
                fontSize={10.5}
                fontWeight={600}
                fill="var(--status-critical)"
              >
                sold out · week {soldOut}
              </text>
            </g>
          )}
          {fc.line.topUps.map((t) => (
            <g key={t.week} pointerEvents="none">
              <line
                x1={padL + (t.week - 1) * slot}
                x2={padL + (t.week - 1) * slot}
                y1={padT + 8}
                y2={bottom}
                stroke="var(--series-3)"
                strokeWidth={1.5}
              />
              <text x={padL + (t.week - 1) * slot + 4} y={padT + 18} fontSize={10.5} fill="var(--text-secondary)">
                top-up +{t.qty}
              </text>
            </g>
          ))}
          <line x1={padL} x2={width - padR} y1={bottom} y2={bottom} stroke="var(--baseline)" strokeWidth={1} />
        </svg>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden style={{ background: "var(--series-1)", width: 10, height: 10, borderRadius: 2 }} />
          Sold
        </span>
        {showMissed && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="10" height="10" aria-hidden>
              <rect width="10" height="10" rx="2" fill={`url(#${patternId})`} />
            </svg>
            Estimated missed demand
          </span>
        )}
        {!fc.finished && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden style={{ border: "1.5px dashed var(--baseline)", width: 10, height: 10, borderRadius: 2 }} />
            Projected demand
          </span>
        )}
        <span style={{ color: "var(--text-muted)" }}>season week →</span>
      </div>
      {tip && <TooltipBox tip={tip} width={width} />}
    </div>
  );
}
