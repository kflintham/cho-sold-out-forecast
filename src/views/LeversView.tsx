import { useApp } from "../state/AppState";
import {
  AGED_OPTIONS,
  LOST_SHARE_OPTIONS,
  SELL_THROUGH_OPTIONS,
  STEP_UP_OPTIONS,
  USUAL_RULE_OPTIONS,
} from "../engine/levers";
import { Card, LeverRow, PageHeader, Segmented, Toggle } from "../components/ui";
import { fmtMoney } from "../lib/format";

export function LeversView() {
  const { levers, setLevers, resetLevers, buyPlan } = useApp();

  const total = buyPlan.reduce((a, b) => a + b.cost, 0);
  const usual = buyPlan.reduce((a, b) => a + b.usualCost, 0);
  const stepped = buyPlan.filter((b) => b.recommended > b.usualRule).length;
  const capped = buyPlan.filter((b) => b.capped).length;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Your rules, not ours"
        title="Levers"
        sub="How bold to be with the missed demand is a buying decision, not a software one. Set the rules once; every screen recomputes as you move them."
        right={
          <button
            type="button"
            onClick={resetLevers}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            Reset to defaults
          </button>
        }
      />

      <div
        className="grid grid-cols-2 gap-3 rounded-xl border p-3 text-center sm:grid-cols-4"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        {[
          { k: "SS27 plan, at cost", v: fmtMoney(total) },
          { k: "Usual rule, at cost", v: fmtMoney(usual) },
          { k: "Lines stepped up", v: String(stepped) },
          { k: "Lines held by the cap", v: String(capped) },
        ].map((x) => (
          <div key={x.k}>
            <div className="tnum text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {x.v}
            </div>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {x.k}
            </div>
          </div>
        ))}
      </div>

      <Card title="What counts as demand">
        <div className="divide-y" style={{ borderColor: "var(--grid)" }}>
          <LeverRow
            name="Count the demand a sell-out hides"
            description="Off = plan from till sales only, which is how most reports see it: a line that sold out looks like it sold exactly what you bought."
            control={<Toggle checked={levers.countLostDemand} onChange={(v) => setLevers({ countLostDemand: v })} label="Count lost demand" />}
          />
          <LeverRow
            name="Share of the missed demand to back"
            description="Some customers who found a line sold out bought something else instead. 75% assumes a quarter of them did."
            control={
              <Segmented options={LOST_SHARE_OPTIONS} value={levers.lostDemandShare} onChange={(v) => setLevers({ lostDemandShare: v })} />
            }
          />
          <LeverRow
            name="Count customers waiting for a line"
            description="Notify-me sign-ups online and requests taken in the shops count as demand on a re-order — they're customers who've already said yes."
            control={<Toggle checked={levers.countWaiting} onChange={(v) => setLevers({ countWaiting: v })} label="Count waiting customers" />}
          />
          <LeverRow
            name="Apply brand momentum"
            description="Lift or trim each brand by how it's trending — e.g. Maison Ondine +12%, Kestrel & Co flat."
            control={<Toggle checked={levers.applyTrend} onChange={(v) => setLevers({ applyTrend: v })} label="Apply brand momentum" />}
          />
        </div>
      </Card>

      <Card title="How you buy">
        <div className="divide-y" style={{ borderColor: "var(--grid)" }}>
          <LeverRow
            name="Planned full-price sell-through"
            description="Buy so that this share sells at full price. 100% buys exactly to demand — so the line is likely to sell out again near season end."
            control={
              <Segmented options={SELL_THROUGH_OPTIONS} value={levers.targetSellThrough} onChange={(v) => setLevers({ targetSellThrough: v })} />
            }
          />
          <LeverRow
            name="Cap on a step-up"
            description="Never go beyond this multiple of last season's buy in one go, however strong the evidence. A brake for lines new to big numbers."
            control={<Segmented options={STEP_UP_OPTIONS} value={levers.maxStepUp} onChange={(v) => setLevers({ maxStepUp: v })} />}
          />
          <LeverRow
            name="Round to whole size runs"
            description="Order in complete size runs (e.g. Harlow & Finch S–XXL = 5 pieces) so no size is missing from the rail."
            control={<Toggle checked={levers.roundToSizeRun} onChange={(v) => setLevers({ roundToSizeRun: v })} label="Round to size runs" />}
          />
          <LeverRow
            name="Your rule of thumb today"
            description="What you'd add to last season's order when a line sold out — shown alongside the plan for comparison."
            control={<Segmented options={USUAL_RULE_OPTIONS} value={levers.usualRulePct} onChange={(v) => setLevers({ usualRulePct: v })} />}
          />
          <LeverRow
            name="Aged stock threshold"
            description="Stock on hand longer than this is flagged as aged and routed to clearance."
            control={<Segmented options={AGED_OPTIONS} value={levers.agedDays} onChange={(v) => setLevers({ agedDays: v })} />}
          />
          <LeverRow
            name="SS27 open-to-buy"
            description="The budget the plan is checked against, at cost."
            control={
              <label className="flex items-center gap-3">
                <input
                  type="range"
                  aria-label="SS27 open-to-buy"
                  min={20000}
                  max={45000}
                  step={500}
                  value={levers.budget}
                  onChange={(e) => setLevers({ budget: Number(e.target.value) })}
                  style={{ accentColor: "var(--accent)", width: 130 }}
                />
                <span className="tnum w-16 text-right text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                  {fmtMoney(levers.budget)}
                </span>
              </label>
            }
          />
        </div>
      </Card>
    </div>
  );
}
