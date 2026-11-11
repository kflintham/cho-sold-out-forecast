/**
 * The true-demand bridge: demand still to come (season shape + customers
 * waiting) against supply (stock in each location + open re-orders), with
 * the gap called out.
 */

import type { TrueDemandLine } from "../engine/stock";
import { fmtInt } from "../lib/format";
import { Chip } from "./ui";

const DARK_INK = new Set(["--series-2", "--series-3", "--series-5"]);

function Bar({
  name,
  segments,
  scale,
}: {
  name: string;
  segments: { label: string; value: number; colorVar: string }[];
  scale: number;
}) {
  const visible = segments.filter((s) => s.value > 0.5);
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <div className="flex items-center gap-3">
      <div className="w-16 shrink-0 text-right text-xs" style={{ color: "var(--text-secondary)" }}>
        {name}
      </div>
      <div className="relative h-8 flex-1">
        <div className="absolute inset-y-0 left-0 flex" style={{ gap: 2, width: `${(total / scale) * 100}%` }}>
          {visible.map((s, i) => {
            const pct = (s.value / total) * 100;
            return (
              <div
                key={s.label}
                className="flex h-full items-center justify-center text-[11px] font-semibold"
                style={{
                  width: `${pct}%`,
                  minWidth: 3,
                  background: `var(${s.colorVar})`,
                  borderRadius:
                    visible.length === 1
                      ? "4px"
                      : i === 0
                        ? "4px 0 0 4px"
                        : i === visible.length - 1
                          ? "0 4px 4px 0"
                          : "0",
                }}
                title={`${s.label}: ${fmtInt(s.value)} units`}
              >
                {pct > 12 && (
                  <span className="tnum" style={{ color: DARK_INK.has(s.colorVar) ? "#10131f" : "#ffffff" }}>
                    {fmtInt(s.value)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="tnum w-10 shrink-0 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
        {fmtInt(total)}
      </div>
    </div>
  );
}

export function DemandBridge({ td }: { td: TrueDemandLine }) {
  const fc = td.fc;
  const demand = [
    { label: "Demand still to come", value: td.remainingDemand, colorVar: "--series-1" },
    { label: "Customers waiting", value: td.waiting, colorVar: "--series-2" },
  ];
  const supply = [
    { label: "Main shop", value: fc.line.stockByLoc.main, colorVar: "--series-4" },
    { label: "Second shop", value: fc.line.stockByLoc.second, colorVar: "--series-3" },
    { label: "Online", value: fc.line.stockByLoc.online, colorVar: "--series-5" },
    { label: "On re-order", value: td.onOrder, colorVar: "--baseline" },
  ];
  const scale = Math.max(
    demand.reduce((a, s) => a + s.value, 0),
    supply.reduce((a, s) => a + s.value, 0),
    1,
  );

  return (
    <div>
      <div className="space-y-2">
        <Bar name="Demand" segments={demand} scale={scale} />
        <Bar name="Supply" segments={supply} scale={scale} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        {[...demand, ...supply].map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span aria-hidden style={{ background: `var(${s.colorVar})`, width: 10, height: 10, borderRadius: 2 }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {td.gap < 0.5 ? (
          <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
            → Covered for the rest of the season{td.onOrder > 0 ? " — the open re-order closes the gap" : ""}
          </span>
        ) : td.reorder > 0 ? (
          <>
            <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              → Re-order {fmtInt(td.reorder)} from {fc.brand.name}
            </span>
            <Chip>lands in {fc.brand.topUpLeadWeeks} wks</Chip>
            {fc.brand.sizeRun > 1 && <Chip>{fc.brand.sizeRun}-piece size runs</Chip>}
          </>
        ) : (
          <>
            <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              → {fmtInt(td.gap)} short and {fc.brand.name} can't restock — logged for next year's buy
            </span>
            {td.waiting > 0 && <Chip tone="accent">offer waiting customers an alternative</Chip>}
          </>
        )}
      </div>
    </div>
  );
}
