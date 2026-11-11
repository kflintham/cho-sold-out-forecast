import { useMemo } from "react";
import { useApp } from "../state/AppState";
import { BRANDS, NEXT_SEASON, TODAY } from "../data/dataset";
import { FORECAST_BY_ID, LAST_SEASON, THIS_SEASON, seasonTotals } from "../engine/forecast";
import { GroupedColumns } from "../components/charts";
import { Card, PageHeader, SeverityIcon, StatTile } from "../components/ui";
import { SeasonChart } from "../components/SeasonChart";
import { SeasonBar } from "./SoldOut";
import { OverviewStock } from "./OverviewStock";
import { fmtDate, fmtInt, fmtMoney, fmtPct } from "../lib/format";

const kFmt = (v: number) => `£${v.toFixed(1)}k`;

export function Overview() {
  const { setView, setFocusLine, buyPlan, setOpenLine } = useApp();
  const ss = seasonTotals("SS26");
  const aw = seasonTotals("AW26");
  const awHeading = THIS_SEASON.filter((f) => f.stockNow > 0 && f.projectedSellOutWeek !== null).length;

  const byBrand = useMemo(
    () =>
      BRANDS.map((b) => {
        const fcs = LAST_SEASON.filter((f) => f.brand.id === b.id);
        return {
          label: b.name,
          values: [fcs.reduce((a, f) => a + f.sold * f.line.rrp, 0) / 1000, fcs.reduce((a, f) => a + f.lostRevenue, 0) / 1000],
        };
      }),
    [],
  );

  const top = useMemo(
    // Branded lines only — own label is optional and has its own screen.
    () => LAST_SEASON.filter((f) => f.lostUnits > 0 && !f.brand.ownLabel).sort((a, b) => b.lostRevenue - a.lostRevenue).slice(0, 6),
    [],
  );

  const again = FORECAST_BY_ID["AW26-HF-2711"];
  const lastYear = FORECAST_BY_ID["SS26-HF-2611"];
  const planTotal = buyPlan.reduce((a, b) => a + b.cost, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={`Overview · as of ${fmtDate(TODAY.toISOString().slice(0, 10))}`}
        title="Where sell-outs are costing you"
        sub="Last season's sales, the demand the sell-outs hid, and what's happening this season — from one view of the stores' tills, the website and the stock file."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="SS26 full-price sales" value={fmtMoney(ss.sales)} sub={`${fmtInt(ss.units)} units · ${fmtPct(ss.sellThrough)} sell-through`} />
        <StatTile
          label="Lines that sold out early"
          value={`${ss.soldOut} of ${ss.lines}`}
          sub={`on average ${fmtPct(ss.avgSoldOutShare * 100)} of the way through their season`}
        />
        <StatTile
          label="SS26 sales missed after a sell-out"
          value={fmtMoney(ss.lostRevenue)}
          sub={`≈ ${fmtInt(ss.lostUnits)} customers at full price`}
          status={{ severity: "critical", text: "invisible in till reports" }}
        />
        <StatTile
          label="AW26 so far"
          value={`${aw.soldOut} sold out`}
          sub={`${awHeading} more heading that way · ${fmtMoney(aw.lostRevenue)} missed to date`}
          status={{ severity: "serious", text: "see Advisories" }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Sold vs missed, by brand — SS26" subtitle="full-price sales and the estimated sales lost once lines sold out, £ thousands">
          <GroupedColumns
            groups={byBrand}
            seriesNames={["Sold", "Missed after sell-out"]}
            colorVars={["--series-1", "--series-2"]}
            format={kFmt}
            height={230}
          />
        </Card>

        <Card className="xl:col-span-2" title="Biggest missed opportunities" subtitle="SS26 · click to see how the number was worked out">
          <ul className="divide-y" style={{ borderColor: "var(--grid)" }}>
            {top.map((f) => (
              <li key={f.line.id} style={{ borderColor: "var(--grid)" }}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 py-2 text-left text-xs hover:opacity-80"
                  onClick={() => {
                    setFocusLine(f.line.id);
                    setView("soldout");
                  }}
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold" style={{ color: "var(--text-primary)" }}>
                      {f.line.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                      <span className="truncate">{f.brand.name} · bought {f.line.bought}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <SeasonBar fc={f} />
                    <span className="tnum w-14 text-right font-semibold" style={{ color: "var(--text-primary)" }}>
                      {fmtMoney(f.lostRevenue)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <div className="flex items-start gap-3">
          <SeverityIcon severity="critical" size={18} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              It's happening again: {again.line.name} sold out in week {again.soldOutWeek} of {again.seasonWeeks}
            </div>
            <p className="mt-0.5 max-w-3xl text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Last spring the linen version went in week {lastYear.soldOutWeek} with ≈{fmtInt(lastYear.demand)} customers wanting it
              against {lastYear.line.bought} bought. This autumn {again.line.bought} were bought and they've gone just as fast —
              the system has flagged it and is counting the missed demand for next year's order.
            </p>
            <div className="mt-3">
              <SeasonChart fc={again} height={150} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 text-xs font-medium">
              <button type="button" style={{ color: "var(--accent)" }} onClick={() => setView("advisories")}>
                See everything this season →
              </button>
              <button type="button" style={{ color: "var(--accent)" }} onClick={() => setOpenLine(again.line.id)}>
                Open this line
              </button>
            </div>
          </div>
        </div>
      </Card>

      <OverviewStock />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              {NEXT_SEASON.id} buy plan ready — {fmtMoney(planTotal)} at cost across {BRANDS.length} brands
            </div>
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
              Built on what customers wanted last spring, not just what sold. First order book closes{" "}
              {fmtDate([...BRANDS].sort((a, b) => a.orderDeadline.localeCompare(b.orderDeadline))[0].orderDeadline)}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setView("buy")}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            Open the buy plan
          </button>
        </div>
      </Card>
    </div>
  );
}
