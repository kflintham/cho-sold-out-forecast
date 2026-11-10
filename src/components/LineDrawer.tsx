import { useEffect } from "react";
import { useApp } from "../state/AppState";
import { NEXT_SEASON, SEASONS } from "../data/dataset";
import { FORECAST_BY_ID } from "../engine/forecast";
import { SeasonChart } from "./SeasonChart";
import { Chip, SeverityBadge } from "./ui";
import { fmtInt, fmtMoney, fmtPct } from "../lib/format";

export function LineDrawer() {
  const { openLine, setOpenLine, buyById, alerts, levers } = useApp();
  const fc = openLine ? FORECAST_BY_ID[openLine] : undefined;

  useEffect(() => {
    if (!openLine) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenLine(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openLine, setOpenLine]);

  if (!fc) return null;
  const l = fc.line;
  const buy = buyById.get(l.id);
  const alert = alerts.find((a) => a.lineIds.includes(l.id));
  const showDemand = levers.countLostDemand || !fc.finished;

  const stats = [
    { k: "Bought", v: `${l.bought}${l.topUps.length ? ` +${l.topUps[0].qty}` : ""}` },
    { k: "Sold", v: fmtInt(fc.sold) },
    { k: fc.finished ? "Sell-through" : "In stock now", v: fc.finished ? fmtPct((fc.sold / fc.supplied) * 100) : fmtInt(fc.stockNow) },
    { k: "Sold out", v: fc.soldOutWeek ? `wk ${fc.soldOutWeek} of ${fc.seasonWeeks}` : fc.projectedSellOutWeek ? `≈ wk ${fc.projectedSellOutWeek}` : "no" },
    { k: fc.finished ? "Est. demand" : "Tracking for", v: showDemand ? `≈ ${fmtInt(fc.demand)}` : fmtInt(fc.sold) },
    { k: fc.finished ? "Missed" : "Missed by season end", v: showDemand ? `${fmtInt(fc.lostUnitsSeason)} · ${fmtMoney(fc.lostUnitsSeason * l.rrp)}` : "—" },
  ];

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={`${l.name} detail`}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.35)" }} onClick={() => setOpenLine(null)} />
      <aside
        className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l p-5"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {l.code} · {SEASONS[l.season].label}
            </div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {l.name}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip tone="accent">{fc.brand.name}</Chip>
              <Chip>{l.category}</Chip>
              <Chip>£{l.rrp} RRP</Chip>
              <Chip>{fc.canTopUp ? `brand restocks · ${fc.brand.topUpLeadWeeks} wks` : "no in-season restock"}</Chip>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpenLine(null)}
            aria-label="Close"
            className="rounded-md border px-2 py-1 text-xs"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            Esc
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          {stats.map((x) => (
            <div key={x.k} className="rounded-lg border p-2" style={{ borderColor: "var(--border)" }}>
              <dt className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {x.k}
              </dt>
              <dd className="tnum mt-0.5 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {x.v}
              </dd>
            </div>
          ))}
        </dl>

        <h3 className="mt-5 mb-1 text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
          The season, week by week
        </h3>
        <SeasonChart fc={fc} showMissed={showDemand} height={190} />

        {buy && (
          <div className="mt-5 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
            <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              {NEXT_SEASON.id}: buy {fmtInt(buy.recommended)}
              <span className="font-normal" style={{ color: "var(--text-secondary)" }}>
                {" "}
                · usual rule {fmtInt(buy.usualRule)} · {fmtMoney(buy.cost)} at cost
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {fc.soldOutWeek !== null && levers.countLostDemand
                ? `Likely range ${fmtInt(buy.recommendedLow)}–${fmtInt(buy.recommendedHigh)} depending on which sister line's season shape it follows.`
                : "Didn't sell out — planned on what actually sold, so slow stock isn't re-bought."}
              {buy.capped ? ` Capped at ×${levers.maxStepUp} last season's buy — lift the cap in Levers.` : ""}
            </p>
          </div>
        )}

        {alert && (
          <div className="mt-5 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
            <SeverityBadge severity={alert.severity} />
            <div className="mt-1 text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
              {alert.title}
            </div>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {alert.detail}
            </p>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {alert.working}
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
