import { useApp } from "../state/AppState";
import { SEASONS, TODAY } from "../data/dataset";
import { FORECAST_BY_ID, THIS_SEASON, seasonTotals } from "../engine/forecast";
import type { Alert, Severity } from "../engine/alerts";
import { SeasonChart } from "../components/SeasonChart";
import { Card, PageHeader, SEVERITY_META, SeverityBadge, StatTile } from "../components/ui";
import { fmtDate, fmtInt, fmtMoney } from "../lib/format";

const SECTIONS: { severity: Severity; blurb: string }[] = [
  { severity: "critical", blurb: "sold out and the brand can't restock — the demand is logged for next year" },
  { severity: "serious", blurb: "re-order this week while the brand still has stock" },
  { severity: "warning", blurb: "a decision worth making now — protect full price, or move slow stock early" },
  { severity: "good", blurb: "deliberately no action" },
];

function AlertCard({ alert, chart }: { alert: Alert; chart: boolean }) {
  const { setOpenLine } = useApp();
  const fc = FORECAST_BY_ID[alert.lineIds[0]];
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <SeverityBadge severity={alert.severity} />
          <h3 className="mt-1 text-[14px] font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
            {alert.title}
          </h3>
          <p className="mt-1.5 max-w-3xl text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {alert.detail}
          </p>
        </div>
        {alert.valueAtStake > 0 && alert.severity !== "warning" && (
          <div className="shrink-0 text-right">
            <div className="tnum text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {fmtMoney(alert.valueAtStake)}
            </div>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {alert.severity === "critical" ? "full-price sales missed" : "full-price sales protected"}
            </div>
          </div>
        )}
      </div>
      {chart && (
        <div className="mt-3">
          <SeasonChart fc={fc} height={150} />
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <details>
          <summary className="cursor-pointer text-xs font-medium" style={{ color: "var(--accent)" }}>
            Show the working
          </summary>
          <p
            className="mt-1.5 max-w-3xl rounded-lg border-l-2 py-1 pl-3 text-xs leading-relaxed"
            style={{ borderColor: "var(--baseline)", color: "var(--text-muted)" }}
          >
            {alert.working}
          </p>
        </details>
        <button type="button" className="text-xs font-medium" style={{ color: "var(--accent)" }} onClick={() => setOpenLine(fc.line.id)}>
          Open line
        </button>
      </div>
    </Card>
  );
}

export function InSeason() {
  const { alerts } = useApp();
  const t = seasonTotals("AW26");
  const season = SEASONS.AW26;
  const heading = THIS_SEASON.filter((f) => f.stockNow > 0 && f.projectedSellOutWeek !== null);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${season.label} · week ${season.weeksTraded} traded · as of ${fmtDate(TODAY.toISOString().slice(0, 10))}`}
        title="This season, while there's still time"
        sub="The same engine runs on this season's sales every week. It spots a line heading for a sell-out early enough to re-order (where the brand can restock), tells you not to discount what will sell anyway, and records the demand you can't serve so next year's order includes it."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="AW26 full-price sales so far" value={fmtMoney(t.sales)} sub={`${fmtInt(t.units)} units · ${t.lines} lines`} />
        <StatTile
          label="Already sold out"
          value={String(t.soldOut)}
          sub={`≈ ${fmtInt(t.lostUnits)} customers missed so far`}
          status={{ severity: "critical", text: "logged for AW27" }}
        />
        <StatTile
          label="Heading for a sell-out"
          value={String(heading.length)}
          sub={`${heading.filter((f) => f.canTopUp).length} the brand can restock`}
          status={{ severity: "serious", text: "act this week" }}
        />
        <StatTile
          label="Missed by season end, if nothing changes"
          value={fmtMoney(t.lostRevenueSeason)}
          sub={`≈ ${fmtInt(t.lostUnitsSeason)} customers at full price`}
        />
      </div>

      {SECTIONS.map(({ severity, blurb }) => {
        const group = alerts.filter((a) => a.severity === severity);
        if (group.length === 0) return null;
        return (
          <section key={severity}>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
              <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {SEVERITY_META[severity].label}
              </h2>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {blurb}
              </span>
            </div>
            <div className="space-y-3">
              {group.map((a) => (
                <AlertCard key={a.id} alert={a} chart={severity !== "good"} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
