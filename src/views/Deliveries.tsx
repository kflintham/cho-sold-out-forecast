import { useMemo } from "react";
import { useApp } from "../state/AppState";
import {
  BRANDS,
  BRAND_PERFORMANCE,
  LINE_BY_ID,
  NEXT_SEASON,
  REORDERS,
  REORDER_STAGES,
  REORDER_STAGE_LABEL,
  SS27_DROPS,
  seasonWeekDate,
} from "../data/dataset";
import { LAST_SEASON } from "../engine/forecast";
import { buildTrueDemand } from "../engine/stock";
import { Meter } from "../components/charts";
import { Card, Chip, PageHeader } from "../components/ui";
import { fmtDate, fmtMoney, fmtPct } from "../lib/format";

const shortDate = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// SS27 calendar runs January to May.
const CAL_START = new Date("2027-01-01T00:00:00Z").getTime();
const CAL_END = new Date("2027-05-01T00:00:00Z").getTime();
const calPct = (iso: string) => ((new Date(iso + "T00:00:00Z").getTime() - CAL_START) / (CAL_END - CAL_START)) * 100;
const MONTHS = ["Jan", "Feb", "Mar", "Apr"];

export function Deliveries() {
  const { levers, buyPlan, setOpenLine } = useApp();
  const td = useMemo(() => buildTrueDemand(levers), [levers]);

  // Due this week: sold out already, or the brand's lead time says order now.
  const toPlace = td.filter(
    (t) =>
      t.reorder > 0 &&
      (t.fc.stockNow === 0 ||
        (t.fc.projectedSellOutWeek ?? 99) - t.fc.brand.topUpLeadWeeks - 1 <= t.fc.weeksTraded + 1),
  );

  // Re-order basket per restocking brand, against its carriage-paid minimum.
  const baskets = BRANDS.filter((b) => b.topUp).map((b) => {
    const perf = BRAND_PERFORMANCE[b.id];
    const lines = toPlace.filter((t) => t.fc.brand.id === b.id);
    const value = lines.reduce((a, t) => a + t.reorder * t.fc.line.cost, 0);
    // Top-up candidates: core lines that will finish the season with less
    // than a size run left — worth adding to reach carriage paid.
    const topUps = td
      .filter(
        (t) =>
          t.fc.brand.id === b.id &&
          t.fc.canTopUp &&
          t.reorder === 0 &&
          t.fc.onOrder === 0 &&
          t.fc.stockNow > 0 &&
          t.fc.projectedLeftover < b.sizeRun,
      )
      .map((t) => ({ t, units: b.sizeRun, cost: b.sizeRun * t.fc.line.cost }));
    return { brand: b, perf, lines, value, topUps };
  });

  const calendar = BRANDS.map((b) => {
    const plan = buyPlan.filter((x) => x.fc.brand.id === b.id);
    const units = plan.reduce((a, x) => a + x.recommended, 0);
    const cost = plan.reduce((a, x) => a + x.cost, 0);
    return {
      brand: b,
      drops: SS27_DROPS[b.id].map((d) => ({ ...d, units: Math.round(units * d.share), cost: cost * d.share })),
    };
  });
  const maxDropCost = Math.max(...calendar.flatMap((c) => c.drops.map((d) => d.cost)), 1);

  const scorecard = BRANDS.map((b) => {
    const fcs = LAST_SEASON.filter((f) => f.brand.id === b.id);
    const sold = fcs.reduce((a, f) => a + f.sold, 0);
    const supplied = fcs.reduce((a, f) => a + f.supplied, 0);
    return {
      brand: b,
      perf: BRAND_PERFORMANCE[b.id],
      sellThrough: supplied ? (sold / supplied) * 100 : 0,
      soldOut: fcs.filter((f) => f.soldOutWeek !== null).length,
      lines: fcs.length,
    };
  });

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Brands & deliveries"
        title="Deliveries"
        sub="what's on its way, what to re-order this week, when each brand's SS27 collection lands — and how each brand performs, in numbers rather than impressions."
      />

      <Card title="Incoming" subtitle="open re-orders by stage, plus the re-orders the engine says to place this week · kept current from brand confirmations and courier tracking in production">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--accent)" }}>
              To place this week
            </div>
            <div className="space-y-2">
              {toPlace.map((t) => (
                <button
                  key={t.fc.line.id}
                  type="button"
                  onClick={() => setOpenLine(t.fc.line.id)}
                  className="block w-full rounded-lg border p-2.5 text-left text-xs hover:opacity-80"
                  style={{ borderColor: "var(--accent)", background: "var(--surface-1)" }}
                >
                  <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    {t.reorder} × {t.fc.line.name}
                  </div>
                  <div style={{ color: "var(--text-muted)" }}>
                    {t.fc.brand.name} · lands in {t.fc.brand.topUpLeadWeeks} wks · {fmtMoney(t.reorder * t.fc.line.cost)}
                  </div>
                </button>
              ))}
              {toPlace.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>Nothing to place.</p>}
            </div>
          </div>
          {REORDER_STAGES.map((stage) => {
            const ros = REORDERS.filter((r) => r.stage === stage);
            return (
              <div key={stage}>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                  {REORDER_STAGE_LABEL[stage]}
                </div>
                <div className="space-y-2">
                  {ros.map((r) => {
                    const line = LINE_BY_ID[r.lineId];
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setOpenLine(r.lineId)}
                        className="block w-full rounded-lg border p-2.5 text-left text-xs hover:opacity-80"
                        style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
                      >
                        <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                          {r.ref} · {r.qty} × {line.name}
                        </div>
                        <div style={{ color: "var(--text-muted)" }}>
                          lands wk {r.landsWeek} · {shortDate(seasonWeekDate("AW26", r.landsWeek))}
                        </div>
                      </button>
                    );
                  })}
                  {ros.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>—</p>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        title="Re-orders vs carriage paid"
        subtitle="restocking brands deliver free above a minimum order — avoids paying carriage on a small re-order, and suggests what's worth adding to reach it"
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {baskets.map(({ brand, perf, lines, value, topUps }) => {
            const pct = perf.carriagePaidMin > 0 ? (value / perf.carriagePaidMin) * 100 : 100;
            const short = Math.max(0, perf.carriagePaidMin - value);
            return (
              <div key={brand.id} className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {brand.name}
                  </div>
                  <div className="tnum text-xs" style={{ color: "var(--text-secondary)" }}>
                    {fmtMoney(value)} / {fmtMoney(perf.carriagePaidMin)}
                  </div>
                </div>
                <div className="mt-2">
                  <Meter pct={Math.min(pct, 100)} />
                </div>
                <div className="mt-2 space-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {lines.length === 0 && <div style={{ color: "var(--text-muted)" }}>No re-order needed this week.</div>}
                  {lines.map((t) => (
                    <div key={t.fc.line.id}>
                      {t.reorder} × {t.fc.line.name}
                    </div>
                  ))}
                  {lines.length > 0 && short > 0 && (
                    <div className="pt-1 font-medium" style={{ color: "var(--text-primary)" }}>
                      {fmtMoney(short)} short of carriage paid
                      {short <= perf.carriagePaidMin * 0.25
                        ? ` — round the ${lines[0].fc.line.name} up by one size run (${brand.sizeRun}) instead; it's selling out anyway`
                        : topUps.length > 0
                          ? ` — add ${topUps.map((x) => `${x.units} × ${x.t.fc.line.name}`).join(", ")} (finishing the season with less than a size run)`
                          : " — worth paying the carriage rather than over-ordering"}
                    </div>
                  )}
                  {lines.length > 0 && short === 0 && (
                    <div className="pt-1" style={{ color: "var(--delta-up-good)" }}>
                      Carriage paid — no top-up needed
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title={`${NEXT_SEASON.id} delivery calendar`} subtitle="when each brand's collection lands, sized by value at cost from the buy plan">
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="relative ml-36 h-5 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {MONTHS.map((m, i) => (
                <span key={m} className="absolute" style={{ left: `${(i / MONTHS.length) * 100}%` }}>
                  {m} 2027
                </span>
              ))}
            </div>
            {calendar.map(({ brand, drops }) => (
              <div key={brand.id} className="flex items-center gap-3 py-2" style={{ borderTop: "1px solid var(--grid)" }}>
                <div className="shrink-0 text-xs font-medium" style={{ color: "var(--text-primary)", width: 132 }}>
                  {brand.name}
                </div>
                <div className="relative h-9 flex-1">
                  <div className="absolute top-1/2 h-px w-full" style={{ background: "var(--grid)" }} />
                  {drops.map((d) => {
                    const size = 10 + (d.cost / maxDropCost) * 18;
                    return (
                      <div
                        key={d.label}
                        className="absolute flex items-center gap-1.5"
                        style={{ left: `${calPct(d.date)}%`, top: "50%", transform: `translate(-${size / 2}px, -50%)` }}
                        title={`${d.label} · ${fmtDate(d.date)} · ${d.units} units · ${fmtMoney(d.cost)}`}
                      >
                        <span
                          aria-hidden
                          className="shrink-0 rounded-full"
                          style={{ width: size, height: size, background: "var(--series-1)", border: "2px solid var(--surface-1)" }}
                        />
                        <span className="whitespace-nowrap text-[10.5px] leading-tight" style={{ color: "var(--text-secondary)" }}>
                          {shortDate(d.date)} · {d.units} u
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Brand scorecard" subtitle="SS26 sell-through and sell-outs computed from sales; delivery performance over the last four seasons">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-xs">
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                {["Brand", "Sell-through", "Sold out early", "On time, in full", "Avg days late", "Delivered complete", "Restocks", "Notes"].map((h, i) => (
                  <th
                    key={h}
                    className={`border-b py-2 pr-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] ${i === 0 || i === 7 ? "text-left" : "text-right"}`}
                    style={{ borderColor: "var(--grid)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scorecard.map(({ brand, perf, sellThrough, soldOut, lines }) => (
                <tr key={brand.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                      {brand.name}
                    </div>
                    <div style={{ color: "var(--text-muted)" }}>{brand.focus}</div>
                  </td>
                  <td className="tnum pr-3 text-right text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {fmtPct(sellThrough)}
                  </td>
                  <td className="tnum pr-3 text-right text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {soldOut}
                    <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                      {" "}
                      / {lines}
                    </span>
                  </td>
                  <td
                    className="tnum pr-3 text-right text-[15px] font-semibold"
                    style={{ color: perf.otifPct < 80 ? "var(--status-critical)" : "var(--text-primary)" }}
                  >
                    {perf.otifPct}%
                  </td>
                  <td className="tnum pr-3 text-right text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {perf.avgDaysLate}
                  </td>
                  <td className="tnum pr-3 text-right text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {perf.completePct}%
                  </td>
                  <td className="pr-3 text-right">
                    {brand.topUp ? <Chip>{brand.topUpLeadWeeks} wks</Chip> : <span style={{ color: "var(--text-muted)" }}>no</span>}
                  </td>
                  <td className="pr-3" style={{ color: "var(--text-secondary)" }}>
                    {perf.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          Restocks and sell-outs together tell you where to buy deeper up front: a brand that sells out and can't restock needs the
          bigger opening order. Delivery dates come into the order timeline and the late-delivery scenario.
        </p>
      </Card>
    </div>
  );
}
