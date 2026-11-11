/**
 * The advisory layer: plain-English calls with the working shown. Every
 * figure comes out of the forecast engine and the stock views.
 */

import { BRANDS, LOCATIONS, TODAY, WAITLIST, seasonWeekDate, type LocationId } from "../data/dataset";
import { THIS_SEASON, shareBy, type BuyLine, type LineForecast } from "./forecast";
import { reorderUnits, stockItems, suggestTransfers } from "./stock";
import type { Levers } from "./levers";

export type Severity = "critical" | "serious" | "warning" | "good" | "info";

export type AlertKind =
  | "sold-out-no-restock"
  | "reorder-now"
  | "reorder-soon"
  | "covered"
  | "transfer"
  | "hold-price"
  | "slow"
  | "aged"
  | "deadline"
  | "on-track";

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
const locName = (id: LocationId) => (id === "online" ? "web stockroom" : LOCATIONS.find((l) => l.id === id)!.name.toLowerCase());

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, serious: 1, warning: 2, info: 3, good: 4 };

/** An in-stock line a waiting customer could be pointed to instead. */
function alternativeFor(fc: LineForecast): LineForecast | undefined {
  const inStock = THIS_SEASON.filter((f) => f.line.id !== fc.line.id && f.stockNow > 2 && f.line.category === fc.line.category);
  return inStock.find((f) => f.brand.id === fc.brand.id) ?? inStock.sort((a, b) => b.stockNow - a.stockNow)[0];
}

function waitingText(fc: LineForecast): string {
  const w = WAITLIST[fc.line.id];
  if (!w) return "";
  return `${w.online + w.inStore} customers have asked to be told when it's back (${w.online} online, ${w.inStore} in the shops)`;
}

function inSeasonAlert(fc: LineForecast, levers: Levers): Alert {
  const l = fc.line;
  const b = fc.brand;
  const base = { id: l.id, lineIds: [l.id] };
  const pace = `${b.name} lines that stayed in stock last spring had done ${Math.round(shareBy(fc.curve, fc.weeksTraded) * 100)}% of their season by week ${fc.weeksTraded}`;
  const toCome = Math.max(0, fc.lostUnitsSeason - fc.lostUnits);

  if (fc.stockNow === 0 && !fc.canTopUp) {
    const alt = alternativeFor(fc);
    const waiting = waitingText(fc);
    return {
      ...base,
      kind: "sold-out-no-restock",
      severity: "critical",
      title: `${l.name} sold out in week ${fc.soldOutWeek} of ${fc.seasonWeeks} — ${b.name} can't restock`,
      detail: `All ${l.bought} gone by ${day(seasonWeekDate(l.season, fc.soldOutWeek!))}. About ${n0(fc.lostUnits)} customers have already missed it, and another ${n0(toCome)} are expected before the season ends — ${gbp(fc.lostUnitsSeason * l.rrp)} of full-price sales in all. It's logged against next year's buy.${waiting ? ` ${waiting}${alt ? ` — offer them the ${alt.line.name} (${alt.stockNow} in stock)` : ""}.` : ""}`,
      working: `Sold ${l.bought} in ${fc.inStockWeeks.length} full in-stock weeks. ${pace}, so the line is tracking ≈${n0(fc.demand)} customers for the season (range ${n0(fc.demandLow)}–${n0(fc.demandHigh)}). Missed so far ≈ ${n0(fc.demandToDate)} − ${fc.sold} = ${n0(fc.lostUnits)}.`,
      valueAtStake: fc.lostUnitsSeason * l.rrp,
    };
  }

  // Already on its way: the open re-order covers a gap that would otherwise open up.
  if (
    fc.onOrder > 0 &&
    fc.projectedSellOutWeekNoReorder !== null &&
    (fc.projectedSellOutWeek === null || fc.projectedSellOutWeek > fc.projectedSellOutWeekNoReorder + 2)
  ) {
    return {
      ...base,
      kind: "covered",
      severity: "good",
      title: `${l.name}: would sell out in week ${fc.projectedSellOutWeekNoReorder} — already covered, don't re-order`,
      detail: `${fc.stockNow} left. The ${fc.onOrder} on the open re-order land in week ${fc.onOrderLandsWeek}, before the shelf empties. Ordering again now would double up.`,
      working: `${pace}; tracking ≈${n0(fc.demand)} for the season. Without the re-order, stock runs out in week ${fc.projectedSellOutWeekNoReorder}; with it, ${fc.projectedSellOutWeek ? `week ${fc.projectedSellOutWeek}` : "it lasts the season"}.`,
      valueAtStake: 0,
    };
  }

  if (fc.stockNow === 0) {
    // Sold out, but the brand restocks it: get stock back for the rest of the season.
    const { units, landsWeek } = reorderUnits(fc, levers);
    const waiting = waitingText(fc);
    return {
      ...base,
      kind: "reorder-now",
      severity: "serious",
      title: `${l.name} sold out in week ${fc.soldOutWeek} — re-order ${units} from ${b.name} now`,
      detail: `${b.name} restocks this line in ${b.topUpLeadWeeks} weeks, so ${units} more can land in week ${landsWeek} with ${fc.seasonWeeks - landsWeek + 1} weeks of the season still to sell.${waiting ? ` ${waiting} — tell them the date.` : ""}`,
      working: `${pace}; at that pace the line is heading for ≈${n0(fc.demand)} sales this season against ${l.bought} bought. Re-order = demand still to come after week ${landsWeek - 1}${levers.countWaiting ? ", plus customers waiting" : ""}, rounded to ${b.sizeRun > 1 ? `${b.sizeRun}-piece size runs (${b.sizes})` : "units"}.`,
      valueAtStake: units * l.rrp,
    };
  }

  const out = fc.projectedSellOutWeek;
  if (out !== null) {
    if (fc.canTopUp) {
      const { units, landsWeek } = reorderUnits(fc, levers);
      const orderBy = out - b.topUpLeadWeeks - 1;
      const urgent = orderBy <= fc.weeksTraded + 1;
      const waiting = levers.countWaiting && fc.waiting > 0 ? ` That includes ${fc.waiting} customers already waiting.` : "";
      return {
        ...base,
        kind: urgent ? "reorder-now" : "reorder-soon",
        severity: urgent ? "serious" : "warning",
        title: urgent
          ? `Re-order ${units} × ${l.name} from ${b.name} this week`
          : `${l.name}: re-order by week ${orderBy} to stay in stock`,
        detail: urgent
          ? `${fc.stockNow} left, selling out around week ${out} of ${fc.seasonWeeks}. ${b.name} restocks this line in ${b.topUpLeadWeeks} weeks — order now and ${units} more land in week ${landsWeek}, in time to sell before the season ends.${waiting}`
          : `${fc.stockNow} left, on course to sell out around week ${out}. With ${b.name}'s ${b.topUpLeadWeeks}-week lead time, the order needs to go in by week ${orderBy} (${day(seasonWeekDate(l.season, orderBy))}).`,
        working: `${pace}; at that pace the line is heading for ≈${n0(fc.demand)} sales this season against ${l.bought} bought. Re-order = demand still to come after week ${landsWeek - 1}, less stock left when it lands${levers.countWaiting ? ", plus customers waiting" : ""}, rounded to ${b.sizeRun > 1 ? `${b.sizeRun}-piece size runs (${b.sizes})` : "units"}.`,
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

function transferAlerts(): Alert[] {
  return suggestTransfers().map((t) => {
    const l = t.fc.line;
    const s = l.stockByLoc;
    return {
      id: `transfer-${l.id}`,
      kind: "transfer",
      severity: "warning",
      title: `Move ${t.units} × ${l.name} from the ${locName(t.from)} to the ${locName(t.to)}`,
      detail: `The ${locName(t.to)} sells ${Math.round(l.locShare[t.to] * 100)}% of this line but has ${s[t.to]} left; the ${locName(t.from)} has ${s[t.from]} and sells ${Math.round(l.locShare[t.from] * 100)}%. A transfer this week keeps it on sale where customers want it — before anyone re-orders.`,
      working: `Stock now: ${LOCATIONS.map((x) => `${x.short} ${s[x.id]}`).join(", ")}. Demand still to come this season ≈ ${n0(t.fc.demand * (1 - shareBy(t.fc.curve, t.fc.weeksTraded)))}, split by each location's share of the line's sales. Move = the smaller of the shortfall at one and the surplus at the other.`,
      lineIds: [l.id],
      valueAtStake: t.units * l.rrp,
    };
  });
}

function agedAlert(levers: Levers): Alert[] {
  const aged = stockItems(levers).filter((s) => s.band === "aged");
  if (aged.length === 0) return [];
  const units = aged.reduce((a, s) => a + s.units, 0);
  const cost = aged.reduce((a, s) => a + s.units * s.cost, 0);
  const oldest = [...aged].sort((a, b) => b.ageDays - a.ageDays)[0];
  return [
    {
      id: "aged",
      kind: "aged",
      severity: "warning",
      title: `${units} pieces older than ${levers.agedDays} days — ${gbp(cost)} at cost tied up`,
      detail: `${aged.length} lines from past seasons are still on hand, the oldest the ${oldest.name} (${oldest.ageDays} days). Clear them online first, then the sale rail — every pound back is SS27 open-to-buy. Routes are on the Overview under Clearance.`,
      working: aged.map((s) => `${s.name} (${s.season}) ${s.units} × ${gbp(s.cost)}`).join(" · "),
      lineIds: aged.filter((s) => s.lineId).map((s) => s.lineId!),
      valueAtStake: cost,
    },
  ];
}

function deadlineAlerts(buyPlan: BuyLine[]): Alert[] {
  return BRANDS.map((b) => {
    const days = Math.round((new Date(b.orderDeadline + "T00:00:00Z").getTime() - TODAY.getTime()) / 86400000);
    if (days > 21) return null;
    const lines = buyPlan.filter((x) => x.fc.brand.id === b.id);
    const units = lines.reduce((a, x) => a + x.recommended, 0);
    const cost = lines.reduce((a, x) => a + x.cost, 0);
    const up = lines.filter((x) => x.recommended > x.usualRule);
    const alert: Alert = {
      id: `deadline-${b.id}`,
      kind: "deadline",
      severity: days <= 10 ? "serious" : "warning",
      title: `${b.name} order book closes ${day(b.orderDeadline)} — ${days} days`,
      detail: `The SS27 plan is ready: ${units} units, ${gbp(cost)} at cost${up.length ? `, with ${up.length} line${up.length === 1 ? "" : "s"} stepped up because they sold out last spring` : ""}. Review it on the buy plan and place the order before the book closes.`,
      working: `Plan per line = sold + backed share of missed demand, × brand momentum, ÷ planned sell-through, rounded to ${b.sizeRun > 1 ? `${b.sizeRun}-piece size runs` : "units"}.`,
      lineIds: up.map((x) => x.fc.line.id),
      valueAtStake: 0,
    };
    return alert;
  }).filter((a): a is Alert => a !== null);
}

export function buildAlerts(levers: Levers, buyPlan: BuyLine[]): Alert[] {
  return [
    ...THIS_SEASON.map((fc) => inSeasonAlert(fc, levers)),
    ...transferAlerts(),
    ...agedAlert(levers),
    ...deadlineAlerts(buyPlan),
  ].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.valueAtStake - a.valueAtStake);
}
