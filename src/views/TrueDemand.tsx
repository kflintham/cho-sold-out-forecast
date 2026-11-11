import { useMemo, useState } from "react";
import { useApp } from "../state/AppState";
import { LOCATIONS, SEASONS, seasonWeekDate } from "../data/dataset";
import { buildTrueDemand, waitingBlindspot } from "../engine/stock";
import { DemandBridge } from "../components/Bridge";
import { Sparkline } from "../components/charts";
import { Card, Chip, PageHeader, SeverityIcon, Toggle } from "../components/ui";
import { fmtDate, fmtInt, fmtMoney } from "../lib/format";

export function TrueDemand() {
  const { levers, setLevers, setOpenLine } = useApp();
  const lines = useMemo(() => buildTrueDemand(levers), [levers]);
  const blind = useMemo(() => waitingBlindspot(levers), [levers]);

  const sorted = useMemo(
    () => [...lines].sort((a, b) => b.gap - a.gap || a.stock - b.stock),
    [lines],
  );
  const bridgeChoices = sorted.filter((t) => t.gap > 0.5 || t.onOrder > 0 || t.waiting > 0);
  const [bridgeId, setBridgeId] = useState("AW26-NV-2710");
  const bridge = lines.find((t) => t.fc.line.id === bridgeId) ?? bridgeChoices[0];

  const risks = useMemo(
    () =>
      lines
        .filter((t) => t.fc.projectedSellOutWeek !== null)
        .sort((a, b) => (a.fc.projectedSellOutWeek ?? 99) - (b.fc.projectedSellOutWeek ?? 99)),
    [lines],
  );
  const metrics = {
    soldOut: lines.filter((t) => t.stock === 0).length,
    sellingOut: lines.filter((t) => t.stock > 0 && t.fc.projectedSellOutWeek !== null).length,
    waiting: lines.reduce((a, t) => a + t.fc.waiting, 0),
    atRisk: lines.reduce((a, t) => a + Math.max(0, t.gap - t.reorder) * t.fc.line.rrp, 0),
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={`${SEASONS.AW26.label} · week ${SEASONS.AW26.weeksTraded} traded`}
        title="True demand"
        sub="demand still to come + customers waiting − stock in every location − open re-orders · per line · the number that drives a re-order, or tells you a re-order can't help"
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <SeverityIcon severity={levers.countWaiting ? "good" : "critical"} size={18} />
            <div>
              <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {levers.countWaiting
                  ? `Waiting customers are counted: ${fmtInt(blind.waiting)} people (${fmtMoney(blind.waitingValue)} at full price) have asked for a sold-out line`
                  : `This is what stock reports see — ${fmtInt(blind.waiting)} customers who asked for a line have vanished from the re-orders`}
              </div>
              <p className="mt-0.5 max-w-2xl text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {levers.countWaiting
                  ? `${blind.online} signed up to “notify me” online and ${blind.inStore} asked in store. They're real orders waiting to happen: re-orders include them, and where the brand can't restock they're the first people to offer an alternative.`
                  : `Re-orders are ${fmtInt(blind.units)} units lighter, and the customers who asked are nobody's job to call back. Flip the switch to count them.`}
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2.5 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Count waiting customers as demand
            <Toggle checked={levers.countWaiting} onChange={(v) => setLevers({ countWaiting: v })} label="Count waiting customers as demand" />
          </label>
        </div>
      </Card>

      {bridge && (
        <Card
          title={`Where the gap comes from — ${bridge.fc.line.name}`}
          subtitle={`${bridge.fc.brand.name} · rest of the season, weeks ${bridge.fc.weeksTraded + 1}–${bridge.fc.seasonWeeks} · ${bridge.fc.canTopUp ? `${bridge.fc.source} ${bridge.fc.brand.ownLabel ? "can repeat" : "restocks"} in ${bridge.fc.leadWeeks} weeks` : "brand can't restock"}`}
          actions={
            <select
              aria-label="Choose a line"
              className="max-w-[48vw] rounded-lg border px-2 py-1.5 text-xs"
              style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
              value={bridge.fc.line.id}
              onChange={(e) => setBridgeId(e.target.value)}
            >
              {bridgeChoices.map((t) => (
                <option key={t.fc.line.id} value={t.fc.line.id}>
                  {t.fc.line.name}
                </option>
              ))}
            </select>
          }
        >
          <DemandBridge td={bridge} />
        </Card>
      )}

      <Card title="Top sell-out risks" subtitle="sorted by when the shelf empties, open re-orders included · click a row for the full picture">
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { k: "Lines sold out", v: fmtInt(metrics.soldOut) },
            { k: "Lines selling out", v: fmtInt(metrics.sellingOut) },
            { k: "Customers waiting", v: fmtInt(metrics.waiting) },
            { k: "Sales no re-order can save", v: fmtMoney(metrics.atRisk) },
          ].map((x) => (
            <div key={x.k} className="rounded-lg border px-2.5 py-2 text-center" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
              <div className="tnum text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {x.v}
              </div>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {x.k}
              </div>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                {["Line", "In stock", "Sells out", "Brand restock", "Waiting", "Action"].map((h, i) => (
                  <th
                    key={h}
                    className={`border-b py-2 pr-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] ${i === 0 || i === 5 ? "text-left" : "text-right"}`}
                    style={{ borderColor: "var(--grid)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {risks.map((t) => {
                const f = t.fc;
                const out = f.projectedSellOutWeek!;
                return (
                  <tr key={f.line.id} onClick={() => setOpenLine(f.line.id)} className="cursor-pointer hover:opacity-80" style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td className="py-2 pr-3">
                      <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                        {f.line.name}
                      </span>{" "}
                      <span style={{ color: "var(--text-muted)" }}>{f.brand.name}</span>
                    </td>
                    <td className="tnum pr-3 text-right" style={{ color: "var(--text-primary)" }}>
                      {t.stock}
                    </td>
                    <td className="tnum pr-3 text-right">
                      <span className="inline-flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                        <SeverityIcon severity={t.stock === 0 ? "critical" : "serious"} size={12} />
                        {t.stock === 0 ? `gone wk ${out}` : `wk ${out} · ${fmtDate(seasonWeekDate("AW26", out))}`}
                      </span>
                    </td>
                    <td className="pr-3 text-right" style={{ color: "var(--text-secondary)" }}>
                      {f.canTopUp ? `${f.leadWeeks} wks` : "no"}
                    </td>
                    <td className="tnum pr-3 text-right" style={{ color: "var(--text-primary)" }}>
                      {f.waiting > 0 ? f.waiting : "—"}
                    </td>
                    <td className="pr-3">
                      {t.reorder > 0 ? (
                        <Chip tone="accent">re-order {t.reorder}</Chip>
                      ) : f.canTopUp ? (
                        <Chip>watch</Chip>
                      ) : t.stock === 0 ? (
                        <Chip>offer an alternative · log demand</Chip>
                      ) : (
                        <Chip>hold full price · log demand</Chip>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Demand plan, every AW26 line" subtitle="rest of the season · stock by location · click a row for the full picture">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-xs">
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                {["Line", "Weekly sales", "Still to come", "Waiting", ...LOCATIONS.map((l) => l.short), "On re-order", "Gap", "Re-order"].map((h, i) => (
                  <th
                    key={h}
                    className={`border-b py-2 pr-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] ${i <= 1 ? "text-left" : "text-right"}`}
                    style={{ borderColor: "var(--grid)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const f = t.fc;
                return (
                  <tr key={f.line.id} onClick={() => setOpenLine(f.line.id)} className="cursor-pointer align-middle hover:opacity-80" style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td className="py-2 pr-3">
                      <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                        {f.line.name}
                      </div>
                      <div style={{ color: "var(--text-muted)" }}>
                        {f.brand.name} · {f.line.code}
                      </div>
                    </td>
                    <td className="pr-3">
                      <Sparkline values={f.line.sales} width={92} height={26} />
                    </td>
                    <td className="tnum pr-3 text-right" style={{ color: "var(--text-primary)" }}>
                      {fmtInt(t.remainingDemand)}
                    </td>
                    <td className="tnum pr-3 text-right" style={{ color: "var(--text-primary)" }}>
                      {t.waiting > 0 ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <span aria-hidden style={{ background: "var(--series-2)", width: 8, height: 8, borderRadius: 4 }} />
                          {t.waiting}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    {LOCATIONS.map((l) => {
                      const s = t.byLocation[l.id];
                      const short = s.stock < s.demand - 1;
                      return (
                        <td key={l.id} className="tnum pr-3 text-right" style={{ color: short ? "var(--status-critical)" : "var(--text-primary)", fontWeight: short ? 600 : 400 }}>
                          {s.stock}
                        </td>
                      );
                    })}
                    <td className="tnum pr-3 text-right" style={{ color: "var(--text-secondary)" }}>
                      {t.onOrder > 0 ? t.onOrder : "—"}
                    </td>
                    <td className="tnum pr-3 text-right" style={{ color: "var(--text-primary)" }}>
                      {t.gap > 0.5 ? fmtInt(t.gap) : "—"}
                    </td>
                    <td className="pr-3 text-right">
                      {t.reorder > 0 ? (
                        <span className="tnum font-semibold" style={{ color: "var(--text-primary)" }}>
                          {t.reorder}
                        </span>
                      ) : t.gap > 0.5 && !f.canTopUp ? (
                        <Chip>can't restock</Chip>
                      ) : t.onOrder > 0 && t.gap < 0.5 ? (
                        <Chip>covered</Chip>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          Red stock = that location will run out before the season ends at its share of sales — a transfer may beat a re-order (see Advisories).
        </p>
      </Card>
    </div>
  );
}
