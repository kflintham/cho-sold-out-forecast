export const fmtInt = (n: number): string => Math.round(n).toLocaleString("en-GB");

export function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `£${(n / 1000).toFixed(1)}k`;
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

export const fmtMoneyFull = (n: number): string => `£${Math.round(n).toLocaleString("en-GB")}`;

export const fmtWeeks = (n: number | null): string =>
  n === null ? "—" : `${(Math.round(n * 10) / 10).toLocaleString("en-GB")} wks`;

export const fmtPct = (n: number): string => `${Math.round(n)}%`;

export const fmtDate = (iso: string): string =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
