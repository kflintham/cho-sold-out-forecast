/**
 * How the platform is phased. Phases 1–2 are the starter package; 3–4 make
 * up the full platform. Advisories and levers come with every phase.
 */

import type { View } from "../state/AppState";

export type Phase = 1 | 2 | 3 | 4 | "all";

export const VIEW_PHASE: Record<View, Phase> = {
  overview: 1,
  soldout: 2,
  demand: 2,
  buy: 2,
  deliveries: 3,
  timeline: 3,
  ownlabel: 3,
  scenarios: 4,
  advisories: "all",
  levers: "all",
};

export const PHASE_NAME: Record<Exclude<Phase, "all">, string> = {
  1: "See it all in one place",
  2: "Sold-out forecast & true demand",
  3: "Deliveries & production",
  4: "Scenario planning with AI",
};

export const phaseTier = (p: Phase) => (p === "all" ? "Every phase" : p <= 2 ? "Starter" : "Full platform");

export const phaseLabel = (p: Phase) => (p === "all" ? "Every phase" : `Phase ${p}`);
