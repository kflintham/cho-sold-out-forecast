import { useMemo } from "react";
import { useApp } from "../state/AppState";
import { LINE_BY_ID, NEXT_SEASON, seasonWeekDate } from "../data/dataset";
import { LAST_SEASON, SHAPES, shareBy, seasonTotals, type LineForecast } from "../engine/forecast";
import { SeasonChart } from "../components/SeasonChart";
import { Card, Chip, PageHeader, SeverityIcon, Toggle } from "../components/ui";
import { fmtDate, fmtInt, fmtMoney } from "../lib/format";

const CONF_LABEL = { high: "High", medium: "Medium", low: "Low" } as const;

function Step({ k, v, sub, accent = false }: { k: string; v: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className="min-w-0 flex-1 rounded-xl border px-3 py-2.5"
      style={{
        borderColor: accent ? "var(--accent)" : "var(--border)",
        background: "var(--surface-1)",
      }}
    >
      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        {k}
      </div>
      <div className="disp tnum mt-0.5 text-[20px] font-semibold leading-7" style={{ color: "var(--text-primary)" }}>
        {v}
      </div>
      {sub && (
        <div className="text-[11px] leading-snug" style={{ color: "var(--text-secondary)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

const Arrow = () => (
  <div aria-hidden className="hidden shrink-0 items-center md:flex" style={{ color: "var(--text-muted)" }}>
    →
  </div>
);

/** In-stock share of the season as a small bar — the visual "sold out in week 4 of 16". */
export function SeasonBar({ fc }: { fc: LineForecast }) {
  const out = fc.soldOutWeek;
  const pct = out === null ? 100 : ((out - 0.5) / fc.seasonWeeks) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-20 overflow-hidden rounded-full" style={{ background: "var(--meter-track)" }} aria-hidden>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--series-1)" }} />
      </div>
      <span className="tnum whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
        {out === null ? "never" : `wk ${out} of ${fc.seasonWeeks}`}
      </span>
    </div>
  );
}

export function SoldOut() {
  const { levers, setLevers, buyById, focusLine, setFocusLine, setOpenLine } = useApp();
  const totals = seasonTotals("SS26");

  const soldOut = useMemo(
    () => LAST_SEASON.filter((f) => f.soldOutWeek !== null).sort((a, b) => b.lostRevenue - a.lostRevenue),
    [],
  );
  const fc = soldOut.find((f) => f.line.id === focusLine) ?? soldOut[0];
  const buy = buyById.get(fc.line.id)!;
  const shape = SHAPES[fc.brand.id];
  const lastInStock = fc.inStockWeeks.length > 0 ? fc.inStockWeeks[fc.inStockWeeks.length - 1] + 1 : 0;
  const contiguous = fc.inStockWeeks.length === lastInStock; // in stock every week up to then
  const soldInStock = fc.inStockWeeks.reduce((a, w) => a + fc.line.sales[w], 0);
  const shareInStock = fc.inStockWeeks.reduce((a, w) => a + fc.curve[w], 0);
  const sisterNames = shape.sisterIds.map((id) => LINE_BY_ID[id].name);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="The sold-out forecast"
        title="What a sell-out cost — and what to buy next time"
        sub="Till data only records what you sold. Once a line sells out, the customers who came in for it after that never show up in any report — so next season's order is built on the stock you happened to have, not the demand you had."
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <SeverityIcon severity={levers.countLostDemand ? "good" : "critical"} size={18} />
            <div>
              <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {levers.countLostDemand
                  ? `${totals.soldOut} of ${totals.lines} lines sold out before the end of SS26 — about ${fmtInt(totals.lostUnits)} customers missed out, ${fmtMoney(totals.lostRevenue)} at full price`
                  : "This is what the till sees: every sold-out line looks like it sold exactly what you bought"}
              </div>
              <p className="mt-0.5 max-w-2xl text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {levers.countLostDemand
                  ? "The missed demand is counted in next season's buy. Switch it off to see the order you'd place from sales alone."
                  : `${fmtInt(totals.lostUnits)} customers who wanted a line after it sold out (${fmtMoney(totals.lostRevenue)} at full price) have vanished — and next season's order shrinks to match.`}
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2.5 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Count the demand a sell-out hides
            <Toggle
              checked={levers.countLostDemand}
              onChange={(v) => setLevers({ countLostDemand: v })}
              label="Count the demand a sell-out hides"
            />
          </label>
        </div>
      </Card>

      <Card
        title={`${fc.line.name} · ${fc.brand.name}`}
        subtitle={`SS26 · ${fc.seasonWeeks}-week full-price season from ${fmtDate(seasonWeekDate("SS26", 1))} · ${fc.brand.topUp && fc.line.core ? `${fc.source} ${fc.brand.ownLabel ? "can repeat" : "restocks"} this line in ${fc.leadWeeks} weeks` : `${fc.brand.name} had no stock to top up`}`}
        actions={
          <select
            aria-label="Choose a sold-out line"
            className="max-w-[48vw] rounded-lg border px-2 py-1.5 text-xs"
            style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
            value={fc.line.id}
            onChange={(e) => setFocusLine(e.target.value)}
          >
            {soldOut.map((f) => (
              <option key={f.line.id} value={f.line.id}>
                {f.line.name} — sold out wk {f.soldOutWeek}/{f.seasonWeeks}
              </option>
            ))}
          </select>
        }
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
          <Step k="You bought" v={fmtInt(fc.line.bought)} sub={fc.line.topUps.length ? `+${fc.line.topUps[0].qty} top-up in wk ${fc.line.topUps[0].week}` : "one order, no top-up"} />
          <Arrow />
          <Step
            k="Sold out"
            v={`Week ${fc.soldOutWeek} of ${fc.seasonWeeks}`}
            sub={`${fmtInt(fc.weeksOutOfStock)} weeks of the season with nothing to sell`}
          />
          <Arrow />
          <Step
            k="Customers who wanted it"
            v={levers.countLostDemand ? `≈ ${fmtInt(fc.demand)}` : fmtInt(fc.sold)}
            sub={levers.countLostDemand ? `likely range ${fmtInt(fc.demandLow)}–${fmtInt(fc.demandHigh)}` : "sales only — the till's view"}
          />
          <Arrow />
          <Step
            k={`${NEXT_SEASON.id}: buy`}
            v={fmtInt(buy.recommended)}
            sub={`your usual rule: ${fmtInt(buy.usualRule)}${buy.capped ? ` · capped at ×${levers.maxStepUp}` : ""}`}
            accent
          />
        </div>

        <div className="mt-4">
          <SeasonChart fc={fc} showMissed={levers.countLostDemand} />
        </div>

        <details className="mt-3" open>
          <summary className="cursor-pointer text-xs font-medium" style={{ color: "var(--accent)" }}>
            How we got to {fmtInt(fc.demand)}
          </summary>
          <ol
            className="mt-2 max-w-3xl list-decimal space-y-1.5 rounded-lg border-l-2 py-1 pl-7 text-xs leading-relaxed"
            style={{ borderColor: "var(--baseline)", color: "var(--text-secondary)" }}
          >
            <li>
              <b style={{ color: "var(--text-primary)" }}>Learn the season's shape</b> from {fc.brand.name} lines that never
              sold out ({sisterNames.join(", ")}). By the end of week {lastInStock}, they'd done{" "}
              <b>{Math.round(shareBy(fc.curve, lastInStock) * 100)}%</b> of their season's sales.
            </li>
            <li>
              <b style={{ color: "var(--text-primary)" }}>Read only the weeks it was fully in stock.</b>{" "}
              {contiguous
                ? `${fc.line.name} sold ${soldInStock} in weeks 1–${lastInStock}. Week ${fc.soldOutWeek} ended on an empty shelf, so it only tells us demand was at least what sold.`
                : `${fc.line.name} sold ${soldInStock} across the ${fc.inStockWeeks.length} weeks it ended with stock on the shelf — ${Math.round(shareInStock * 100)}% of a normal season's sales. Weeks that ended empty (including after the top-up ran out) are left out.`}
            </li>
            <li>
              <b style={{ color: "var(--text-primary)" }}>Scale up:</b> {soldInStock} ÷ {Math.round(shareInStock * 100)}% ≈{" "}
              <b>{fmtInt(fc.demand)} customers</b> over the season. Using each sister line's shape on its own gives{" "}
              {fmtInt(fc.demandLow)}–{fmtInt(fc.demandHigh)}. Confidence: {CONF_LABEL[fc.confidence].toLowerCase()}.
            </li>
            <li>
              <b style={{ color: "var(--text-primary)" }}>Next season's buy:</b> {fc.sold} sold + {levers.lostDemandShare}% of the{" "}
              {fmtInt(Math.max(0, fc.demand - fc.sold))} missed (some will have bought something else){" "}
              {levers.applyTrend && fc.brand.trend !== 0 ? `× ${fc.brand.name} momentum ${fc.brand.trend > 0 ? "+" : ""}${Math.round(fc.brand.trend * 100)}% ` : ""}÷{" "}
              {levers.targetSellThrough}% planned sell-through = {fmtInt(buy.target)}
              {buy.capped ? `, capped at ×${levers.maxStepUp} last season's buy` : ""}
              {levers.roundToSizeRun && fc.brand.sizeRun > 1 ? `, in ${fc.brand.sizeRun}-piece size runs (${fc.brand.sizes})` : ""} →{" "}
              <b>{fmtInt(buy.recommended)}</b>.
            </li>
          </ol>
        </details>
      </Card>

      <Card
        title="Every line that sold out early in SS26"
        subtitle="sorted by full-price sales missed · click a row to see its season"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-xs">
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                {["Line", "Bought", "Sold out", "Est. demand", "Missed", "Missed £", "Confidence", `${NEXT_SEASON.id} usual`, `${NEXT_SEASON.id} plan`].map((h, i) => (
                  <th
                    key={h}
                    className={`border-b py-2 pr-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] ${i === 0 || i === 2 || i === 6 ? "text-left" : "text-right"}`}
                    style={{ borderColor: "var(--grid)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {soldOut.map((f) => {
                const b = buyById.get(f.line.id)!;
                const active = f.line.id === fc.line.id;
                return (
                  <tr
                    key={f.line.id}
                    onClick={() => {
                      setFocusLine(f.line.id);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="cursor-pointer hover:opacity-80"
                    style={{ borderBottom: "1px solid var(--grid)", background: active ? "var(--surface-2)" : undefined }}
                  >
                    <td className="py-2 pr-3">
                      <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                        {f.line.name}
                      </div>
                      <div style={{ color: "var(--text-muted)" }}>
                        {f.brand.name} · {f.line.code}
                      </div>
                    </td>
                    <td className="tnum pr-3 text-right" style={{ color: "var(--text-primary)" }}>
                      {f.line.bought}
                      {f.line.topUps.length > 0 && (
                        <span style={{ color: "var(--text-muted)" }}> +{f.line.topUps[0].qty}</span>
                      )}
                    </td>
                    <td className="pr-3">
                      <SeasonBar fc={f} />
                    </td>
                    <td className="tnum pr-3 text-right" style={{ color: "var(--text-primary)" }}>
                      {levers.countLostDemand ? `≈ ${fmtInt(f.demand)}` : fmtInt(f.sold)}
                    </td>
                    <td className="tnum pr-3 text-right font-semibold" style={{ color: "var(--text-primary)" }}>
                      {levers.countLostDemand ? fmtInt(f.lostUnits) : "—"}
                    </td>
                    <td className="tnum pr-3 text-right" style={{ color: "var(--text-primary)" }}>
                      {levers.countLostDemand ? fmtMoney(f.lostRevenue) : "—"}
                    </td>
                    <td className="pr-3" style={{ color: "var(--text-secondary)" }}>
                      {CONF_LABEL[f.confidence]}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          Usual rule = last season's buy +{levers.usualRulePct}% when a line sold out. Want the detail on any line?{" "}
          <button type="button" className="font-medium" style={{ color: "var(--accent)" }} onClick={() => setOpenLine(fc.line.id)}>
            Open {fc.line.name}
          </button>
        </p>
      </Card>
    </div>
  );
}
