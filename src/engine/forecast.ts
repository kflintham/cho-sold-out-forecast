/**
 * The sold-out forecast.
 *
 * Till data only records what you sold, not what customers wanted. Once a
 * line sells out, its sales flatline at zero and the demand disappears from
 * every report. This engine puts it back:
 *
 *   1. Learn each brand's season shape from its lines that never sold out —
 *      "by week 3, a Harlow & Finch line has done 21% of its season".
 *   2. For a line that sold out, look only at the weeks it was fully in
 *      stock: sold 10 by week 3 ÷ 21% ≈ 47 customers over the season.
 *   3. The gap between that and what you sold is the missed demand.
 *   4. Next season's buy = what sold + the share of missed demand you back,
 *      with brand momentum, a planned sell-through and size-run rounding.
 *
 * The same shape projects this season's lines forward, so a sell-out is
 * flagged while there is still time to re-order (or to stop discounting).
 */

import {
  BRAND_BY_ID,
  REORDERS,
  SEASONS,
  linesIn,
  waitingFor,
  type Brand,
  type Line,
  type SeasonId,
} from "../data/dataset";
import type { Levers } from "./levers";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// 1. Season shapes, learned from lines that stayed in stock all season.
// ---------------------------------------------------------------------------

export interface SeasonShape {
  brandId: string;
  /** average share of a season's full-price sales in each week */
  curve: number[];
  /** each sister line's own curve — used for the range */
  sisterCurves: number[][];
  sisterIds: string[];
}

function normalise(xs: number[]): number[] {
  const t = sum(xs) || 1;
  return xs.map((x) => x / t);
}

const neverSoldOut = (l: Line) => l.endStock.every((s) => s > 0);

/** Resample a curve onto a different season length (by season fraction). */
function resample(curve: number[], weeks: number): number[] {
  const cum = [0];
  for (const v of curve) cum.push(cum[cum.length - 1] + v);
  const at = (f: number) => {
    const x = f * curve.length;
    const i = Math.min(curve.length - 1, Math.floor(x));
    return cum[i] + (cum[i + 1] - cum[i]) * (x - i);
  };
  return Array.from({ length: weeks }, (_, w) => at((w + 1) / weeks) - at(w / weeks));
}

/** 3-week centred moving average — a boutique sells a line or two a week, so raw weeks are lumpy. */
function smooth(xs: number[]): number[] {
  return xs.map((_, i) => {
    const win = xs.slice(Math.max(0, i - 1), i + 2);
    return sum(win) / win.length;
  });
}

const average = (curves: number[][], weeks: number) =>
  normalise(Array.from({ length: weeks }, (_, w) => sum(curves.map((c) => c[w])) / curves.length));

function buildShapes(): Record<string, SeasonShape> {
  const finished = linesIn("SS26");
  const pooled = finished.filter(neverSoldOut);
  const shapes: Record<string, SeasonShape> = {};
  for (const brand of Object.values(BRAND_BY_ID)) {
    let sisters = pooled.filter((l) => l.brandId === brand.id);
    // Too few in-stock lines at this brand: borrow the whole shop's shape.
    if (sisters.length < 2) sisters = pooled;
    // The whole shop's shape steadies a brand that only has a few sister lines.
    const shop = average(
      pooled.map((l) => resample(normalise(l.sales), brand.seasonWeeks)),
      brand.seasonWeeks,
    );
    const blend = (c: number[]) => normalise(smooth(c).map((v, w) => 0.5 * v + 0.5 * shop[w]));
    const sisterCurves = sisters.map((l) => blend(resample(normalise(l.sales), brand.seasonWeeks)));
    const curve = average(sisterCurves, brand.seasonWeeks);
    shapes[brand.id] = { brandId: brand.id, curve, sisterCurves, sisterIds: sisters.map((s) => s.id) };
  }
  return shapes;
}

export const SHAPES = buildShapes();

/** Share of the season done by the end of `week` (1-based). */
export const shareBy = (curve: number[], week: number) => sum(curve.slice(0, week));

// ---------------------------------------------------------------------------
// 2–3. Demand recovery per line.
// ---------------------------------------------------------------------------

export type Confidence = "high" | "medium" | "low";

export interface LineForecast {
  line: Line;
  brand: Brand;
  /** weeks of the season traded so far (= season length when finished) */
  weeksTraded: number;
  seasonWeeks: number;
  finished: boolean;

  sold: number;
  /** opening buy + any top-ups received */
  supplied: number;
  /** season week stock first hit zero (1-based), null = never */
  soldOutWeek: number | null;
  /** traded weeks spent with no stock */
  weeksOutOfStock: number;
  /** weeks fully in stock, the only weeks the estimate reads */
  inStockWeeks: number[];
  /** the brand's season shape */
  curve: number[];

  /** estimated full-season demand — customers who wanted the line */
  demand: number;
  demandLow: number;
  demandHigh: number;
  confidence: Confidence;
  /** demand estimated across the weeks traded so far */
  demandToDate: number;
  /** demand the shop could not serve (season so far, or whole season if finished) */
  lostUnits: number;
  lostRevenue: number;
  /** finished: missed demand across the season · in-season: projected by season end */
  lostUnitsSeason: number;

  // In-season projection (current season only)
  stockNow: number;
  /** projected week stock runs out, if it does before season end */
  projectedSellOutWeek: number | null;
  projectedLeftover: number;
  /** a re-order is possible: the brand restocks this line in season */
  canTopUp: boolean;
  /** units on open re-orders with the brand */
  onOrder: number;
  /** season week the open re-order lands */
  onOrderLandsWeek: number | null;
  /** when it would sell out if the open re-order didn't exist */
  projectedSellOutWeekNoReorder: number | null;
  /** customers who've asked to be told when it's back */
  waiting: number;
}

function estimateWith(curve: number[], line: Line, inStock: number[]): number {
  const s = sum(inStock.map((w) => line.sales[w]));
  const share = sum(inStock.map((w) => curve[w]));
  return share > 0 ? s / share : 0;
}

export function forecastLine(line: Line): LineForecast {
  const brand = BRAND_BY_ID[line.brandId];
  const shape = SHAPES[brand.id];
  const curve = shape.curve;
  const seasonWeeks = brand.seasonWeeks;
  const finished = SEASONS[line.season].weeksTraded === null;
  const weeksTraded = line.sales.length;

  const sold = sum(line.sales);
  const supplied = line.bought + sum(line.topUps.map((t) => t.qty));
  const soldOutIdx = line.endStock.findIndex((s) => s === 0);
  const soldOutWeek = soldOutIdx === -1 ? null : soldOutIdx + 1;
  // Whole weeks with an empty shelf (the sell-out week itself still traded).
  const weeksOutOfStock = line.endStock.filter((s, w) => s === 0 && line.sales[w] === 0).length;
  const inStockWeeks = line.endStock.map((s, w) => (s > 0 ? w : -1)).filter((w) => w >= 0);

  // Weeks that ended with stock on the shelf saw every customer who came in.
  // A week that ended at zero turned some away, so it only sets a floor.
  let demand: number;
  let demandLow: number;
  let demandHigh: number;
  if (inStockWeeks.length > 0) {
    demand = estimateWith(curve, line, inStockWeeks);
    const each = shape.sisterCurves.map((c) => estimateWith(c, line, inStockWeeks));
    demandLow = Math.min(...each);
    demandHigh = Math.max(...each);
  } else {
    // Sold out inside week 1: all we know is it beat the opening stock.
    demand = line.sales[0] / curve[0];
    demandLow = demand;
    demandHigh = demand * 1.6;
  }
  // Never below what actually sold.
  const tradedShare = shareBy(curve, weeksTraded);
  const floor = finished ? sold : sold / Math.max(tradedShare, 0.01);
  demand = Math.max(demand, floor);
  demandLow = Math.max(Math.min(demandLow, demand), finished ? sold : floor * 0.9);
  demandHigh = Math.max(demandHigh, demand);

  const confidence: Confidence =
    soldOutWeek === null
      ? "high"
      : inStockWeeks.length >= 3 && shape.sisterIds.length >= 3
        ? "high"
        : inStockWeeks.length >= 2
          ? "medium"
          : "low";

  const demandToDate = demand * tradedShare;
  const lostUnits = soldOutWeek === null ? 0 : Math.max(0, demandToDate - sold);

  // In-season projection --------------------------------------------------
  const stockNow = line.endStock[weeksTraded - 1] ?? 0;
  const reorders = finished ? [] : REORDERS.filter((r) => r.lineId === line.id);
  const onOrder = sum(reorders.map((r) => r.qty));
  const project = (withReorders: boolean) => {
    let lvl = stockNow;
    let out: number | null = null;
    for (let w = weeksTraded; w < seasonWeeks; w++) {
      if (withReorders) for (const r of reorders) if (r.landsWeek === w + 1) lvl += r.qty;
      lvl -= demand * curve[w];
      if (lvl <= 0 && out === null && w + 1 < seasonWeeks) out = w + 1;
    }
    return out;
  };
  const projectedSellOutWeekNoReorder = finished || stockNow === 0 ? null : project(false);
  let projectedSellOutWeek: number | null = null;
  let level = stockNow;
  for (let w = weeksTraded; w < seasonWeeks; w++) {
    for (const r of reorders) if (r.landsWeek === w + 1) level += r.qty;
    level -= demand * curve[w];
    // Selling out in the final week is a good buy, not an early sell-out.
    if (level <= 0 && projectedSellOutWeek === null && w + 1 < seasonWeeks) projectedSellOutWeek = w + 1;
  }
  if (stockNow === 0) projectedSellOutWeek = soldOutWeek;
  const projectedLeftover = finished ? (line.endStock[weeksTraded - 1] ?? 0) : Math.max(0, level);
  const remainingDemand = demand * (1 - tradedShare);
  const lostUnitsSeason = finished
    ? lostUnits
    : lostUnits + Math.max(0, remainingDemand - stockNow - onOrder);

  return {
    line,
    brand,
    weeksTraded,
    seasonWeeks,
    finished,
    sold,
    supplied,
    soldOutWeek,
    weeksOutOfStock,
    inStockWeeks,
    curve,
    demand,
    demandLow,
    demandHigh,
    confidence,
    demandToDate,
    lostUnits,
    lostRevenue: lostUnits * line.rrp,
    lostUnitsSeason,
    stockNow,
    projectedSellOutWeek,
    projectedLeftover,
    canTopUp: brand.topUp && line.core,
    onOrder,
    onOrderLandsWeek: reorders.length ? Math.min(...reorders.map((r) => r.landsWeek)) : null,
    projectedSellOutWeekNoReorder,
    waiting: waitingFor(line.id),
  };
}

// ---------------------------------------------------------------------------
// 4. Next season's buy, from last season's evidence.
// ---------------------------------------------------------------------------

export interface BuyLine {
  fc: LineForecast;
  /** sold + backed share of missed demand */
  baseDemand: number;
  trendFactor: number;
  /** before cap and rounding */
  target: number;
  /** the step-up cap reduced this buy */
  capped: boolean;
  recommended: number;
  recommendedLow: number;
  recommendedHigh: number;
  /** what the shop's rule of thumb would have ordered */
  usualRule: number;
  cost: number;
  usualCost: number;
  /** the line sold out early enough that the buy changes materially */
  soldOutEarly: boolean;
}

function roundBuy(units: number, brand: Brand, levers: Levers): number {
  if (units <= 0) return 0;
  if (!levers.roundToSizeRun) return Math.round(units);
  return Math.max(brand.sizeRun, Math.round(units / brand.sizeRun) * brand.sizeRun);
}

function planUnits(sold: number, demand: number, fc: LineForecast, levers: Levers) {
  const lost = Math.max(0, demand - sold);
  const base = levers.countLostDemand ? sold + lost * (levers.lostDemandShare / 100) : sold;
  const trendFactor = levers.applyTrend ? 1 + fc.brand.trend : 1;
  const target = (base * trendFactor) / (levers.targetSellThrough / 100);
  const cap = levers.maxStepUp > 0 ? fc.line.bought * levers.maxStepUp : Infinity;
  return { base, trendFactor, target, capped: target > cap, units: Math.min(target, cap) };
}

export function buildBuyLine(fc: LineForecast, levers: Levers): BuyLine {
  const mid = planUnits(fc.sold, fc.demand, fc, levers);
  const low = planUnits(fc.sold, fc.demandLow, fc, levers);
  const high = planUnits(fc.sold, fc.demandHigh, fc, levers);
  const recommended = roundBuy(mid.units, fc.brand, levers);

  const soldOut = fc.soldOutWeek !== null;
  const usualUnits = soldOut ? fc.line.bought * (1 + levers.usualRulePct / 100) : fc.line.bought;
  const usualRule = roundBuy(usualUnits, fc.brand, levers);

  return {
    fc,
    baseDemand: mid.base,
    trendFactor: mid.trendFactor,
    target: mid.target,
    capped: mid.capped,
    recommended,
    recommendedLow: roundBuy(low.units, fc.brand, levers),
    recommendedHigh: roundBuy(high.units, fc.brand, levers),
    usualRule,
    cost: recommended * fc.line.cost,
    usualCost: usualRule * fc.line.cost,
    soldOutEarly: soldOut && fc.soldOutWeek! <= fc.seasonWeeks * 0.75,
  };
}

// ---------------------------------------------------------------------------
// Precomputed forecasts (the dataset is fixed; levers only touch the buy).
// ---------------------------------------------------------------------------

export const LAST_SEASON: LineForecast[] = linesIn("SS26").map(forecastLine);
export const THIS_SEASON: LineForecast[] = linesIn("AW26").map(forecastLine);
export const FORECAST_BY_ID: Record<string, LineForecast> = Object.fromEntries(
  [...LAST_SEASON, ...THIS_SEASON].map((f) => [f.line.id, f]),
);

export function buildBuyPlan(levers: Levers): BuyLine[] {
  return LAST_SEASON.map((fc) => buildBuyLine(fc, levers));
}

export function seasonTotals(season: SeasonId) {
  const fcs = season === "SS26" ? LAST_SEASON : THIS_SEASON;
  const sales = sum(fcs.map((f) => f.sold * f.line.rrp));
  const units = sum(fcs.map((f) => f.sold));
  const soldOut = fcs.filter((f) => f.soldOutWeek !== null);
  const lostUnits = sum(fcs.map((f) => f.lostUnits));
  const lostRevenue = sum(fcs.map((f) => f.lostRevenue));
  const lostUnitsSeason = sum(fcs.map((f) => f.lostUnitsSeason));
  const lostRevenueSeason = sum(fcs.map((f) => f.lostUnitsSeason * f.line.rrp));
  const supplied = sum(fcs.map((f) => f.supplied));
  return {
    lines: fcs.length,
    sales,
    units,
    soldOut: soldOut.length,
    avgSoldOutShare:
      soldOut.length > 0 ? sum(soldOut.map((f) => f.soldOutWeek! / f.seasonWeeks)) / soldOut.length : 0,
    lostUnits,
    lostRevenue,
    lostUnitsSeason,
    lostRevenueSeason,
    sellThrough: supplied > 0 ? (units / supplied) * 100 : 0,
  };
}
