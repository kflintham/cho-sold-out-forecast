import { useState } from "react";
import { useApp } from "../state/AppState";
import { BRANDS, BRAND_BY_ID, TODAY, type CpStage, type CpStatus, type OrderTimeline as Timeline } from "../data/dataset";
import { Card, Chip, PageHeader, SeverityIcon, Toggle } from "../components/ui";
import { fmtDate, fmtMoney } from "../lib/format";

function CpDot({ status }: { status: CpStatus }) {
  if (status === "done") return <SeverityIcon severity="good" size={15} />;
  if (status === "blocked") return <SeverityIcon severity="critical" size={15} />;
  return (
    <span
      aria-hidden
      className="inline-block rounded-full"
      style={{
        width: 13,
        height: 13,
        background: status === "in-progress" ? "var(--accent)" : "transparent",
        border: status === "in-progress" ? "none" : "2px solid var(--baseline)",
      }}
    />
  );
}

const inputStyle = {
  background: "var(--surface-1)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
} as const;

function AddOrderForm() {
  const { addTimeline } = useApp();
  const [title, setTitle] = useState("");
  const [ref, setRef] = useState("");
  const [brandId, setBrandId] = useState("");
  const [signedOff, setSignedOff] = useState(true);
  const [placed, setPlaced] = useState("");
  const [dispatched, setDispatched] = useState("");
  const [delivered, setDelivered] = useState("");
  const [added, setAdded] = useState(false);

  const todayIso = TODAY.toISOString().slice(0, 10);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const stages: CpStage[] = [
      { label: "Showroom", status: "done", date: todayIso },
      signedOff
        ? { label: "Budget signed off", status: "done", date: todayIso }
        : { label: "Budget signed off", status: "blocked", note: "no order goes to the brand until the budget is agreed" },
      { label: "Order placed", status: "pending", date: placed || undefined },
      { label: "Confirmed by brand", status: "pending" },
      { label: "Dispatched", status: "pending", date: dispatched || undefined },
      { label: "Delivered", status: "pending", date: delivered || undefined },
      { label: "On the shop floor", status: "pending" },
    ];
    const t: Timeline = {
      id: `cp-user-${Date.now()}`,
      title: title.trim(),
      ref: ref.trim() || undefined,
      brandId: brandId || undefined,
      stages,
      custom: true,
    };
    addTimeline(t);
    setTitle("");
    setRef("");
    setBrandId("");
    setSignedOff(true);
    setPlaced("");
    setDispatched("");
    setDelivered("");
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2500);
  }

  return (
    <Card title="Add an order" subtitle="new orders follow the same gates — without budget sign-off the order is held automatically">
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs sm:col-span-2" style={{ color: "var(--text-secondary)" }}>
          Order name *
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Nordvik — SS27 knitwear top-up"
            className="rounded-lg border px-2.5 py-2 text-[13px]"
            style={inputStyle}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Brand
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="rounded-lg border px-2 py-2 text-[13px]" style={inputStyle}>
            <option value="">— new brand —</option>
            {BRANDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Order reference
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="optional" className="rounded-lg border px-2.5 py-2 text-[13px]" style={inputStyle} />
        </label>
        {(
          [
            ["Order placed by", placed, setPlaced],
            ["Dispatch date", dispatched, setDispatched],
            ["Delivery date", delivered, setDelivered],
          ] as const
        ).map(([label, value, set]) => (
          <label key={label} className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            {label}
            <input type="date" value={value} onChange={(e) => set(e.target.value)} className="rounded-lg border px-2.5 py-1.5 text-[13px]" style={inputStyle} />
          </label>
        ))}
        <div className="flex flex-wrap items-end justify-between gap-3 sm:col-span-2 xl:col-span-4">
          <label className="flex items-center gap-2.5 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Budget signed off
            <Toggle checked={signedOff} onChange={setSignedOff} label="Budget signed off" />
            {!signedOff && (
              <span className="inline-flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                <SeverityIcon severity="critical" size={12} /> this order will be held
              </span>
            )}
          </label>
          <div className="flex items-center gap-3">
            {added && (
              <span className="text-xs font-medium" style={{ color: "var(--delta-up-good)" }}>
                Added below
              </span>
            )}
            <button type="submit" className="rounded-lg px-4 py-2 text-xs font-semibold" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>
              Add order
            </button>
          </div>
        </div>
      </form>
    </Card>
  );
}

export function OrderTimeline() {
  const { timelines, removeTimeline, cycleStage, buyPlan } = useApp();

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Order planning"
        title="Order timeline"
        sub="every order from showroom to shop floor, stage by stage — nothing goes to a brand until its budget is signed off, and every order book deadline is on the page. Click a stage to update it."
      />

      <AddOrderForm />

      <div className="space-y-4">
        {timelines.map((t) => {
          const blocked = t.stages.some((s) => s.status === "blocked");
          const brand = t.brandId ? BRAND_BY_ID[t.brandId] : undefined;
          const plan = brand && !t.ref ? buyPlan.filter((b) => b.fc.brand.id === brand.id) : [];
          const planCost = plan.reduce((a, b) => a + b.cost, 0);
          return (
            <Card key={t.id}>
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {t.title}
                </span>
                {t.ref && <Chip>{t.ref}</Chip>}
                {plan.length > 0 && <Chip>SS27 plan {fmtMoney(planCost)} at cost</Chip>}
                {brand && !t.ref && <Chip>book closes {fmtDate(brand.orderDeadline)}</Chip>}
                {t.custom && <Chip tone="accent">added this session</Chip>}
                <span className="ml-auto inline-flex items-center gap-3">
                  {blocked && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                      <SeverityIcon severity="critical" size={13} /> Held — do not order
                    </span>
                  )}
                  {t.custom && (
                    <button
                      type="button"
                      onClick={() => removeTimeline(t.id)}
                      className="rounded-md border px-2 py-1 text-[11px]"
                      style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                    >
                      Remove
                    </button>
                  )}
                </span>
              </div>
              <div className="overflow-x-auto">
                <div className="flex min-w-[720px] items-start">
                  {t.stages.map((s, i) => (
                    <div key={s.label} className="relative flex-1">
                      {i < t.stages.length - 1 && (
                        <div aria-hidden className="absolute top-[7px] left-1/2 h-px w-full" style={{ background: "var(--grid)" }} />
                      )}
                      <div className="relative flex flex-col items-center gap-1 px-1 text-center">
                        <button
                          type="button"
                          onClick={() => cycleStage(t.id, i)}
                          aria-label={`${s.label}: ${s.status} — click to update`}
                          title="Click to update status"
                          className="cursor-pointer"
                          style={{ background: "var(--surface-1)", borderRadius: 999, lineHeight: 0, padding: 1 }}
                        >
                          <CpDot status={s.status} />
                        </button>
                        <div className="text-[11px] font-medium leading-tight" style={{ color: "var(--text-secondary)" }}>
                          {s.label}
                        </div>
                        <div className="tnum text-[10.5px]" style={{ color: "var(--text-muted)" }}>
                          {s.date ? fmtDate(s.date) : s.note ? "" : "—"}
                        </div>
                        {s.note && (
                          <div className="max-w-[120px] text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>
                            {s.note}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Orders added here live for this demo session only. In production they're saved and shared: confirmations and
        dispatch dates come in from brand emails and portals, delivery dates from the courier, and the budget gate is
        enforced against the open-to-buy — not remembered by a person.
      </p>
    </div>
  );
}
