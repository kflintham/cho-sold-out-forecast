/**
 * Synthetic demo dataset — a multi-brand fashion retailer — online and stores — buying seasonal
 * collections from its brands.
 *
 * Everything here is invented: brands, styles, prices and numbers. Weekly
 * sales are simulated from a hidden "true demand" per line, then capped by
 * the stock that was actually there — exactly how a sell-out hides demand in
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
  /** weeks from a re-order to it landing in stock */
  topUpLeadWeeks: number;
  /** order book closes for SS27 */
  orderDeadline: string;
  /** units in one size run — the smallest sensible order step */
  sizeRun: number;
  sizes: string;
  /** brand momentum applied to next season's plan */
  trend: number;
  /** the retailer's own label — designed in house, made at its factories */
  ownLabel?: boolean;
}

export const BRANDS: Brand[] = [
  { id: "hf", name: "Harlow & Finch", base: "London", focus: "Shirts & casualwear", seasonWeeks: 16, topUp: false, topUpLeadWeeks: 0, orderDeadline: "2026-11-27", sizeRun: 5, sizes: "S–XXL", trend: 0.08 },
  { id: "nv", name: "Nordvik", base: "Copenhagen", focus: "Knitwear", seasonWeeks: 20, topUp: true, topUpLeadWeeks: 3, orderDeadline: "2026-12-04", sizeRun: 4, sizes: "S–XL", trend: 0.05 },
  { id: "mo", name: "Maison Ondine", base: "Paris", focus: "Dresses & womenswear", seasonWeeks: 12, topUp: false, topUpLeadWeeks: 0, orderDeadline: "2026-11-20", sizeRun: 5, sizes: "8–16", trend: 0.12 },
  { id: "ad", name: "Ardent Denim", base: "Leeds", focus: "Denim", seasonWeeks: 26, topUp: true, topUpLeadWeeks: 2, orderDeadline: "2026-12-11", sizeRun: 6, sizes: "28–38", trend: 0.03 },
  { id: "kc", name: "Kestrel & Co", base: "Northumberland", focus: "Outerwear", seasonWeeks: 18, topUp: false, topUpLeadWeeks: 0, orderDeadline: "2026-11-25", sizeRun: 4, sizes: "S–XL", trend: 0 },
  { id: "sr", name: "Sable & Rye", base: "Bath", focus: "Bags & accessories", seasonWeeks: 24, topUp: true, topUpLeadWeeks: 4, orderDeadline: "2026-12-18", sizeRun: 1, sizes: "one size", trend: 0.1 },
  // Optional: shown so the team can see the factory side if they run a label of their own.
  { id: "own", name: "Own label", base: "Designed in house", focus: "Core essentials", seasonWeeks: 22, topUp: true, topUpLeadWeeks: 10, orderDeadline: "2026-12-07", sizeRun: 6, sizes: "XS–XXL", trend: 0.15, ownLabel: true },
];

// ---------------------------------------------------------------------------
// Own-label factories. Repeat production is possible, but only at the
// factory's lead time and minimum order — a sell-out can't be fixed in a week.
// ---------------------------------------------------------------------------

export type FreightMode = "sea" | "road" | "van";

export interface Factory {
  id: string;
  name: string;
  location: string;
  leadWeeks: number;
  mode: FreightMode;
  /** minimum units per style and colour */
  moq: number;
}

export const FACTORIES: Factory[] = [
  { id: "nb", name: "Factory A", location: "Ningbo, China", leadWeeks: 14, mode: "sea", moq: 150 },
  { id: "pt", name: "Factory B", location: "Porto, Portugal", leadWeeks: 8, mode: "road", moq: 90 },
  { id: "lc", name: "Factory C", location: "Leicester, UK", leadWeeks: 4, mode: "van", moq: 30 },
];

export const FACTORY_BY_ID: Record<string, Factory> = Object.fromEntries(FACTORIES.map((f) => [f.id, f]));

export const BRAND_BY_ID: Record<string, Brand> = Object.fromEntries(BRANDS.map((b) => [b.id, b]));

// ---------------------------------------------------------------------------
// Where the business sells — the website and two stores.
// ---------------------------------------------------------------------------

export type LocationId = "main" | "second" | "online";

export interface Location {
  id: LocationId;
  name: string;
  short: string;
}

export const LOCATIONS: Location[] = [
  { id: "main", name: "Flagship store", short: "Flagship" },
  { id: "second", name: "Second store", short: "Second" },
  { id: "online", name: "Online", short: "Online" },
];

export const LOCATION_IDS: LocationId[] = ["main", "second", "online"];

/** Share of each season's sales by location — online keeps growing. */
const SEASON_LOC_SHARE: Record<SeasonId, Record<LocationId, number>> = {
  SS26: { main: 0.34, second: 0.2, online: 0.46 },
  AW26: { main: 0.3, second: 0.18, online: 0.52 },
};

export type ByLocation = Record<LocationId, number>;

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
  /** this line's share of sales by location */
  locShare: ByLocation;
  /** units sold per week, by location */
  salesByLoc: Record<LocationId, number[]>;
  /** stock left now (or at season end), by location */
  stockByLoc: ByLocation;
  /** own label: the factory that makes it */
  factoryId?: string;
  /** own label: units per shipping carton and the carton's volume, m³ */
  cartonQty?: number;
  cartonM3?: number;
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
  /** nudges to the season's location mix, e.g. a line that sells online */
  loc?: Partial<ByLocation>;
  /** where the remaining stock actually sits (must sum to stock left) */
  stockLoc?: ByLocation;
  factoryId?: string;
  cartonQty?: number;
  cartonM3?: number;
}

const SHIRT = "Shirts";
const KNIT = "Knitwear";
const DRESS = "Dresses & skirts";
const TROUSER = "Trousers & denim";
const OUTER = "Outerwear";
const ACC = "Bags & accessories";
const TOP = "Tops & polos";
const OL = { brandId: "own", core: true };

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
  { code: "AD-2710", name: "Rigid Straight — Indigo", brandId: "ad", category: TROUSER, season: "AW26", rrp: 145, bought: 30, demand: 34, core: true, stockLoc: { main: 1, second: 9, online: 2 } },
  { code: "AD-2720", name: "Relaxed Taper — Washed Black", brandId: "ad", category: TROUSER, season: "AW26", rrp: 145, bought: 18, demand: 32, core: true },
  { code: "AD-2730", name: "Sherpa Trucker Jacket", brandId: "ad", category: OUTER, season: "AW26", rrp: 195, bought: 14, demand: 26 },
  { code: "KC-2710", name: "Harbour Waxed Jacket", brandId: "kc", category: OUTER, season: "AW26", rrp: 275, bought: 16, demand: 36 },
  { code: "KC-2720", name: "Quilted Liner Jacket", brandId: "kc", category: OUTER, season: "AW26", rrp: 165, bought: 24, demand: 11 },
  { code: "SR-2710", name: "Tilda Leather Tote — Burgundy", brandId: "sr", category: ACC, season: "AW26", rrp: 205, bought: 16, demand: 30, core: true },
  { code: "SR-2730", name: "Cashmere Blend Scarf", brandId: "sr", category: ACC, season: "AW26", rrp: 95, bought: 30, demand: 27, loc: { online: 0.7 } },

  // ======================= Own label (optional) ============================
  { code: "OL-2610", name: "Organic Cotton Tee — White", ...OL, category: TOP, season: "SS26", rrp: 30, bought: 120, demand: 150, factoryId: "pt", cartonQty: 10, cartonM3: 0.02 },
  { code: "OL-2611", name: "Organic Cotton Tee — Black", ...OL, category: TOP, season: "SS26", rrp: 30, bought: 120, demand: 104, factoryId: "pt", cartonQty: 10, cartonM3: 0.02 },
  { code: "OL-2620", name: "Relaxed Linen Trouser — Sand", ...OL, core: false, category: TROUSER, season: "SS26", rrp: 65, bought: 60, demand: 150, factoryId: "nb", cartonQty: 12, cartonM3: 0.045 },
  { code: "OL-2640", name: "Merino Crew — Navy", ...OL, core: false, category: KNIT, season: "SS26", rrp: 70, bought: 150, demand: 112, factoryId: "nb", cartonQty: 12, cartonM3: 0.05 },
  { code: "OL-2630", name: "Washed Twill Overshirt", ...OL, core: false, category: SHIRT, season: "SS26", rrp: 75, bought: 40, demand: 33, factoryId: "lc", cartonQty: 6, cartonM3: 0.035 },
  { code: "OL-2710", name: "Heavyweight Hoodie — Charcoal", ...OL, category: KNIT, season: "AW26", rrp: 75, bought: 90, demand: 170, factoryId: "pt", cartonQty: 10, cartonM3: 0.055 },
  { code: "OL-2720", name: "Organic Cotton Tee — White", ...OL, category: TOP, season: "AW26", rrp: 30, bought: 120, demand: 104, factoryId: "pt", cartonQty: 10, cartonM3: 0.02 },
  { code: "OL-2730", name: "Wool Blend Overshirt", ...OL, core: false, category: SHIRT, season: "AW26", rrp: 95, bought: 60, demand: 28, factoryId: "lc", cartonQty: 6, cartonM3: 0.04 },
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
      pendingTopUp = { week: w + 2 + (seed.factoryId ? FACTORY_BY_ID[seed.factoryId].leadWeeks : brand.topUpLeadWeeks), qty };
    }
  }

  // Location split: a season's mix, nudged per line, then each week's units
  // handed out to whichever location is furthest behind its share.
  const mix = { ...SEASON_LOC_SHARE[seed.season], ...seed.loc };
  const mixTotal = LOCATION_IDS.reduce((a, id) => a + mix[id], 0);
  const locShare = Object.fromEntries(LOCATION_IDS.map((id) => [id, mix[id] / mixTotal])) as ByLocation;
  const salesByLoc = { main: [], second: [], online: [] } as Record<LocationId, number[]>;
  const cum: ByLocation = { main: 0, second: 0, online: 0 };
  let cumTotal = 0;
  for (const units of sales) {
    const week: ByLocation = { main: 0, second: 0, online: 0 };
    for (let u = 0; u < units; u++) {
      cumTotal += 1;
      const pick = LOCATION_IDS.reduce((best, id) =>
        cumTotal * locShare[id] - cum[id] > cumTotal * locShare[best] - cum[best] ? id : best,
      );
      cum[pick] += 1;
      week[pick] += 1;
    }
    LOCATION_IDS.forEach((id) => salesByLoc[id].push(week[id]));
  }
  const stockByLoc = seed.stockLoc ?? splitByShare(stock, locShare);

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
    locShare,
    salesByLoc,
    stockByLoc,
    factoryId: seed.factoryId,
    cartonQty: seed.cartonQty,
    cartonM3: seed.cartonM3,
  };
}

/** Split whole units by share (largest remainder). */
export function splitByShare(units: number, share: ByLocation): ByLocation {
  const raw = LOCATION_IDS.map((id) => units * share[id]);
  const out = raw.map(Math.floor);
  let left = units - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) if (left-- > 0) out[i] += 1;
  return { main: out[0], second: out[1], online: out[2] };
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
export const SS27_BUDGET = 46000;

// ---------------------------------------------------------------------------
// Customers waiting — "notify me when back" sign-ups online and requests
// taken in store, per AW26 line. In production these come from the
// Shopify back-in-stock app and the EPOS customer-order screen.
// ---------------------------------------------------------------------------

export interface Waitlist {
  online: number;
  inStore: number;
}

export const WAITLIST: Record<string, Waitlist> = {
  "AW26-HF-2711": { online: 11, inStore: 7 },
  "AW26-MO-2710": { online: 6, inStore: 3 },
  "AW26-KC-2710": { online: 8, inStore: 4 },
  "AW26-NV-2710": { online: 2, inStore: 1 },
  "AW26-SR-2710": { online: 3, inStore: 1 },
};

export const waitingFor = (lineId: string) => {
  const w = WAITLIST[lineId];
  return w ? w.online + w.inStore : 0;
};

// ---------------------------------------------------------------------------
// Open re-orders with brands (stock bought, not yet in stock).
// ---------------------------------------------------------------------------

export type ReorderStage = "placed" | "confirmed" | "dispatched";

export const REORDER_STAGES: ReorderStage[] = ["placed", "confirmed", "dispatched"];

export const REORDER_STAGE_LABEL: Record<ReorderStage, string> = {
  placed: "Order placed",
  confirmed: "Confirmed by brand",
  dispatched: "Dispatched",
};

export interface Reorder {
  id: string;
  ref: string;
  lineId: string;
  qty: number;
  /** AW26 season week it lands in stock */
  landsWeek: number;
  stage: ReorderStage;
}

export const REORDERS: Reorder[] = [
  // Covers AD-2720's coming gap — the "already on its way, don't re-order" story.
  { id: "ro-1", ref: "RO-118", lineId: "AW26-AD-2720", qty: 12, landsWeek: 12, stage: "dispatched" },
  { id: "ro-2", ref: "RO-121", lineId: "AW26-NV-2730", qty: 4, landsWeek: 14, stage: "confirmed" },
];

// ---------------------------------------------------------------------------
// Older stock still on hand from previous seasons (SS26 leftovers are
// derived from the sales data; these are older).
// ---------------------------------------------------------------------------

export interface CarryOver {
  id: string;
  code: string;
  name: string;
  brandId: string;
  category: string;
  season: string;
  rrp: number;
  cost: number;
  stockByLoc: ByLocation;
  /** days since the stock was delivered */
  ageDays: number;
}

export const CARRY_OVER: CarryOver[] = [
  { id: "AW25-KC-2520", code: "KC-2520", name: "Quilted Gilet — Moss", brandId: "kc", category: OUTER, season: "AW25", rrp: 150, cost: 60, stockByLoc: { main: 1, second: 5, online: 0 }, ageDays: 420 },
  { id: "AW25-NV-2530", code: "NV-2530", name: "Shawl Collar Cardigan", brandId: "nv", category: KNIT, season: "AW25", rrp: 165, cost: 66, stockByLoc: { main: 3, second: 0, online: 1 }, ageDays: 395 },
  { id: "AW25-MO-2540", code: "MO-2540", name: "Velvet Slip Dress — Navy", brandId: "mo", category: DRESS, season: "AW25", rrp: 150, cost: 60, stockByLoc: { main: 0, second: 1, online: 2 }, ageDays: 380 },
];

// ---------------------------------------------------------------------------
// Brand scorecard — delivery performance is seeded here (in production it
// reconciles from delivery notes against order confirmations); sell-through
// and sell-out rates are computed live.
// ---------------------------------------------------------------------------

export interface BrandPerformance {
  /** share of deliveries on time and in full, % */
  otifPct: number;
  avgDaysLate: number;
  /** share of ordered units actually delivered, % */
  completePct: number;
  /** re-order value (at cost) for carriage-paid delivery */
  carriagePaidMin: number;
  note: string;
}

export const BRAND_PERFORMANCE: Record<string, BrandPerformance> = {
  hf: { otifPct: 92, avgDaysLate: 3, completePct: 98, carriagePaidMin: 0, note: "AW26 delivered 4 days early" },
  nv: { otifPct: 84, avgDaysLate: 6, completePct: 95, carriagePaidMin: 400, note: "AW26 drop 2 short-shipped in M" },
  mo: { otifPct: 71, avgDaysLate: 12, completePct: 90, carriagePaidMin: 0, note: "SS26 and AW26 both landed late — 2 full-price weeks lost each time" },
  ad: { otifPct: 96, avgDaysLate: 1, completePct: 100, carriagePaidMin: 350, note: "re-orders in 2 weeks, reliably" },
  kc: { otifPct: 88, avgDaysLate: 5, completePct: 97, carriagePaidMin: 0, note: "none this season" },
  sr: { otifPct: 94, avgDaysLate: 2, completePct: 99, carriagePaidMin: 300, note: "none this season" },
};

// ---------------------------------------------------------------------------
// SS27 delivery drops — when each brand ships the season, and how much of
// the order comes in each drop.
// ---------------------------------------------------------------------------

export interface Drop {
  label: string;
  date: string;
  share: number;
}

export const SS27_DROPS: Record<string, Drop[]> = {
  hf: [{ label: "Drop 1", date: "2027-02-08", share: 0.6 }, { label: "Drop 2", date: "2027-03-22", share: 0.4 }],
  nv: [{ label: "Drop 1", date: "2027-02-15", share: 0.5 }, { label: "Drop 2", date: "2027-04-05", share: 0.5 }],
  mo: [{ label: "Single drop", date: "2027-03-01", share: 1 }],
  ad: [{ label: "Core", date: "2027-01-25", share: 0.7 }, { label: "Seasonal", date: "2027-03-08", share: 0.3 }],
  kc: [{ label: "Single drop", date: "2027-02-22", share: 1 }],
  sr: [{ label: "Drop 1", date: "2027-02-01", share: 0.5 }, { label: "Drop 2", date: "2027-04-12", share: 0.5 }],
};

// ---------------------------------------------------------------------------
// Order timeline — the SS27 orders, stage by stage. The rule that matters:
// nothing is placed with a brand until its budget is signed off.
// ---------------------------------------------------------------------------

export type CpStatus = "done" | "in-progress" | "pending" | "blocked";

export interface CpStage {
  label: string;
  status: CpStatus;
  /** ISO date — actual for done stages, target for the rest */
  date?: string;
  note?: string;
}

export interface OrderTimeline {
  id: string;
  title: string;
  brandId?: string;
  ref?: string;
  stages: CpStage[];
  /** added by the user in this session (removable) */
  custom?: boolean;
}

export const CP_STAGE_LABELS = [
  "Showroom",
  "Budget signed off",
  "Order placed",
  "Confirmed by brand",
  "Dispatched",
  "Delivered",
  "Live in stores & online",
] as const;

export const ORDER_TIMELINES: OrderTimeline[] = [
  {
    id: "cp-mo",
    title: "Maison Ondine — SS27 collection",
    brandId: "mo",
    stages: [
      { label: "Showroom", status: "done", date: "2026-10-20", note: "Paris" },
      { label: "Budget signed off", status: "done", date: "2026-11-06" },
      { label: "Order placed", status: "in-progress", date: "2026-11-20", note: "book closes 20 Nov" },
      { label: "Confirmed by brand", status: "pending", date: "2026-12-04" },
      { label: "Dispatched", status: "pending", date: "2027-02-22" },
      { label: "Delivered", status: "pending", date: "2027-03-01" },
      { label: "Live in stores & online", status: "pending", date: "2027-03-03" },
    ],
  },
  {
    id: "cp-kc",
    title: "Kestrel & Co — SS27 collection",
    brandId: "kc",
    stages: [
      { label: "Showroom", status: "done", date: "2026-10-28", note: "agent visit" },
      { label: "Budget signed off", status: "blocked", note: "outerwear plan is over its share of budget — trim or move money first" },
      { label: "Order placed", status: "pending", date: "2026-11-25" },
      { label: "Confirmed by brand", status: "pending" },
      { label: "Dispatched", status: "pending" },
      { label: "Delivered", status: "pending", date: "2027-02-22" },
      { label: "Live in stores & online", status: "pending" },
    ],
  },
  {
    id: "cp-hf",
    title: "Harlow & Finch — SS27 collection",
    brandId: "hf",
    stages: [
      { label: "Showroom", status: "done", date: "2026-11-03", note: "London" },
      { label: "Budget signed off", status: "in-progress", note: "sold-out lines stepped up — check before Thursday" },
      { label: "Order placed", status: "pending", date: "2026-11-27" },
      { label: "Confirmed by brand", status: "pending" },
      { label: "Dispatched", status: "pending" },
      { label: "Delivered", status: "pending", date: "2027-02-08" },
      { label: "Live in stores & online", status: "pending" },
    ],
  },
  {
    id: "cp-ro118",
    title: "Ardent Denim — AW26 re-order, Relaxed Taper",
    brandId: "ad",
    ref: "RO-118",
    stages: [
      { label: "Showroom", status: "done", note: "n/a — re-order" },
      { label: "Budget signed off", status: "done", date: "2026-10-30" },
      { label: "Order placed", status: "done", date: "2026-10-30" },
      { label: "Confirmed by brand", status: "done", date: "2026-11-02" },
      { label: "Dispatched", status: "in-progress", date: "2026-11-11", note: "with the courier" },
      { label: "Delivered", status: "pending", date: "2026-11-16" },
      { label: "Live in stores & online", status: "pending", date: "2026-11-17" },
    ],
  },
];

BRAND_PERFORMANCE.own = { otifPct: 82, avgDaysLate: 9, completePct: 96, carriagePaidMin: 0, note: "factory side — see Own label & factories" };
SS27_DROPS.own = [{ label: "Drop 1", date: "2027-02-01", share: 0.55 }, { label: "Drop 2", date: "2027-03-29", share: 0.45 }];

// ---------------------------------------------------------------------------
// Own-label production orders, from approved sample to the warehouse. The
// sea-freight ones show on the shipping globe.
// ---------------------------------------------------------------------------

export type PoStage = "approved-sample" | "in-production" | "fob" | "on-water" | "customs";

export const PO_STAGES: PoStage[] = ["approved-sample", "in-production", "fob", "on-water", "customs"];

export const PO_STAGE_LABEL: Record<PoStage, string> = {
  "approved-sample": "Sample approved",
  "in-production": "In production",
  fob: "Ready to ship (FOB)",
  "on-water": "On the water",
  customs: "Customs",
};

export interface ProductionPo {
  id: string;
  ref: string;
  factoryId: string;
  cargo: string;
  qty: number;
  etaWeeks: number;
  status: PoStage;
  /** forecast line it tops up this season, if any */
  lineId?: string;
  /** AW26 season week it lands, for lines tracked this season */
  landsWeek?: number;
  vessel?: string;
}

export const PRODUCTION_POS: ProductionPo[] = [
  { id: "po-1", ref: "PO-3098", factoryId: "nb", cargo: "Merino Crew — Navy (AW26 replenishment)", qty: 192, etaWeeks: 3, status: "on-water", vessel: "MV Jade Harbour" },
  { id: "po-2", ref: "PO-3099", factoryId: "nb", cargo: "Waffle Knit Beanie (AW26 accessories)", qty: 480, etaWeeks: 1, status: "customs", vessel: "MV Northern Lark" },
  { id: "po-3", ref: "PO-3100", factoryId: "nb", cargo: "Recycled Puffer Jacket (AW26 late drop)", qty: 144, etaWeeks: 6, status: "fob", vessel: "MV Coral Meridian" },
  { id: "po-4", ref: "PO-3101", factoryId: "nb", cargo: "Relaxed Linen Trouser — Sand (SS27)", qty: 312, etaWeeks: 12, status: "in-production" },
  { id: "po-5", ref: "PO-3107", factoryId: "pt", cargo: "Heavyweight Hoodie — Charcoal (AW26 repeat)", qty: 90, etaWeeks: 0, status: "customs", lineId: "AW26-OL-2710", landsWeek: 11 },
  { id: "po-6", ref: "PO-3108", factoryId: "pt", cargo: "Organic Cotton Tee range (SS27)", qty: 360, etaWeeks: 11, status: "approved-sample" },
];

export interface FactoryPerformance {
  otifPct: number;
  avgLeadActualWeeks: number;
  delaysOver7d: number;
  qualityNote: string;
}

export const FACTORY_PERFORMANCE: Record<string, FactoryPerformance> = {
  nb: { otifPct: 86, avgLeadActualWeeks: 15.2, delaysOver7d: 2, qualityNote: "1 minor — shade variance on navy, accepted at 5% off" },
  pt: { otifPct: 95, avgLeadActualWeeks: 8.3, delaysOver7d: 0, qualityNote: "none this quarter" },
  lc: { otifPct: 98, avgLeadActualWeeks: 4.1, delaysOver7d: 0, qualityNote: "none this quarter" },
};

/** The factory-side stage sequence an own-label order walks through. */
export const OWN_LABEL_STAGE_LABELS = [
  "Design approved",
  "Sample approved",
  "Fabric booked",
  "Factory production",
  "Ready to ship",
  "Shipped",
  "Warehouse ETA",
  "Live in stores & online",
] as const;

ORDER_TIMELINES.push(
  {
    id: "cp-ol-1",
    title: "Own label — SS27 Relaxed Linen Trouser",
    brandId: "own",
    ref: "PO-3101",
    stages: [
      { label: "Design approved", status: "done", date: "2026-08-21" },
      { label: "Sample approved", status: "done", date: "2026-09-18" },
      { label: "Fabric booked", status: "done", date: "2026-09-25" },
      { label: "Factory production", status: "in-progress", note: "40% complete" },
      { label: "Ready to ship", status: "pending", date: "2026-12-18" },
      { label: "Shipped", status: "pending", date: "2026-12-22", note: "sea, Ningbo" },
      { label: "Warehouse ETA", status: "pending", date: "2027-01-29" },
      { label: "Live in stores & online", status: "pending", date: "2027-02-01" },
    ],
  },
  {
    id: "cp-ol-2",
    title: "Own label — SS27 Organic Cotton Tee range",
    brandId: "own",
    ref: "PO-3108",
    stages: [
      { label: "Design approved", status: "done", date: "2026-09-04" },
      { label: "Sample approved", status: "blocked", note: "second fit sample due — production can't start until it's signed off" },
      { label: "Fabric booked", status: "pending" },
      { label: "Factory production", status: "pending" },
      { label: "Ready to ship", status: "pending" },
      { label: "Shipped", status: "pending", note: "road, Porto" },
      { label: "Warehouse ETA", status: "pending", date: "2027-01-29" },
      { label: "Live in stores & online", status: "pending", date: "2027-02-01" },
    ],
  },
);
