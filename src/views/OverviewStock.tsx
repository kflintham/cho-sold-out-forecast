import { useMemo, useState } from "react";
import { useApp } from "../state/AppState";
import {
  BRANDS,
  BRAND_BY_ID,
  CATEGORIES,
  LINES,
  LOCATIONS,
  LOCATION_IDS,
  SEASONS,
  TODAY,
  type LocationId,
} from "../data/dataset";
import { LAST_SEASON, THIS_SEASON } from "../engine/forecast";
import {
  ABC_META,
  HEALTH_META,
  abcClasses,
  ageBuckets,
  clearanceRoutes,
  stockItems,
  type HealthBand,
  type StockItem,
} from "../engine/stock";
import { AreaTrend, HStackBar } from "../components/charts";
import { Card, Chip, Segmented, SeverityBadge, StatTile } from "../components/ui";
import { fmtInt, fmtMoney, fmtPct } from "../lib/format";

const SLOTS = ["--series-1", "--series-2", "--series-3", "--series-4", "--series-5"];
const LOC_SLOT: Record<LocationId, string> = { main: "--series-4", second: "--series-3", online: "--series-5" };
const DAY = 86400000;
const CAL_START = new Date(SEASONS.SS26.start + "T00:00:00Z").getTime();
const CAL_WEEKS = Math.floor((TODAY.getTime() - CAL_START) / (7 * DAY));

const monthLabel = (i: number) =>
  new Date(CAL_START + i * 7 * DAY).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-lg border px-2 py-1.5 text-xs"
        style={{
          borderColor: value === "all" ? "var(--border)" : "var(--accent)",
          background: "var(--surface-1)",
          color: "var(--text-primary)",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const units = (s: StockItem, loc: LocationId | "all") => (loc === "all" ? s.units : s.stockByLoc[loc]);

export function OverviewStock() {
  const { levers, alerts, setView, setOpenLine } = useApp();
  const [brand, setBrand] = useState("all");
  const [category, setCategory] = useState("all");
  const [loc, setLoc] = useState<LocationId | "all">("all");
  const [splitBy, setSplitBy] = useState<"brand" | "category">("brand");

  const keepLine = (brandId: string, cat: string) =>
    (brand === "all" || brandId === brand) && (category === "all" || cat === category);
  const filtersActive = brand !== "all" || category !== "all" || loc !== "all";

  const items = useMemo(
    () => stockItems(levers).filter((s) => keepLine(s.brandId, s.category) && units(s, loc) > 0),
    [levers, brand, category, loc],
  );
  const lines = useMemo(() => LINES.filter((l) => keepLine(l.brandId, l.category)), [brand, category]);

  // Weekly units on one calendar, SS26 into AW26.
  const weekly = useMemo(() => {
    const values = Array.from({ length: CAL_WEEKS }, () => 0);
    for (const l of lines) {
      const offset = Math.round((new Date(SEASONS[l.season].start + "T00:00:00Z").getTime() - CAL_START) / (7 * DAY));
      const series = loc === "all" ? l.sales : l.salesByLoc[loc];
      series.forEach((u, w) => {
        if (offset + w < CAL_WEEKS) values[offset + w] += u;
      });
    }
    return { values, labels: values.map((_, i) => monthLabel(i)) };
  }, [lines, loc]);

  const stockCost = items.reduce((a, s) => a + units(s, loc) * s.cost, 0);
  const stockUnits = items.reduce((a, s) => a + units(s, loc), 0);
  const aged = items.filter((s) => s.band === "aged");
  const agedCost = aged.reduce((a, s) => a + units(s, loc) * s.cost, 0);
  const share = (season: "SS26" | "AW26") => {
    const ls = lines.filter((l) => l.season === season);
    const total = ls.reduce((a, l) => a + l.sales.reduce((x, y) => x + y, 0), 0);
    const online = ls.reduce((a, l) => a + l.salesByLoc.online.reduce((x, y) => x + y, 0), 0);
    return total ? (online / total) * 100 : 0;
  };
  const waiting = THIS_SEASON.filter((f) => keepLine(f.brand.id, f.line.category)).reduce((a, f) => a + f.waiting, 0);

  const health = (Object.keys(HEALTH_META) as HealthBand[]).map((band) => {
    const inB = items.filter((s) => s.band === band);
    return {
      band,
      lines: inB.length,
      units: inB.reduce((a, s) => a + units(s, loc), 0),
      cost: inB.reduce((a, s) => a + units(s, loc) * s.cost, 0),
    };
  });
  const soldOutLines = THIS_SEASON.filter((f) => f.stockNow === 0 && keepLine(f.brand.id, f.line.category)).length;

  const abc = useMemo(() => abcClasses((f) => keepLine(f.brand.id, f.line.category)), [brand, category]);
  const ages = ageBuckets(items.map((s) => ({ ...s, units: units(s, loc) })));
  const maxAge = Math.max(...ages.map((a) => a.cost), 1);

  const channel = LOCATION_IDS.map((id) => ({
    label: LOCATIONS.find((l) => l.id === id)!.name,
    value: lines.filter((l) => l.season === "AW26").reduce((a, l) => a + l.salesByLoc[id].reduce((x, y) => x + y, 0), 0),
    colorVar: LOC_SLOT[id],
  }));

  const groups = splitBy === "brand" ? BRANDS.map((b) => ({ key: b.id, label: b.name })) : CATEGORIES.map((c) => ({ key: c, label: c }));
  const where = LOCATION_IDS.filter((id) => loc === "all" || id === loc).map((id) => {
    const segs = groups.map((g, i) => ({
      label: g.label,
      value: items
        .filter((s) => (splitBy === "brand" ? s.brandId === g.key : s.category === g.key))
        .reduce((a, s) => a + s.stockByLoc[id] * s.cost, 0),
      colorVar: SLOTS[i % SLOTS.length],
    }));
    return { id, name: LOCATIONS.find((l) => l.id === id)!.name, segs, total: segs.reduce((a, s) => a + s.value, 0) };
  });

  const clearance = clearanceRoutes(items);
  const topAlerts = alerts.filter((a) => a.severity !== "good").slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <div className="eyebrow">Stock & sales</div>
          <h2 className="mt-1.5 text-[17px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Across the stores and online
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect
            label="Brand"
            value={brand}
            onChange={setBrand}
            options={[{ value: "all", label: "All brands" }, ...BRANDS.map((b) => ({ value: b.id, label: b.name }))]}
          />
          <FilterSelect
            label="Category"
            value={category}
            onChange={setCategory}
            options={[{ value: "all", label: "All categories" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
          />
          <FilterSelect<LocationId | "all">
            label="Location"
            value={loc}
            onChange={setLoc}
            options={[{ value: "all", label: "Everywhere" }, ...LOCATIONS.map((l) => ({ value: l.id, label: l.name }))]}
          />
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setBrand("all");
                setCategory("all");
                setLoc("all");
              }}
              className="text-xs font-medium"
              style={{ color: "var(--accent)" }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Stock on hand, at cost" value={fmtMoney(stockCost)} sub={`${fmtInt(stockUnits)} pieces · ${items.length} lines`} />
        <StatTile
          label="Online share of sales"
          value={fmtPct(share("AW26"))}
          sub={`AW26 so far · up from ${fmtPct(share("SS26"))} in SS26`}
        />
        <StatTile
          label="Customers waiting for a line"
          value={fmtInt(waiting)}
          sub="notify-me sign-ups and in-store requests"
          status={waiting > 0 ? { severity: "serious", text: "see True demand" } : undefined}
        />
        <StatTile
          label={`Aged stock (over ${levers.agedDays} days)`}
          value={fmtMoney(agedCost)}
          sub={`${fmtInt(aged.reduce((a, s) => a + units(s, loc), 0))} pieces from past seasons`}
          status={agedCost > 0 ? { severity: "warning", text: "clearance routes below" } : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card
          className="xl:col-span-3"
          title="Weekly units sold"
          subtitle={`SS26 into AW26 · ${loc === "all" ? "all stores and online" : LOCATIONS.find((l) => l.id === loc)!.name.toLowerCase()} · full-price weeks`}
        >
          <AreaTrend values={weekly.values} labels={weekly.labels} height={210} valueName="units" markers={[{ index: 26, label: "AW26 lands" }]} />
        </Card>
        <Card className="xl:col-span-2" title="Advisories" subtitle="what needs a decision this week">
          <ul className="space-y-2.5">
            {topAlerts.map((a) => (
              <li key={a.id}>
                <SeverityBadge severity={a.severity} />
                <div className="mt-0.5 text-xs font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
                  {a.title}
                </div>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setView("advisories")} className="mt-3 text-xs font-medium" style={{ color: "var(--accent)" }}>
            All {alerts.length} advisories →
          </button>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Stock health" subtitle="every line on hand, banded by how it'll finish">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                {["Band", "Lines", "Pieces", "£ at cost"].map((h, i) => (
                  <th key={h} className={`border-b py-1.5 pr-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] ${i ? "text-right" : "text-left"}`} style={{ borderColor: "var(--grid)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid var(--grid)" }} title="AW26 lines with nothing left anywhere">
                <td className="py-2 pr-2">
                  <SeverityBadge severity="critical" text="Sold out" />
                </td>
                <td className="tnum pr-2 text-right" style={{ color: "var(--text-primary)" }}>
                  {soldOutLines}
                </td>
                <td className="tnum pr-2 text-right" style={{ color: "var(--text-muted)" }}>
                  0
                </td>
                <td className="tnum text-right" style={{ color: "var(--text-muted)" }}>
                  —
                </td>
              </tr>
              {health.map((h) => (
                <tr key={h.band} style={{ borderBottom: "1px solid var(--grid)" }} title={HEALTH_META[h.band].blurb}>
                  <td className="py-2 pr-2">
                    <SeverityBadge severity={HEALTH_META[h.band].severity} text={HEALTH_META[h.band].label} />
                  </td>
                  <td className="tnum pr-2 text-right" style={{ color: "var(--text-primary)" }}>
                    {h.lines}
                  </td>
                  <td className="tnum pr-2 text-right" style={{ color: "var(--text-primary)" }}>
                    {fmtInt(h.units)}
                  </td>
                  <td className="tnum text-right" style={{ color: "var(--text-primary)" }}>
                    {fmtMoney(h.cost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
            Aged threshold is a lever — currently {levers.agedDays} days.
          </p>
        </Card>

        <Card title="ABC classification" subtitle="AW26 lines by share of sales value — and where the stock money sits">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                {["Class", "Lines", "Sales", "Stock £"].map((h, i) => (
                  <th key={h} className={`border-b py-1.5 pr-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] ${i ? "text-right" : "text-left"}`} style={{ borderColor: "var(--grid)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {abc.map((row) => (
                <tr key={row.cls} style={{ borderBottom: "1px solid var(--grid)" }} title={ABC_META[row.cls]}>
                  <td className="py-2 pr-2">
                    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                      {row.cls}
                    </span>{" "}
                    <span style={{ color: "var(--text-muted)" }}>{ABC_META[row.cls].split(" — ")[0]}</span>
                  </td>
                  <td className="tnum pr-2 text-right" style={{ color: "var(--text-primary)" }}>
                    {row.lines.length}
                  </td>
                  <td className="tnum pr-2 text-right" style={{ color: "var(--text-primary)" }}>
                    {fmtPct(row.salesShare)}
                  </td>
                  <td className="tnum text-right" style={{ color: "var(--text-primary)" }}>
                    {fmtPct(row.stockShare)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {abc[2] && abc[2].lines.length > 0 && (
            <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              C lines make {fmtPct(abc[2].salesShare)} of sales but hold {fmtPct(abc[2].stockShare)} of the stock money:{" "}
              {abc[2].lines.map((f) => f.line.name).join(", ")}.
            </p>
          )}
        </Card>

        <Card title="Stock age" subtitle="£ at cost by how long it's been on hand">
          <div className="space-y-2.5">
            {ages.map((a, i) => (
              <div key={a.label}>
                <div className="flex justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span>{a.label}</span>
                  <span className="tnum" style={{ color: "var(--text-primary)" }}>
                    {fmtMoney(a.cost)} · {fmtInt(a.units)} pcs
                  </span>
                </div>
                <div className="mt-1 h-2.5 rounded-full" style={{ background: "var(--meter-track)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(a.cost / maxAge) * 100}%`,
                      background: i >= 2 ? "var(--status-serious)" : "var(--seq-450)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Sales by channel — AW26" subtitle={`units by location · online is up from ${fmtPct(share("SS26"))} of sales last spring`}>
          <HStackBar segments={channel} format={(v) => `${fmtInt(v)} units`} />
        </Card>
        <Card
          title="Where the stock sits"
          subtitle={`£ at cost per location, by ${splitBy}`}
          actions={
            <Segmented
              options={[
                { value: "brand", label: "Brand" },
                { value: "category", label: "Category" },
              ]}
              value={splitBy}
              onChange={(v) => setSplitBy(v as "brand" | "category")}
            />
          }
        >
          <div className="space-y-3">
            {where.map((w, i) => (
              <div key={w.id}>
                <div className="mb-1 flex justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span>{w.name}</span>
                  <span className="tnum font-semibold" style={{ color: "var(--text-primary)" }}>
                    {fmtMoney(w.total)}
                  </span>
                </div>
                <HStackBar segments={w.segs.filter((s) => s.value > 0)} format={fmtMoney} height={22} showLegend={i === where.length - 1} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Clearance opportunities" subtitle="aged and slow stock with a recommended route — every pound back is open-to-buy">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-xs">
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                {["Line", "Season", "Age", "Pieces", "Where", "Route", "Cash back"].map((h, i) => (
                  <th
                    key={h}
                    className={`border-b py-2 pr-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] ${i === 2 || i === 3 || i === 6 ? "text-right" : "text-left"}`}
                    style={{ borderColor: "var(--grid)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clearance.slice(0, 10).map(({ item, route, recover }) => (
                <tr
                  key={item.id}
                  onClick={() => item.lineId && setOpenLine(item.lineId)}
                  className={item.lineId ? "cursor-pointer hover:opacity-80" : ""}
                  style={{ borderBottom: "1px solid var(--grid)" }}
                >
                  <td className="py-2 pr-3">
                    <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                      {item.name}
                    </div>
                    <div style={{ color: "var(--text-muted)" }}>{BRAND_BY_ID[item.brandId].name}</div>
                  </td>
                  <td className="pr-3">
                    <Chip>{item.season}</Chip>
                  </td>
                  <td className="tnum pr-3 text-right" style={{ color: item.ageDays > 365 ? "var(--status-critical)" : "var(--text-primary)" }}>
                    {item.ageDays} d
                  </td>
                  <td className="tnum pr-3 text-right" style={{ color: "var(--text-primary)" }}>
                    {item.season === "AW26" ? `~${fmtInt(item.projectedLeftover)}` : item.units}
                  </td>
                  <td className="pr-3" style={{ color: "var(--text-secondary)" }}>
                    {LOCATIONS.filter((l) => item.stockByLoc[l.id] > 0)
                      .map((l) => `${l.short} ${item.stockByLoc[l.id]}`)
                      .join(" · ")}
                  </td>
                  <td className="max-w-[340px] pr-3" style={{ color: "var(--text-secondary)" }}>
                    {route}
                  </td>
                  <td className="tnum text-right font-semibold" style={{ color: "var(--text-primary)" }}>
                    {fmtMoney(recover)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {clearance.length > 10 && (
          <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
            +{clearance.length - 10} smaller lines ({LAST_SEASON.length} SS26 lines checked) · AW26 pieces are the projected season-end leftover.
          </p>
        )}
      </Card>
    </div>
  );
}
