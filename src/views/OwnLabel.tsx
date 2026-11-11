import { useMemo } from "react";
import { useApp } from "../state/AppState";
import { FACTORIES, FACTORY_BY_ID, FACTORY_PERFORMANCE, PO_STAGES, PO_STAGE_LABEL, PRODUCTION_POS } from "../data/dataset";
import { buildOwnLabelSheet } from "../engine/ownLabel";
import { ShipMap } from "../components/ShipMap";
import { Meter } from "../components/charts";
import { Card, Chip, PageHeader } from "../components/ui";
import { fmtInt, fmtMoney } from "../lib/format";

const MODE_LABEL = { sea: "sea freight", road: "road", van: "van" } as const;

export function OwnLabel() {
  const { buyPlan, setOpenLine, setView } = useApp();
  const sheets = useMemo(() => buildOwnLabelSheet(buyPlan), [buyPlan]);
  const ownPlan = buyPlan.filter((b) => b.fc.brand.ownLabel);
  const ownCost = ownPlan.reduce((a, b) => a + b.cost, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Optional · if you make your own"
        title="Own label & factories"
        sub="If part of the range is designed in house and made to order, the same engine runs the factory side: production stages, minimum orders, cartons and containers, ships on the water, and how each factory performs. Brands only? This screen simply stays out of the way."
        right={<Chip tone="accent">Own label in the demo: {ownPlan.length} SS27 lines · {fmtMoney(ownCost)} at cost</Chip>}
      />

      <Card title="Production pipeline" subtitle="every own-label PO by stage — kept current from the factory's updates and the forwarder's tracking in production">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {PO_STAGES.map((stage) => {
            const pos = PRODUCTION_POS.filter((p) => p.status === stage);
            return (
              <div key={stage}>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                  {PO_STAGE_LABEL[stage]}
                </div>
                <div className="space-y-2">
                  {pos.map((p) => {
                    const f = FACTORY_BY_ID[p.factoryId];
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={!p.lineId}
                        onClick={() => p.lineId && setOpenLine(p.lineId)}
                        className="block w-full rounded-lg border p-2.5 text-left text-xs"
                        style={{ borderColor: "var(--border)", background: "var(--surface-1)", cursor: p.lineId ? "pointer" : "default" }}
                      >
                        <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                          {p.ref} · {fmtInt(p.qty)} units
                        </div>
                        <div style={{ color: "var(--text-secondary)" }}>{p.cargo}</div>
                        <div style={{ color: "var(--text-muted)" }}>
                          {f.location.split(",")[0]} · {MODE_LABEL[f.mode]} · {p.etaWeeks <= 1 ? "lands this week" : `lands in ~${p.etaWeeks} wks`}
                        </div>
                      </button>
                    );
                  })}
                  {pos.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>—</p>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="On the water" subtitle="where the sea shipments are right now — demo positions; in production this reads the forwarder's API / AIS vessel feed live">
        <ShipMap />
      </Card>

      {sheets.map((s) => (
        <Card
          key={s.factory.id}
          title={`SS27 own-label buy — ${s.factory.name}, ${s.factory.location}`}
          subtitle={`${s.factory.leadWeeks}-week lead · minimum ${s.factory.moq} per style & colour · ${MODE_LABEL[s.factory.mode]} · ${fmtInt(s.totalUnits)} units · ${fmtMoney(s.totalCost)} at cost`}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-xs">
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  {["Line", "SS26 bought", "Sold", "Est. demand", "Plan", "Cartons", "m³", "£ at cost"].map((h, i) => (
                    <th
                      key={h}
                      className={`border-b py-2 pr-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] ${i === 0 ? "text-left" : "text-right"}`}
                      style={{ borderColor: "var(--grid)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.lines.map((l) => {
                  const f = l.buy.fc;
                  return (
                    <tr key={f.line.id} onClick={() => setOpenLine(f.line.id)} className="cursor-pointer hover:opacity-80" style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td className="py-2 pr-3">
                        <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                          {f.line.name}
                        </div>
                        <div style={{ color: "var(--text-muted)" }}>
                          {f.line.code}
                          {f.soldOutWeek !== null ? ` · sold out wk ${f.soldOutWeek} of ${f.seasonWeeks}` : ""}
                        </div>
                      </td>
                      <td className="tnum pr-3 text-right" style={{ color: "var(--text-secondary)" }}>
                        {f.line.bought}
                      </td>
                      <td className="tnum pr-3 text-right" style={{ color: "var(--text-primary)" }}>
                        {f.sold}
                      </td>
                      <td className="tnum pr-3 text-right" style={{ color: "var(--text-primary)" }}>
                        {f.soldOutWeek !== null ? `≈ ${fmtInt(f.demand)}` : fmtInt(f.sold)}
                      </td>
                      <td className="pr-3 text-right">
                        <span className="inline-flex items-center gap-1.5">
                          {l.moqAdded > 0 && <Chip>MOQ +{l.moqAdded}</Chip>}
                          {l.buy.capped && <Chip tone="accent">capped</Chip>}
                          <span className="tnum font-semibold" style={{ color: "var(--text-primary)" }}>
                            {fmtInt(l.units)}
                          </span>
                        </span>
                      </td>
                      <td className="tnum pr-3 text-right" style={{ color: "var(--text-secondary)" }}>
                        {l.cartons}
                      </td>
                      <td className="tnum pr-3 text-right" style={{ color: "var(--text-secondary)" }}>
                        {l.m3.toFixed(2)}
                      </td>
                      <td className="tnum text-right" style={{ color: "var(--text-primary)" }}>
                        {fmtMoney(l.cost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {s.fillPct !== null && s.container && (
            <div className="mt-4 max-w-xl">
              <div className="mb-1 flex justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
                <span>
                  {s.container.name} container · {s.totalM3.toFixed(1)} of {s.container.usableM3} m³
                </span>
                <span className="tnum font-semibold" style={{ color: "var(--text-primary)" }}>
                  {Math.round(s.fillPct)}% full
                </span>
              </div>
              <Meter pct={s.fillPct} target={90} />
            </div>
          )}
          <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {s.advice}
          </p>
          {s.topUps.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              {s.topUps.map((t) => (
                <li key={t.buy.fc.line.id}>
                  + {t.addUnits} × {t.buy.fc.line.name} ({t.addM3.toFixed(1)} m³, {fmtMoney(t.addCost)}) — {t.reason}
                </li>
              ))}
            </ul>
          )}
          {s.lines.some((l) => l.moqAdded > 0) && (
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              MOQ = the factory minimum pushed the order above what the forecast needs — worth negotiating, or combining colours.
            </p>
          )}
        </Card>
      ))}

      <Card title="Factory scorecard" subtitle="the quarterly view — built to be read across a language barrier: big numbers, no prose">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {FACTORIES.map((f) => {
            const perf = FACTORY_PERFORMANCE[f.id];
            const open = PRODUCTION_POS.filter((p) => p.factoryId === f.id);
            return (
              <div key={f.id} className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
                <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {f.name}
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {f.location} · {MODE_LABEL[f.mode]}
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    { k: "On time, in full", v: `${perf.otifPct}%`, bad: perf.otifPct < 90 },
                    { k: "Actual lead", v: `${perf.avgLeadActualWeeks} wks`, bad: perf.avgLeadActualWeeks > f.leadWeeks + 1 },
                    { k: "Delays > 7 days", v: String(perf.delaysOver7d), bad: perf.delaysOver7d > 0 },
                  ].map((x) => (
                    <div key={x.k}>
                      <dd className="tnum text-[17px] font-semibold" style={{ color: x.bad ? "var(--status-serious)" : "var(--text-primary)" }}>
                        {x.v}
                      </dd>
                      <dt className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>
                        {x.k}
                      </dt>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {open.length} open PO{open.length === 1 ? "" : "s"} · quality: {perf.qualityNote}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          Factory orders also appear on the{" "}
          <button type="button" className="font-medium" style={{ color: "var(--accent)" }} onClick={() => setView("timeline")}>
            order timeline
          </button>
          , where an unapproved sample holds production automatically.
        </p>
      </Card>
    </div>
  );
}
