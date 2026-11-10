/**
 * Synthetic demo dataset — a multi-brand fashion boutique buying seasonal
 * collections from its brands.
 *
 * Everything here is invented: brands, styles, prices and numbers. Weekly
 * sales are simulated from a hidden "true demand" per line, then capped by
 * the stock the shop actually had — exactly how a sell-out hides demand in
 * real till data. The forecast engine never sees the hidden demand; it has
 * to recover it from sales and stock alone, the same way it would from the
 * EPOS / Shopify history in production.
 */

/** Fixed anchor so the demo is fully deterministic. */
export const TODAY = new Date("2026-11-12T00:00:00Z");

export type SeasonId = "SS26" | "AW26";

export interface Season {
  id: SeasonId;
  label: string;
  /** ISO date of the Monday the season's first delivery went on sale */
  start: string;
  /** weeks of the season that have fully traded (null = finished) */
  weeksTraded: number | null;
}

export const SEASONS: Record<SeasonId, Season> = {
  SS26: { id: "SS26", label: "Spring/Summer 2026", start: "2026-03-02", weeksTraded: null },
  AW26: { id: "AW26", label: "Autumn/Winter 2026", start: "2026-08-31", weeksTraded: 10 },
};

/** The season being bought now, from last season's evidence. */
export const NEXT_SEASON = { id: "SS27", label: "Spring/Summer 2027", basedOn: "SS26" as SeasonId };

export interface Brand {
  id: string;
  name: string;
  base: string;
  focus: string;
  /** full-price selling season for this brand, weeks */
  seasonWeeks: number;
  /** the brand holds stock for in-season re-orders on its core lines */
  topUp: boolean;
  /** weeks from a re-order to it landing in the shop */
  topUpLeadWeeks: number;
  /** order book closes for SS27 */
  orderDeadline: string;
  /** units in one size run — the smallest sensible order step */
  sizeRun: number;
  sizes: string;
  /** brand momentum applied to next season's plan */
  trend: number;
}

export const BRANDS: Brand[] = [
  { id: "hf", name: "Harlow & Finch", base: "London", focus: "Shirts & casualwear", seasonWeeks: 16, topUp: false, topUpLeadWeeks: 0, orderDeadline: "2026-11-27", sizeRun: 5, sizes: "S–XXL", trend: 0.08 },
  { id: "nv", name: "Nordvik", base: "Copenhagen", focus: "Knitwear", seasonWeeks: 20, topUp: true, topUpLeadWeeks: 3, orderDeadline: "2026-12-04", sizeRun: 4, sizes: "S–XL", trend: 0.05 },
  { id: "mo", name: "Maison Ondine", base: "Paris", focus: "Dresses & womenswear", seasonWeeks: 12, topUp: false, topUpLeadWeeks: 0, orderDeadline: "2026-11-20", sizeRun: 5, sizes: "8–16", trend: 0.12 },
  { id: "ad", name: "Ardent Denim", base: "Leeds", focus: "Denim", seasonWeeks: 26, topUp: true, topUpLeadWeeks: 2, orderDeadline: "2026-12-11", sizeRun: 6, sizes: "28–38", trend: 0.03 },
  { id: "kc", name: "Kestrel & Co", base: "Northumberland", focus: "Outerwear", seasonWeeks: 18, topUp: false, topUpLeadWeeks: 0, orderDeadline: "2026-11-25", sizeRun: 4, sizes: "S–XL", trend: 0 },
  { id: "sr", name: "Sable & Rye", base: "Bath", focus: "Bags & accessories", seasonWeeks: 24, topUp: true, topUpLeadWeeks: 4, orderDeadline: "2026-12-18", sizeRun: 1, sizes: "one size", trend: 0.1 },
];

export const BRAND_BY_ID: Record<string, Brand> = Object.fromEntries(BRANDS.map((b) => [b.id, b]));

export interface TopUp {
  /** season week the re-order landed */
  week: number;
  qty: number;
}

export interface Line {
  id: string;
  code: string;
  name: string;
  brandId: string;
  category: string;
  season: SeasonId;
  rrp: number;
  cost: number;
  /** the opening order placed with the brand */
  bought: number;
  /** a core line the brand will restock in season (if the brand tops up) */
  core: boolean;
  /** units sold per season week, full-price weeks only (week 1 first) */
  sales: number[];
  /** stock left at the end of each week */
  endStock: number[];
  topUps: TopUp[];
}

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) — same numbers every load.
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261112);
const jitter = (spread: number) => 1 + (rand() * 2 - 1) * spread;

/**
 * How full-price demand for a fashion line spreads across its season: a
 * two-week build as the drop lands, then a steady fade as the season ages.
 * Hidden from the engine — it re-learns the shape from in-stock lines.
 */
function demandCurve(weeks: number): number[] {
  const raw = Array.from({ length: weeks }, (_, i) => {
    const ramp = Math.min(1, 0.6 + 0.2 * i);
    const fade = 1 - 0.6 * ((i + 0.5) / weeks);
    return ramp * fade;
  });
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => v / total);
}

// ---------------------------------------------------------------------------
// Line catalogue. `demand` is the hidden full-season demand; `forceSales`
// pins the story lines to the exact numbers from the conversation.
// ---------------------------------------------------------------------------

interface LineSeed {
  code: string;
  name: string;
  brandId: string;
  category: string;
  season: SeasonId;
  rrp: number;
  bought: number;
  demand: number;
  core?: boolean;
  forceSales?: number[];
}

const SHIRT = "Shirts";
const KNIT = "Knitwear";
const DRESS = "Dresses & skirts";
const TROUSER = "Trousers & denim";
const OUTER = "Outerwear";
const ACC = "Bags & accessories";
const TOP = "Tops & polos";

const SEEDS: LineSeed[] = [
  // ======================= SS26 — last season, finished ====================
  // --- Harlow & Finch (16-week season, no in-season stock) -----------------
  // The story line: bought 12, gone in 4 weeks of a 16-week season.
  { code: "HF-2611", name: "Ellis Linen Shirt — Sage", brandId: "hf", category: SHIRT, season: "SS26", rrp: 95, bought: 12, demand: 46, forceSales: [3, 3, 4, 2] },
  { code: "HF-2612", name: "Ellis Linen Shirt — Ecru", brandId: "hf", category: SHIRT, season: "SS26", rrp: 95, bought: 18, demand: 31 },
  { code: "HF-2650", name: "Ashby Seersucker Shirt", brandId: "hf", category: SHIRT, season: "SS26", rrp: 89, bought: 10, demand: 21 },
  { code: "HF-2620", name: "Garrick Overshirt", brandId: "hf", category: SHIRT, season: "SS26", rrp: 125, bought: 15, demand: 13 },
  { code: "HF-2631", name: "Cole Chino — Stone", brandId: "hf", category: TROUSER, season: "SS26", rrp: 99, bought: 20, demand: 16 },
  { code: "HF-2640", name: "Rowe Piqué Polo — Navy", brandId: "hf", category: TOP, season: "SS26", rrp: 69, bought: 25, demand: 15 },
  // --- Nordvik (20 weeks, tops up core lines in 3 weeks) -------------------
  { code: "NV-2610", name: "Fjord Cotton Crew — Oat", brandId: "nv", category: KNIT, season: "SS26", rrp: 110, bought: 20, demand: 46, core: true },
  { code: "NV-2611", name: "Fjord Cotton Crew — Navy", brandId: "nv", category: KNIT, season: "SS26", rrp: 110, bought: 20, demand: 17, core: true },
  { code: "NV-2620", name: "Linnea Cotton Cardigan", brandId: "nv", category: KNIT, season: "SS26", rrp: 135, bought: 16, demand: 12 },
  { code: "NV-2630", name: "Sund Merino Tee", brandId: "nv", category: TOP, season: "SS26", rrp: 75, bought: 24, demand: 19 },
  { code: "NV-2640", name: "Halla Knitted Vest", brandId: "nv", category: KNIT, season: "SS26", rrp: 95, bought: 12, demand: 8 },
  // --- Maison Ondine (12 weeks, no in-season stock) ------------------------
  { code: "MO-2610", name: "Céline Midi Dress — Floral", brandId: "mo", category: DRESS, season: "SS26", rrp: 185, bought: 10, demand: 30 },
  { code: "MO-2611", name: "Margot Wrap Dress", brandId: "mo", category: DRESS, season: "SS26", rrp: 165, bought: 10, demand: 17 },
  { code: "MO-2620", name: "Lise Shirt Dress", brandId: "mo", category: DRESS, season: "SS26", rrp: 155, bought: 15, demand: 12 },
  { code: "MO-2630", name: "Amélie Linen Skirt", brandId: "mo", category: DRESS, season: "SS26", rrp: 120, bought: 10, demand: 8 },
  { code: "MO-2640", name: "Odile Slip Dress", brandId: "mo", category: DRESS, season: "SS26", rrp: 145, bought: 10, demand: 7 },
  // --- Ardent Denim (26 weeks, tops up core fits in 2 weeks) ---------------
  { code: "AD-2610", name: "Rigid Straight — Indigo", brandId: "ad", category: TROUSER, season: "SS26", rrp: 140, bought: 30, demand: 37, core: true },
  { code: "AD-2630", name: "Denim Chore Jacket", brandId: "ad", category: OUTER, season: "SS26", rrp: 165, bought: 12, demand: 25 },
  { code: "AD-2620", name: "Relaxed Taper — Washed Black", brandId: "ad", category: TROUSER, season: "SS26", rrp: 140, bought: 24, demand: 19, core: true },
  { code: "AD-2640", name: "Selvedge Slim — Raw", brandId: "ad", category: TROUSER, season: "SS26", rrp: 175, bought: 18, demand: 13 },
  // --- Kestrel & Co (18 weeks, no in-season stock) -------------------------
  { code: "KC-2610", name: "Harbour Waxed Jacket — SS", brandId: "kc", category: OUTER, season: "SS26", rrp: 245, bought: 8, demand: 21 },
  { code: "KC-2620", name: "Field Rain Mac", brandId: "kc", category: OUTER, season: "SS26", rrp: 210, bought: 12, demand: 10 },
  { code: "KC-2630", name: "Lightweight Gilet", brandId: "kc", category: OUTER, season: "SS26", rrp: 135, bought: 16, demand: 8 },
  { code: "KC-2640", name: "Coach Jacket — Olive", brandId: "kc", category: OUTER, season: "SS26", rrp: 175, bought: 8, demand: 6 },
  // --- Sable & Rye (24 weeks, tops up core lines in 4 weeks) ---------------
  { code: "SR-2610", name: "Tilda Leather Tote — Tan", brandId: "sr", category: ACC, season: "SS26", rrp: 195, bought: 8, demand: 26 },
  { code: "SR-2611", name: "Tilda Leather Tote — Black", brandId: "sr", category: ACC, season: "SS26", rrp: 195, bought: 10, demand: 16, core: true },
  { code: "SR-2620", name: "Woven Leather Belt", brandId: "sr", category: ACC, season: "SS26", rrp: 65, bought: 20, demand: 16 },
  { code: "SR-2630", name: "Silk Square Scarf", brandId: "sr", category: ACC, season: "SS26", rrp: 85, bought: 24, demand: 19 },
  { code: "SR-2640", name: "Canvas Weekender", brandId: "sr", category: ACC, season: "SS26", rrp: 165, bought: 6, demand: 4 },

  // ======================= AW26 — this season, week 10 traded ==============
  // It's happening again: the flannel version of the Ellis shirt.
  { code: "HF-2711", name: "Ellis Flannel Shirt — Check", brandId: "hf", category: SHIRT, season: "AW26", rrp: 105, bought: 15, demand: 44, forceSales: [3, 4, 4, 4] },
  { code: "HF-2720", name: "Merino Rollneck — Charcoal", brandId: "hf", category: KNIT, season: "AW26", rrp: 115, bought: 18, demand: 19 },
  { code: "HF-2731", name: "Cord Trouser — Tobacco", brandId: "hf", category: TROUSER, season: "AW26", rrp: 110, bought: 20, demand: 10 },
  { code: "NV-2710", name: "Fjord Lambswool Crew — Oat", brandId: "nv", category: KNIT, season: "AW26", rrp: 145, bought: 35, demand: 52, core: true },
  { code: "NV-2720", name: "Linnea Chunky Cardigan", brandId: "nv", category: KNIT, season: "AW26", rrp: 175, bought: 14, demand: 13 },
  { code: "NV-2730", name: "Sund Merino Roll Neck", brandId: "nv", category: KNIT, season: "AW26", rrp: 125, bought: 20, demand: 17, core: true },
  { code: "MO-2710", name: "Céline Velvet Midi", brandId: "mo", category: DRESS, season: "AW26", rrp: 215, bought: 12, demand: 34, forceSales: [3, 4, 3, 2] },
  { code: "MO-2720", name: "Margot Jersey Wrap", brandId: "mo", category: DRESS, season: "AW26", rrp: 175, bought: 12, demand: 12 },
  { code: "AD-2710", name: "Rigid Straight — Indigo", brandId: "ad", category: TROUSER, season: "AW26", rrp: 145, bought: 30, demand: 34, core: true },
  { code: "AD-2730", name: "Sherpa Trucker Jacket", brandId: "ad", category: OUTER, season: "AW26", rrp: 195, bought: 14, demand: 26 },
  { code: "KC-2710", name: "Harbour Waxed Jacket", brandId: "kc", category: OUTER, season: "AW26", rrp: 275, bought: 16, demand: 36 },
  { code: "KC-2720", name: "Quilted Liner Jacket", brandId: "kc", category: OUTER, season: "AW26", rrp: 165, bought: 24, demand: 11 },
  { code: "SR-2710", name: "Tilda Leather Tote — Burgundy", brandId: "sr", category: ACC, season: "AW26", rrp: 205, bought: 16, demand: 30, core: true },
  { code: "SR-2730", name: "Cashmere Blend Scarf", brandId: "sr", category: ACC, season: "AW26", rrp: 95, bought: 30, demand: 27 },
];

function simulate(seed: LineSeed): Line {
  const brand = BRAND_BY_ID[seed.brandId];
  const season = SEASONS[seed.season];
  const weeks = season.weeksTraded ?? brand.seasonWeeks;
  const curve = demandCurve(brand.seasonWeeks);
  const canTopUp = brand.topUp && !!seed.core;

  const sales: number[] = [];
  const endStock: number[] = [];
  const topUps: TopUp[] = [];
  let stock = seed.bought;
  let carry = 0; // fractional demand carried week to week so totals stay honest
  let pendingTopUp: TopUp | null = null;

  for (let w = 0; w < weeks; w++) {
    if (pendingTopUp && pendingTopUp.week === w + 1) {
      stock += pendingTopUp.qty;
      topUps.push(pendingTopUp);
      pendingTopUp = null;
    }
    let sold: number;
    if (seed.forceSales && w < seed.forceSales.length) {
      sold = Math.min(stock, seed.forceSales[w]);
    } else {
      const want = seed.demand * curve[w] * jitter(0.22) + carry;
      const whole = Math.max(0, Math.round(want));
      carry = want - whole;
      sold = Math.min(stock, whole);
    }
    stock -= sold;
    sales.push(sold);
    endStock.push(stock);
    // A core line that sells out triggers one re-order with the brand.
    if (stock === 0 && canTopUp && !pendingTopUp && topUps.length === 0) {
      const qty = Math.max(brand.sizeRun, Math.ceil((seed.bought * 0.5) / brand.sizeRun) * brand.sizeRun);
      pendingTopUp = { week: w + 2 + brand.topUpLeadWeeks, qty };
    }
  }

  return {
    id: `${seed.season}-${seed.code}`,
    code: seed.code,
    name: seed.name,
    brandId: seed.brandId,
    category: seed.category,
    season: seed.season,
    rrp: seed.rrp,
    cost: Math.round((seed.rrp / 2.5) * 100) / 100,
    bought: seed.bought,
    core: !!seed.core,
    sales,
    endStock,
    topUps,
  };
}

export const LINES: Line[] = SEEDS.map(simulate);
export const LINE_BY_ID: Record<string, Line> = Object.fromEntries(LINES.map((l) => [l.id, l]));

export const linesIn = (season: SeasonId) => LINES.filter((l) => l.season === season);

export const CATEGORIES = [...new Set(LINES.map((l) => l.category))];

/** ISO date of the Monday a season week starts (week 1 = season start). */
export function seasonWeekDate(season: SeasonId, week: number): string {
  const d = new Date(SEASONS[season].start + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + (week - 1) * 7);
  return d.toISOString().slice(0, 10);
}

/** SS27 open-to-buy agreed with the bank manager, at cost. */
export const SS27_BUDGET = 31000;
