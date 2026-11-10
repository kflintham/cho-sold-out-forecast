import { useMemo } from "react";
import { useApp } from "../state/AppState";
import { BRANDS, NEXT_SEASON, TODAY } from "../data/dataset";
import { Meter } from "../components/charts";
import { Card, Chip, PageHeader, StatTile } from "../components/ui";
import { SeasonBar } from "./SoldOut";
import { fmtDate, fmtInt, fmtMoney, fmtPct } from "../lib/format";

const daysUntil = (iso: string) =>
  Math.round((new Date(iso + "T00:00:00Z").getTime() - TODAY.getTime()) / 86400000);

function Change({ from, to }: { from: number; to: number }) {
  const d = to - from;
  if (d === 0) return <span style={{ color: "var(--text-muted)" }}>same</span>;
  return (
    <span className="tnum font-semibold" style={{ color: d > 0 ? "var(--delta-up-good)" : "var(--status-serious)" }}>
      {d > 0 ? "▲" : "▼"} {Math.abs(d)}
    </span>
  );
}

export function BuyPlan() {
  const { buyPlan, levers, setOpenLine } = useApp();

  const total = buyPlan.reduce((a, b) => a + b.cost, 0);
  const usual = buyPlan.reduce((a, b) => a + b.usualCost, 0);
  const stepped = buyPlan.filter((b) => b.recommended > b.usualRule);
  const trimmed = buyPlan.filter((b) => b.recommended < b.usualRule);
  const addedCost = stepped.reduce((a, b) => a + (b.recommended - b.usualRule) * b.fc.line.cost, 0);
  const trimmedCost = trimmed.reduce((a, b) => a + (b.usualRule - b.recommended) * b.fc.line.cost, 0);
  const extraRevenue = stepped.reduce(
    (a, b) => a + Math.min(b.recommended - b.usualRule, Math.max(0, b.fc.demand - b.usualRule)) * b.fc.line.rrp,
    0,
  );

  const byBrand = useMemo(
    () =>
      [...BRANDS]
        .sort((a, b) => a.orderDeadline.localeCompare(b.orderDeadline))
        .map((brand) => {
          const lines = buyPlan
            .filter((b) => b.fc.brand.id === brand.id)
            .sort((a, b) => b.recommended - b.usualRule - (a.recommended - a.usualRule));
          return {
            brand,
            lines,
            cost: lines.reduce((a, b) => a + b.cost, 0),
            usual: lines.reduce((a, b) => a + b.usualCost, 0),
            units: lines.reduce((a, b) => a + b.recommended, 0),
          };
        }),
    [buyPlan],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={`${NEXT_SEASON.label} · built from SS26`}
        title={`${NEXT_SEASON.id} buy plan`}
        sub="Every line from last spring, re-bought on what customers wanted rather than what you happened to have. Lines that sold out step up; lines that didn't sell through come down — so the extra spend on winners is partly paid for by trimming the slow ones."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={`${NEXT_SEASON.id} plan, at cost`} value={fmtMoney(total)} sub={`your usual rule: ${fmtMoney(usual)}`} />
        <StatTile
          label="Into lines that sold out"
          value={`+${fmtMoney(addedCost)}`}
          sub={`${stepped.length} lines stepped up`}
        />
        <StatTile
          label="Out of slow lines"
          value={`−${fmtMoney(trimmedCost)}`}
          sub={`${trimmed.length} lines trimmed to what sold`}
        />
        <StatTile
          label="Extra full-price sales in reach"
          value={fmtMoney(extraRevenue)}
          sub="the step-ups that last season's demand already covers"
        />
      </div>

      <Card title="Open-to-buy" subtitle={`plan against the ${fmtMoney(levers.budget)} SS27 budget, at cost · adjust in Levers`}>
        <Meter pct={(total / levers.budget) * 100}>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span>
              <b className="tnum" style={{ color: "var(--text-primary)" }}>
                {fmtMoney(total)}
              </b>{" "}
              planned · {fmtPct((total / levers.budget) * 100)} of budget
            </span>
            <span>
              {total <= levers.budget
                ? `${fmtMoney(levers.budget - total)} headroom`
                : `${fmtMoney(total - levers.budget)} over — lower the step-up cap or the share of missed demand you back`}
            </span>
          </div>
        </Meter>
      </Card>

      {byBrand.map(({ brand, lines, cost, usual: brandUsual, units }) => {
        const days = daysUntil(brand.orderDeadline);
        return (
          <Card
            key={brand.id}
            title={`${brand.name} · ${brand.focus}`}
            subtitle={`${fmtInt(units)} units · ${fmtMoney(cost)} at cost (usual rule ${fmtMoney(brandUsual)}) · ${brand.seasonWeeks}-week season · size run ${brand.sizeRun > 1 ? `${brand.sizeRun} (${brand.sizes})` : brand.sizes}`}
            actions={
              <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                <Chip tone={days <= 14 ? "accent" : "neutral"}>
                  order book closes {fmtDate(brand.orderDeadline)} · {days} days
                </Chip>
                <Chip>{brand.topUp ? `restocks core lines · ${brand.topUpLeadWeeks} wks` : "no in-season restock"}</Chip>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-xs">
                <thead>
                  <tr style={{ color: "var(--text-muted)" }}>
                    {["SS26 line", "Bought", "Sold", "Sell-through", "Sold out", "Est. demand", "Usual rule", "Plan", "vs usual", "Plan £"].map((h, i) => (
                      <th
                        key={h}
                        className={`border-b py-2 pr-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] ${i === 0 || i === 4 ? "text-left" : "text-right"}`}
                        style={{ borderColor: "var(--grid)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((b) => {
                    const f = b.fc;
                    return (
                      <tr
                        key={f.line.id}
                        onClick={() => setOpenLine(f.line.id)}
                        className="cursor-pointer hover:opacity-80"
                        style={{ borderBottom: "1px solid var(--grid)" }}
                      >
                        <td className="py-2 pr-3">
                          <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                            {f.line.name}
                          </div>
                          <div style={{ color: "var(--text-muted)" }}>
                            {f.line.code} · {f.line.category}
                          </div>
                        </td>
                        <td className="tnum pr-3 text-right" style={{ color: "var(--text-secondary)" }}>
                          {f.line.bought}
                          {f.line.topUps.length > 0 && <span style={{ color: "var(--text-muted)" }}> +{f.line.topUps[0].qty}</span>}
                        </td>
                        <td className="tnum pr-3 text-right" style={{ color: "var(--text-primary)" }}>
                          {f.sold}
                        </td>
                        <td className="tnum pr-3 text-right" style={{ color: "var(--text-primary)" }}>
                          {fmtPct((f.sold / f.supplied) * 100)}
                        </td>
                        <td className="pr-3">
                          <SeasonBar fc={f} />
                        </td>
                        <td className="tnum pr-3 text-right" style={{ color: "var(--text-primary)" }}>
                          {f.soldOutWeek !== null && levers.countLostDemand ? `≈ ${fmtInt(f.demand)}` : fmtInt(f.sold)}
                        </td>
                        <td className="tnum pr-3 text-right" style={{ color: "var(--text-secondary)" }}>
                          {fmtInt(b.usualRule)}
                        </td>
                        <td className="pr-3 text-right">
                          <span className="inline-flex items-center gap-1.5">
                            {b.capped && <Chip tone="accent">capped</Chip>}
                            <span className="tnum font-semibold" style={{ color: "var(--text-primary)" }}>
                              {fmtInt(b.recommended)}
                            </span>
                          </span>
                        </td>
                        <td className="pr-3 text-right">
                          <Change from={b.usualRule} to={b.recommended} />
                        </td>
                        <td className="tnum text-right" style={{ color: "var(--text-primary)" }}>
                          {fmtMoney(b.cost)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}

      <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        SS27 styles won't be identical to SS26 — in production each new style is matched to the SS26 line it replaces
        (same brand, category and price point), and the plan reads that line's demand. Plan = sold + {levers.lostDemandShare}% of
        missed demand{levers.applyTrend ? ", × brand momentum" : ""}, ÷ {levers.targetSellThrough}% planned sell-through
        {levers.maxStepUp > 0 ? `, capped at ×${levers.maxStepUp} last buy` : ""}
        {levers.roundToSizeRun ? ", rounded to size runs" : ""}.
      </p>
    </div>
  );
}
