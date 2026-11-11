/**
 * Stock views ported from the planning layer: true demand per line this
 * season, stock health bands, ABC classes, stock age and clearance routes —
 * all across the two shops and the website.
 */

import {
  BRAND_BY_ID,
  CARRY_OVER,
  LOCATION_IDS,
  SEASONS,
  TODAY,
  WAITLIST,
  splitByShare,
  type ByLocation,
  type LocationId,
} from "../data/dataset";
import { LAST_SEASON, THIS_SEASON, shareBy, type LineForecast } from "./forecast";
import type { Levers } from "./levers";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const daysSince = (iso: string) => Math.round((TODAY.getTime() - new Date(iso + "T00:00:00Z").getTime()) / 86400000);

// ---------------------------------------------------------------------------
// True demand — this season, per line.
//
//   demand still to come this season (from the season shape)
// + customers waiting for it        (notify-me sign-ups, shop requests)
// − stock in the shops and online
// − open re-orders with the brand    (so nothing is ordered twice)
// = the gap → a re-order, if the brand restocks; otherwise demand to redirect
// ---------------------------------------------------------------------------

export interface TrueDemandLine {
  fc: LineForecast;
  remainingDemand: number;
  waiting: number;
  stock: number;
  onOrder: number;
  gap: number;
  /** re-order rounded to size runs (0 if none needed or brand can't restock) */
  reorder: number;
  /** stock and demand still to come, per location */
  byLocation: Record<LocationId, { stock: number; demand: number }>;
}

/** Units a re-order placed this week would sell before season end (plus anyone waiting). */
export function reorderUnits(fc: LineForecast, levers: Levers): { units: number; landsWeek: number } {
  const landsWeek = fc.weeksTraded + 1 + fc.brand.topUpLeadWeeks;
  const before = fc.demand * (shareBy(fc.curve, landsWeek - 1) - shareBy(fc.curve, fc.weeksTraded));
  const stockAtLanding = Math.max(0, fc.stockNow + fc.onOrder - before);
  const after = fc.demand * (1 - shareBy(fc.curve, landsWeek - 1));
  const need = Math.max(0, after - stockAtLanding) + (levers.countWaiting ? fc.waiting : 0);
  const run = fc.brand.sizeRun;
  // Round up: a re-order exists to keep the line on sale, so a part size run counts as one.
  return { units: need > 0.5 ? Math.max(run, Math.ceil((need - 0.25) / run) * run) : 0, landsWeek };
}

export function trueDemandLine(fc: LineForecast, levers: Levers): TrueDemandLine {
  const remainingDemand = fc.demand * (1 - shareBy(fc.curve, fc.weeksTraded));
  const waiting = levers.countWaiting ? fc.waiting : 0;
  const gap = Math.max(0, remainingDemand + waiting - fc.stockNow - fc.onOrder);
  // Demand that arrives before a re-order could land can't be served, so the
  // re-order itself is timed (see reorderUnits); the gap shows the full picture.
  const reorder = fc.canTopUp && gap >= fc.brand.sizeRun * 0.5 ? reorderUnits(fc, levers).units : 0;
  const byLocation = Object.fromEntries(
    LOCATION_IDS.map((id) => [id, { stock: fc.line.stockByLoc[id], demand: remainingDemand * fc.line.locShare[id] }]),
  ) as TrueDemandLine["byLocation"];
  return { fc, remainingDemand, waiting, stock: fc.stockNow, onOrder: fc.onOrder, gap, reorder, byLocation };
}

export function buildTrueDemand(levers: Levers): TrueDemandLine[] {
  return THIS_SEASON.map((fc) => trueDemandLine(fc, levers));
}

/** The comparison the toggle drives: re-orders with and without waiting customers. */
export function waitingBlindspot(levers: Levers) {
  const withW = buildTrueDemand({ ...levers, countWaiting: true });
  const without = buildTrueDemand({ ...levers, countWaiting: false });
  const units = sum(withW.map((t, i) => Math.max(0, t.reorder - without[i].reorder)));
  const waiting = sum(THIS_SEASON.map((f) => f.waiting));
  const waitingValue = sum(THIS_SEASON.map((f) => f.waiting * f.line.rrp));
  const online = sum(Object.values(WAITLIST).map((w) => w.online));
  return { units, waiting, waitingValue, online, inStore: waiting - online };
}

// ---------------------------------------------------------------------------
// Rebalancing — move stock to where it sells before re-ordering.
// ---------------------------------------------------------------------------

export interface Transfer {
  fc: LineForecast;
  from: LocationId;
  to: LocationId;
  units: number;
}

export function suggestTransfers(): Transfer[] {
  const out: Transfer[] = [];
  for (const fc of THIS_SEASON) {
    if (fc.stockNow < 4) continue;
    const remaining = fc.demand * (1 - shareBy(fc.curve, fc.weeksTraded));
    const need = (id: LocationId) => remaining * fc.line.locShare[id];
    const balance = LOCATION_IDS.map((id) => ({ id, spare: fc.line.stockByLoc[id] - need(id) }));
    const short = balance.filter((b) => b.spare < -1).sort((a, b) => a.spare - b.spare)[0];
    const long = balance.filter((b) => b.spare > 1.5).sort((a, b) => b.spare - a.spare)[0];
    if (!short || !long) continue;
    const units = Math.floor(Math.min(-short.spare, long.spare));
    if (units >= 2) out.push({ fc, from: long.id, to: short.id, units });
  }
  return out.sort((a, b) => b.units * b.fc.line.rrp - a.units * a.fc.line.rrp);
}

// ---------------------------------------------------------------------------
// Everything on hand: this season's lines, SS26 leftovers, older stock.
// ---------------------------------------------------------------------------

export type HealthBand = "selling-out" | "healthy" | "slow" | "aged";

export const HEALTH_META: Record<HealthBand, { label: string; blurb: string; severity: "critical" | "serious" | "warning" | "good" }> = {
  "selling-out": { label: "Selling out", blurb: "runs out before its season ends", severity: "serious" },
  healthy: { label: "Healthy", blurb: "on course to finish the season close to sold through", severity: "good" },
  slow: { label: "Slow", blurb: "30%+ projected left at season end", severity: "warning" },
  aged: { label: "Aged", blurb: "past its season and older than the aged-stock threshold", severity: "critical" },
};

export interface StockItem {
  id: string;
  /** forecast line id, when the item is a tracked line */
  lineId?: string;
  code: string;
  name: string;
  brandId: string;
  category: string;
  season: string;
  rrp: number;
  cost: number;
  stockByLoc: ByLocation;
  units: number;
  ageDays: number;
  band: HealthBand;
  /** units projected left at season end (current season) */
  projectedLeftover: number;
}

/** Share of SS26's season-end stock still on hand after the July sale. */
export const SUMMER_SALE_LEFT = 0.35;

export function stockItems(levers: Levers): StockItem[] {
  const current: StockItem[] = THIS_SEASON.filter((f) => f.stockNow > 0).map((f) => ({
    id: f.line.id,
    lineId: f.line.id,
    code: f.line.code,
    name: f.line.name,
    brandId: f.brand.id,
    category: f.line.category,
    season: "AW26",
    rrp: f.line.rrp,
    cost: f.line.cost,
    stockByLoc: f.line.stockByLoc,
    units: f.stockNow,
    ageDays: daysSince(SEASONS.AW26.start),
    band:
      f.projectedSellOutWeek !== null
        ? "selling-out"
        : f.projectedLeftover > f.supplied * 0.3
          ? "slow"
          : "healthy",
    projectedLeftover: f.projectedLeftover,
  }));
  // SS26 leftovers after the July sale cleared most of them.
  const leftovers: StockItem[] = LAST_SEASON.map((f) => ({ f, units: Math.floor(f.stockNow * SUMMER_SALE_LEFT) }))
    .filter(({ units }) => units > 0)
    .map(({ f, units }) => {
    const age = daysSince(SEASONS.SS26.start);
    return {
      id: f.line.id,
      lineId: f.line.id,
      code: f.line.code,
      name: f.line.name,
      brandId: f.brand.id,
      category: f.line.category,
      season: "SS26",
      rrp: f.line.rrp,
      cost: f.line.cost,
      stockByLoc: splitByShare(units, f.line.locShare),
      units,
      ageDays: age,
      band: age > levers.agedDays ? "aged" : "slow",
      projectedLeftover: units,
    };
  });
  const older: StockItem[] = CARRY_OVER.map((c) => {
    const units = sum(LOCATION_IDS.map((id) => c.stockByLoc[id]));
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      brandId: c.brandId,
      category: c.category,
      season: c.season,
      rrp: c.rrp,
      cost: c.cost,
      stockByLoc: c.stockByLoc,
      units,
      ageDays: c.ageDays,
      band: c.ageDays > levers.agedDays ? "aged" : "slow",
      projectedLeftover: units,
    };
  });
  return [...current, ...leftovers, ...older];
}

// ---------------------------------------------------------------------------
// ABC — this season's lines by share of sales value.
// ---------------------------------------------------------------------------

export type AbcClass = "A" | "B" | "C";

export const ABC_META: Record<AbcClass, string> = {
  A: "the lines that make the season — top 70% of sales",
  B: "steady supporting lines — the next 20%",
  C: "the tail — last 10% of sales",
};

export function abcClasses(
  keep: (f: LineForecast) => boolean = () => true,
): { cls: AbcClass; lines: LineForecast[]; salesShare: number; stockCost: number; stockShare: number }[] {
  const ranked = THIS_SEASON.filter(keep).sort((a, b) => b.sold * b.line.rrp - a.sold * a.line.rrp);
  const total = sum(ranked.map((f) => f.sold * f.line.rrp)) || 1;
  const stockTotal = sum(ranked.map((f) => f.stockNow * f.line.cost)) || 1;
  const by: Record<AbcClass, LineForecast[]> = { A: [], B: [], C: [] };
  let cum = 0;
  for (const f of ranked) {
    const before = cum / total;
    cum += f.sold * f.line.rrp;
    by[before < 0.7 ? "A" : before < 0.9 ? "B" : "C"].push(f);
  }
  return (["A", "B", "C"] as AbcClass[]).map((cls) => {
    const lines = by[cls];
    const stockCost = sum(lines.map((f) => f.stockNow * f.line.cost));
    return {
      cls,
      lines,
      salesShare: (sum(lines.map((f) => f.sold * f.line.rrp)) / total) * 100,
      stockCost,
      stockShare: (stockCost / stockTotal) * 100,
    };
  });
}

// ---------------------------------------------------------------------------
// Stock age and clearance.
// ---------------------------------------------------------------------------

export const AGE_BUCKETS = [
  { label: "0–90 days", max: 90 },
  { label: "91–180 days", max: 180 },
  { label: "181–365 days", max: 365 },
  { label: "Over a year", max: Infinity },
];

export function ageBuckets(items: StockItem[]) {
  return AGE_BUCKETS.map((b, i) => {
    const min = i === 0 ? -1 : AGE_BUCKETS[i - 1].max;
    const inB = items.filter((s) => s.ageDays > min && s.ageDays <= b.max);
    return { label: b.label, units: sum(inB.map((s) => s.units)), cost: sum(inB.map((s) => s.units * s.cost)) };
  });
}

export interface Clearance {
  item: StockItem;
  route: string;
  /** cash back at the suggested price */
  recover: number;
}

export function clearanceRoutes(items: StockItem[]): Clearance[] {
  return items
    .filter((s) => s.band === "aged" || s.band === "slow")
    .map((s) => {
      const brand = BRAND_BY_ID[s.brandId];
      const best = LOCATION_IDS.reduce((a, b) => (s.stockByLoc[a] >= s.stockByLoc[b] ? a : b));
      const units = s.band === "slow" && s.season === "AW26" ? Math.round(s.projectedLeftover) : s.units;
      if (s.ageDays > 365)
        return {
          item: s,
          route: `Over a year old — sample sale or outlet at 50% off; ask ${brand.name} about credit against SS27`,
          recover: units * s.rrp * 0.5,
        };
      if (s.season !== "AW26")
        return {
          item: s,
          route: `Last season — online first at 30% off (photographed once, sold from every location), then the shop sale rail`,
          recover: units * s.rrp * 0.7,
        };
      return {
        item: s,
        route: `Slow this season — feature it now, then 20% off from week ${Math.min(brand.seasonWeeks, (SEASONS.AW26.weeksTraded ?? 0) + 3)}; most stock is at ${best === "online" ? "the web stockroom" : best === "main" ? "the main shop" : "the second shop"}`,
        recover: units * s.rrp * 0.8,
      };
    })
    .filter((c) => c.recover > 0)
    .sort((a, b) => b.item.ageDays - a.item.ageDays || b.recover - a.recover);
}
