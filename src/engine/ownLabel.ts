/**
 * Own-label buy sheet: the SS27 plan for own-label lines, grouped by factory,
 * rounded to factory minimums and whole cartons, and — for the sea-freight
 * factory — packed to container volume so the order fills a box instead of
 * shipping air.
 */

import { FACTORIES, FACTORY_BY_ID, type Factory } from "../data/dataset";
import type { BuyLine } from "./forecast";

export interface ContainerOption {
  name: string;
  usableM3: number;
}

/** Standard usable volumes: 20ft ≈ 33 CBM, 40ft HC ≈ 76 CBM. */
export const CONTAINERS: ContainerOption[] = [
  { name: "20ft", usableM3: 33 },
  { name: "40ft HC", usableM3: 76 },
];

/** Fill policy: below 60% of a 20ft ships consolidated (LCL); target 90%+. */
export const FILL_TARGET = 90;
export const LCL_BELOW = 0.6;

export interface FactoryLine {
  buy: BuyLine;
  units: number;
  cartons: number;
  m3: number;
  cost: number;
  /** units the factory minimum added above the plan */
  moqAdded: number;
}

export interface TopUp {
  buy: BuyLine;
  addUnits: number;
  addM3: number;
  addCost: number;
  reason: string;
}

export interface FactorySheet {
  factory: Factory;
  lines: FactoryLine[];
  totalUnits: number;
  totalM3: number;
  totalCost: number;
  container: ContainerOption | null;
  fillPct: number | null;
  advice: string;
  topUps: TopUp[];
}

export function buildOwnLabelSheet(plan: BuyLine[]): FactorySheet[] {
  return FACTORIES.map((factory) => {
    const lines: FactoryLine[] = plan
      .filter((b) => b.fc.line.factoryId === factory.id && b.recommended > 0)
      .map((b) => {
        const carton = b.fc.line.cartonQty ?? 1;
        const cartons = Math.ceil(b.recommended / carton);
        const unrounded = Math.round(b.target);
        return {
          buy: b,
          units: b.recommended,
          cartons,
          m3: cartons * (b.fc.line.cartonM3 ?? 0),
          cost: b.cost,
          moqAdded: unrounded < factory.moq ? Math.max(0, b.recommended - unrounded) : 0,
        };
      })
      .sort((a, b) => b.cost - a.cost);

    const totalUnits = lines.reduce((a, l) => a + l.units, 0);
    const totalM3 = lines.reduce((a, l) => a + l.m3, 0);
    const totalCost = lines.reduce((a, l) => a + l.cost, 0);

    let container: ContainerOption | null = null;
    let fillPct: number | null = null;
    let advice = "";
    const topUps: TopUp[] = [];

    if (factory.mode === "sea" && totalM3 > 0) {
      container = CONTAINERS.find((c) => totalM3 <= c.usableM3) ?? CONTAINERS[CONTAINERS.length - 1];
      fillPct = (totalM3 / container.usableM3) * 100;
      if (totalM3 < CONTAINERS[0].usableM3 * LCL_BELOW) {
        advice = `${totalM3.toFixed(1)} m³ only fills ${Math.round(fillPct)}% of a ${container.name} — book it consolidated (LCL) with the forwarder rather than paying for a box of air. A full container starts to make sense at ~${Math.round(CONTAINERS[0].usableM3 * LCL_BELOW)} m³ across the factory's orders.`;
      } else if (fillPct >= FILL_TARGET) {
        advice = `${container.name} at ${Math.round(fillPct)}% — on target. Book it.`;
      } else {
        advice = `${container.name} at ${Math.round(fillPct)}% — ${(container.usableM3 - totalM3).toFixed(1)} m³ of paid-for space spare. Top up with the lines below before booking.`;
      }
      // Top-up candidates: other own-label lines from this factory that sold
      // out last season — more of them sells; fill the space with those first.
      let spare = (container.usableM3 * FILL_TARGET) / 100 - totalM3;
      const candidates = lines.filter((l) => l.buy.fc.soldOutWeek !== null).map((l) => l.buy);
      for (const b of candidates) {
        if (spare <= 0.5) break;
        const cartonM3 = b.fc.line.cartonM3 ?? 0.05;
        const carton = b.fc.line.cartonQty ?? 1;
        const headroom = Math.max(0, Math.round(b.fc.demandHigh * 1.1 - b.recommended));
        const addCartons = Math.min(Math.floor(spare / cartonM3), Math.floor(headroom / carton));
        if (addCartons < 1) continue;
        topUps.push({
          buy: b,
          addUnits: addCartons * carton,
          addM3: addCartons * cartonM3,
          addCost: addCartons * carton * b.fc.line.cost,
          reason: `sold out in week ${b.fc.soldOutWeek} last spring — demand range tops out at ≈${Math.round(b.fc.demandHigh)}`,
        });
        spare -= addCartons * cartonM3;
      }
    } else if (totalM3 > 0) {
      advice =
        factory.mode === "road"
          ? `Ships by road on pallets — ${Math.ceil(totalM3 / 1.5)} pallet${Math.ceil(totalM3 / 1.5) === 1 ? "" : "s"}, no container planning needed.`
          : "Delivered by van from the factory — no freight planning needed.";
    }

    return { factory, lines, totalUnits, totalM3, totalCost, container, fillPct, advice, topUps };
  }).filter((s) => s.lines.length > 0);
}

export const factoryName = (id: string) => {
  const f = FACTORY_BY_ID[id];
  return `${f.name} — ${f.location}`;
};
