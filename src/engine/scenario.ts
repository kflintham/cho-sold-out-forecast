/**
 * Scenario planning.
 *
 * Three prepared questions, each answered by re-running the forecast engine
 * under changed assumptions. In production this sits behind a plain-English
 * question box: the AI runs these same models against live data and shows
 * its working. The numbers here are computed from the demo dataset; the
 * reasoning glue is scripted.
 */

import { BRAND_BY_ID, BRAND_PERFORMANCE, SS27_DROPS } from "../data/dataset";
import { FORECAST_BY_ID, buildBuyPlan, shareBy } from "./forecast";
import type { Levers } from "./levers";
import type { Severity } from "./alerts";

export interface ScenarioFinding {
  severity: Severity;
  text: string;
}

export interface ScenarioResult {
  id: string;
  question: string;
  headline: string;
  findings: ScenarioFinding[];
  recommendation: string;
  assumptions: string[];
}

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
const n0 = (n: number) => Math.round(n).toLocaleString("en-GB");
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------

function scenarioBoughtMore(): ScenarioResult {
  const fc = FORECAST_BY_ID["SS26-HF-2611"];
  const l = fc.line;
  const alt = 30;
  const sold = Math.min(alt, fc.demand);
  const soldLow = Math.min(alt, fc.demandLow);
  const extraSales = (sold - fc.sold) * l.rrp;
  const extraCost = (alt - l.bought) * l.cost;
  const leftover = Math.max(0, alt - fc.demandLow);
  // When would 30 have run out, at the demand the engine recovered?
  let cum = 0;
  let outWeek: number | null = null;
  for (let w = 0; w < fc.seasonWeeks; w++) {
    cum += fc.demand * fc.curve[w];
    if (cum >= alt) {
      outWeek = w + 1;
      break;
    }
  }
  const margin = extraSales - extraCost;

  return {
    id: "bought-more",
    question: `What if we'd bought ${alt} of the ${l.name} last spring instead of ${l.bought}?`,
    headline: `You'd have sold about ${n0(sold)} at full price — ${gbp(extraSales)} more sales for ${gbp(extraCost)} more stock, and it would ${outWeek ? `still have sold out, in week ${outWeek}` : "have lasted the season"}.`,
    findings: [
      {
        severity: "good",
        text: `${l.bought} sold out in week ${fc.soldOutWeek} of ${fc.seasonWeeks}. The engine puts season demand at ≈${n0(fc.demand)} (range ${n0(fc.demandLow)}–${n0(fc.demandHigh)}), so all ${alt} would have found a buyer at the central estimate.`,
      },
      {
        severity: "good",
        text: `Extra full-price sales ${gbp(extraSales)} against ${gbp(extraCost)} of extra stock at cost — ${gbp(margin)} more gross margin from one shirt in one colour.`,
      },
      {
        severity: leftover > 0 ? "warning" : "good",
        text:
          leftover > 0
            ? `Worst case (demand at the bottom of the range, ${n0(fc.demandLow)}): ${n0(soldLow)} sold and ${n0(leftover)} left for the sale rail.`
            : `Even at the bottom of the range (${n0(fc.demandLow)} customers) all ${alt} sell at full price — there's no downside case to plan for.`,
      },
    ],
    recommendation: `Treat SS26's ${l.bought} as the floor, not the guide: the SS27 plan backs most of the missed demand for this line and the other sell-outs, with a cap on the step-up while the team gets used to bigger numbers.`,
    assumptions: [
      `${l.name} demand as recovered from its ${fc.inStockWeeks.length} full in-stock weeks and the Harlow & Finch season shape.`,
      "Extra units sell at full price in the order customers arrived; no markdown before season end.",
      `Cost price ${gbp(l.cost)}, RRP ${gbp(l.rrp)}.`,
    ],
  };
}

function scenarioLateDelivery(levers: Levers): ScenarioResult {
  const brandId = "mo";
  const brand = BRAND_BY_ID[brandId];
  const perf = BRAND_PERFORMANCE[brandId];
  const late = 3;
  const plan = buildBuyPlan(levers).filter((b) => b.fc.brand.id === brandId);
  const curve = plan[0].fc.curve;
  // Demand in the weeks the stock isn't there yet is lost; the season still
  // ends on the same date, so the shape is cut, not shifted.
  const lostShare = shareBy(curve, late);
  const units = sum(plan.map((b) => b.recommended));
  const planDemand = sum(plan.map((b) => Math.min(b.recommended, b.fc.demand * (1 + (levers.applyTrend ? brand.trend : 0)))));
  const lostUnits = planDemand * lostShare;
  const lostSales = sum(plan.map((b) => Math.min(b.recommended, b.fc.demand) * lostShare * b.fc.line.rrp));
  const leftover = Math.max(0, units - planDemand * (1 - lostShare));
  const drop = SS27_DROPS[brandId][0];

  return {
    id: "late-delivery",
    question: `What if ${brand.name}'s SS27 delivery lands ${late} weeks late?`,
    headline: `${late} weeks late costs about ${Math.round(lostShare * 100)}% of a ${brand.seasonWeeks}-week season — roughly ${gbp(lostSales)} of full-price sales, and ${n0(leftover)} pieces heading for the sale rail.`,
    findings: [
      {
        severity: "critical",
        text: `The full-price season still ends on the same date, so the first ${late} weeks — when a new drop sells fastest — are simply gone: ${Math.round(lostShare * 100)}% of the season's sales, ≈${n0(lostUnits)} units.`,
      },
      {
        severity: "serious",
        text: `${brand.name} has form: on time and in full ${perf.otifPct}% of the time, ${perf.avgDaysLate} days late on average — "${perf.note}".`,
      },
      {
        severity: "warning",
        text: `The SS27 plan is ${n0(units)} units, due ${drop.date}. Landing late, about ${n0(leftover)} of them won't sell at full price.`,
      },
    ],
    recommendation: `Write the delivery date into the ${brand.name} order with a cancel-by date, and hold back the step-ups on its sold-out lines until the drop is confirmed shipped — or ask for an early drop of the two lines that sold out.`,
    assumptions: [
      `${brand.name} season shape learned from SS26 lines that stayed in stock.`,
      `The full-price season keeps its ${brand.seasonWeeks}-week end date; stock that misses it goes into the sale.`,
      "Delivery performance from the brand scorecard.",
    ],
  };
}

function scenarioNoCap(levers: Levers): ScenarioResult {
  const now = buildBuyPlan(levers);
  const bold = buildBuyPlan({ ...levers, maxStepUp: 0, lostDemandShare: 100 });
  const cost = (p: typeof now) => sum(p.map((b) => b.cost));
  const fullPrice = (p: typeof now, which: "demand" | "demandLow") =>
    sum(p.map((b) => Math.min(b.recommended, b.fc[which]) * b.fc.line.rrp));
  const leftoverCost = (p: typeof now, which: "demand" | "demandLow") =>
    sum(p.map((b) => Math.max(0, b.recommended - b.fc[which]) * b.fc.line.cost));
  const changed = bold.filter((b, i) => b.recommended !== now[i].recommended);
  const extraCost = cost(bold) - cost(now);
  const extraSales = fullPrice(bold, "demand") - fullPrice(now, "demand");
  const downside = leftoverCost(bold, "demandLow") - leftoverCost(now, "demandLow");

  return {
    id: "no-cap",
    question: "What if we backed all the missed demand, with no cap on the step-up?",
    headline: `${changed.length} lines would go higher: ${gbp(extraCost)} more stock for about ${gbp(extraSales)} more full-price sales if demand is where the engine thinks — with ${gbp(Math.max(0, downside))} at risk if it's at the bottom of the range.`,
    findings: [
      {
        severity: "good",
        text: `Biggest movers: ${changed
          .sort((a, b) => b.recommended - a.recommended)
          .slice(0, 3)
          .map((b) => `${b.fc.line.name} ${now.find((x) => x.fc.line.id === b.fc.line.id)!.recommended} → ${b.recommended}`)
          .join(", ")}.`,
      },
      {
        severity: extraCost > levers.budget - cost(now) ? "serious" : "good",
        text: `The plan would be ${gbp(cost(bold))} at cost against a ${gbp(levers.budget)} budget${cost(bold) > levers.budget ? ` — ${gbp(cost(bold) - levers.budget)} over` : ""}.`,
      },
      {
        severity: "warning",
        text: `Downside: if every stepped-up line only reaches the low end of its range, ${gbp(Math.max(0, downside))} more stock at cost ends up in the sale than under today's levers.`,
      },
    ],
    recommendation:
      "Keep the cap for lines stepping up from very small buys, and lift it for the lines with the clearest evidence (sold out in the first quarter of the season, high confidence) — that's where the extra spend earns the most.",
    assumptions: [
      `Today's levers: back ${levers.lostDemandShare}% of missed demand, cap ${levers.maxStepUp ? `×${levers.maxStepUp}` : "off"}, ${levers.targetSellThrough}% planned sell-through.`,
      "Full-price sales capped at each line's recovered demand; anything above goes to the sale.",
      "Downside uses the low end of each line's demand range.",
    ],
  };
}

export function buildScenarios(levers: Levers): ScenarioResult[] {
  return [scenarioBoughtMore(), scenarioLateDelivery(levers), scenarioNoCap(levers)];
}
