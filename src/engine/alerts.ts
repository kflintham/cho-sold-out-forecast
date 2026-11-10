/**
 * In-season advisories: plain-English calls on this season's lines, with the
 * working shown. Every figure comes out of the forecast engine.
 */

import { seasonWeekDate } from "../data/dataset";
import { THIS_SEASON, shareBy, type LineForecast } from "./forecast";

export type Severity = "critical" | "serious" | "warning" | "good" | "info";

export type AlertKind = "sold-out-no-restock" | "reorder-now" | "reorder-soon" | "hold-price" | "slow" | "on-track";

export interface Alert {
  id: string;
  kind: AlertKind;
  severity: Severity;
  title: string;
  /** the advice, in plain English */
  detail: string;
  /** the working — where the numbers came from */
  working: string;
  lineIds: string[];
  /** full-price revenue the alert is protecting (or already lost), £ */
  valueAtStake: number;
}

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
const n0 = (n: number) => Math.round(n).toLocaleString("en-GB");
const day = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, serious: 1, warning: 2, info: 3, good: 4 };

/** Units a re-order placed this week would sell before season end. */
export function reorderUnits(fc: LineForecast): { units: number; landsWeek: number } {
  const landsWeek = fc.weeksTraded + 1 + fc.brand.topUpLeadWeeks;
  const before = fc.demand * (shareBy(fc.curve, landsWeek - 1) - shareBy(fc.curve, fc.weeksTraded));
  const stockAtLanding = Math.max(0, fc.stockNow - before);
  const after = fc.demand * (1 - shareBy(fc.curve, landsWeek - 1));
  const need = Math.max(0, after - stockAtLanding);
  const run = fc.brand.sizeRun;
  return { units: need > 0 ? Math.max(run, Math.round(need / run) * run) : 0, landsWeek };
}

function inSeasonAlert(fc: LineForecast): Alert {
  const l = fc.line;
  const b = fc.brand;
  const base = { id: l.id, lineIds: [l.id] };
  const pace = `${b.name} lines that stayed in stock last spring had done ${Math.round(shareBy(fc.curve, fc.weeksTraded) * 100)}% of their season by week ${fc.weeksTraded}`;
  const toCome = Math.max(0, fc.lostUnitsSeason - fc.lostUnits);

  if (fc.stockNow === 0) {
    return {
      ...base,
      kind: "sold-out-no-restock",
      severity: "critical",
      title: `${l.name} sold out in week ${fc.soldOutWeek} of ${fc.seasonWeeks} — ${b.name} can't restock`,
      detail: `All ${l.bought} gone by ${day(seasonWeekDate(l.season, fc.soldOutWeek!))}. About ${n0(fc.lostUnits)} customers have already missed it, and another ${n0(toCome)} are expected before the season ends — ${gbp(fc.lostUnitsSeason * l.rrp)} of full-price sales in all. It's logged against next year's buy, so the order isn't based on the ${l.bought} you happened to have.`,
      working: `Sold ${l.bought} in ${fc.inStockWeeks.length} full in-stock weeks. ${pace}, so the line is tracking ≈${n0(fc.demand)} customers for the season (range ${n0(fc.demandLow)}–${n0(fc.demandHigh)}). Missed so far ≈ ${n0(fc.demandToDate)} − ${fc.sold} = ${n0(fc.lostUnits)}.`,
      valueAtStake: fc.lostUnitsSeason * l.rrp,
    };
  }

  const out = fc.projectedSellOutWeek;
  if (out !== null) {
    if (fc.canTopUp) {
      const { units, landsWeek } = reorderUnits(fc);
      const orderBy = out - b.topUpLeadWeeks - 1;
      const urgent = orderBy <= fc.weeksTraded + 1;
      return {
        ...base,
        kind: urgent ? "reorder-now" : "reorder-soon",
        severity: urgent ? "serious" : "warning",
        title: urgent
          ? `Re-order ${units} × ${l.name} from ${b.name} this week`
          : `${l.name}: re-order by week ${orderBy} to stay in stock`,
        detail: urgent
          ? `${fc.stockNow} left, selling out around week ${out} of ${fc.seasonWeeks}. ${b.name} restocks this line in ${b.topUpLeadWeeks} weeks — order now and ${units} more land in week ${landsWeek}, in time to sell before the season ends.`
          : `${fc.stockNow} left, on course to sell out around week ${out}. With ${b.name}'s ${b.topUpLeadWeeks}-week lead time, the order needs to go in by week ${orderBy} (${day(seasonWeekDate(l.season, orderBy))}).`,
        working: `${pace}; at that pace the line is heading for ≈${n0(fc.demand)} sales this season against ${l.bought} bought. Re-order = demand still to come after week ${landsWeek - 1}, less stock left when it lands, rounded to ${b.sizeRun > 1 ? `${b.sizeRun}-piece size runs (${b.sizes})` : "units"}.`,
        valueAtStake: units * l.rrp,
      };
    }
    return {
      ...base,
      kind: "hold-price",
      severity: "warning",
      title: `${l.name}: keep it at full price — it'll sell out around week ${out}`,
      detail: `${fc.stockNow} left and ${b.name} can't restock. Leave it out of any promotion: it will clear at full price on its own. About ${n0(fc.lostUnitsSeason)} customers will miss it after it sells out — logged for next year's buy.`,
      working: `${pace}; at that pace it's tracking ≈${n0(fc.demand)} customers this season against ${l.bought} bought.`,
      valueAtStake: fc.stockNow * l.rrp * 0.3,
    };
  }

  const supplied = fc.supplied;
  if (fc.projectedLeftover > supplied * 0.3) {
    const markdownWeek = Math.min(fc.seasonWeeks, fc.weeksTraded + 3);
    return {
      ...base,
      kind: "slow",
      severity: "warning",
      title: `${l.name}: ~${n0(fc.projectedLeftover)} left at season end — move it early`,
      detail: `Selling slower than the rest of ${b.name}. Feature it in store and online now, and plan a markdown from week ${markdownWeek} rather than waiting for the sale — the cash is better spent on the lines that are selling out.`,
      working: `${fc.sold} sold in ${fc.weeksTraded} weeks. ${pace}, so the season is tracking ≈${n0(fc.demand)} against ${supplied} in stock.`,
      valueAtStake: fc.projectedLeftover * l.cost,
    };
  }

  return {
    ...base,
    kind: "on-track",
    severity: "good",
    title: `${l.name}: on track — no action`,
    detail: `${fc.stockNow} left, tracking to finish the season with about ${n0(fc.projectedLeftover)} remaining.`,
    working: `${pace}; tracking ≈${n0(fc.demand)} for the season against ${supplied} in stock.`,
    valueAtStake: 0,
  };
}

export function buildAlerts(): Alert[] {
  return THIS_SEASON.map(inSeasonAlert).sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.valueAtStake - a.valueAtStake,
  );
}

export const ALERTS = buildAlerts();
