/**
 * The levers are the buying rules the shop controls without calling us —
 * how much of the missed demand to back, the sell-through you plan for, how
 * cautious to be on a big step-up. Every screen recomputes when one moves.
 */

export interface Levers {
  /** count the demand a sell-out hid (off = plan from till sales only) */
  countLostDemand: boolean;
  /** share of the estimated missed demand to back next season, % */
  lostDemandShare: number;
  /** full-price sell-through the buy is planned to achieve, % */
  targetSellThrough: number;
  /** apply each brand's momentum to next season */
  applyTrend: boolean;
  /** never step a line up by more than this multiple of last buy (0 = no cap) */
  maxStepUp: number;
  /** round buys to whole size runs */
  roundToSizeRun: boolean;
  /** the shop's rule of thumb today: last buy + this % when a line sold out */
  usualRulePct: number;
  /** SS27 open-to-buy, at cost */
  budget: number;
  /** count customers waiting for a sold-out line as demand on a re-order */
  countWaiting: boolean;
  /** stock older than this is flagged as aged, days */
  agedDays: number;
}

export const DEFAULT_LEVERS: Levers = {
  countLostDemand: true,
  lostDemandShare: 75,
  targetSellThrough: 90,
  applyTrend: true,
  maxStepUp: 3,
  roundToSizeRun: true,
  usualRulePct: 40,
  budget: 31000,
  countWaiting: true,
  agedDays: 180,
};

export const AGED_OPTIONS = [
  { value: 120, label: "120 days" },
  { value: 180, label: "180 days" },
  { value: 270, label: "270 days" },
];

export const LOST_SHARE_OPTIONS = [
  { value: 50, label: "50%" },
  { value: 75, label: "75%" },
  { value: 100, label: "100%" },
];

export const SELL_THROUGH_OPTIONS = [
  { value: 80, label: "80%" },
  { value: 85, label: "85%" },
  { value: 90, label: "90%" },
  { value: 100, label: "100%" },
];

export const STEP_UP_OPTIONS = [
  { value: 2, label: "×2" },
  { value: 3, label: "×3" },
  { value: 0, label: "No cap" },
];

export const USUAL_RULE_OPTIONS = [
  { value: 25, label: "+25%" },
  { value: 40, label: "+40%" },
  { value: 60, label: "+60%" },
];
