import { useMemo, useState } from "react";
import { useApp } from "../state/AppState";
import { buildScenarios } from "../engine/scenario";
import { Card, Chip, PageHeader, SeverityIcon } from "../components/ui";

export function Scenarios() {
  const { levers } = useApp();
  const scenarios = useMemo(() => buildScenarios(levers), [levers]);
  const [activeId, setActiveId] = useState(scenarios[0].id);
  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Scenario planning with AI"
        title="Scenario planning"
        sub="ask a broad question, get a modelled answer with the working — the AI doesn't invent numbers, it runs the same forecast engine against your data"
        right={<Chip tone="accent">Preview · computed on the demo dataset</Chip>}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-2.5">
          {scenarios.map((s) => {
            const activeCard = s.id === active.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveId(s.id)}
                aria-pressed={activeCard}
                className="block w-full rounded-xl border p-4 text-left"
                style={{
                  background: "var(--surface-1)",
                  borderColor: activeCard ? "var(--accent)" : "var(--border)",
                  boxShadow: activeCard ? "0 0 0 1px var(--accent)" : "none",
                }}
              >
                <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Ask the system
                </div>
                <div className="mt-1 text-[13px] font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
                  “{s.question}”
                </div>
              </button>
            );
          })}
          <p className="px-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            In production this is a free-text box: the question is asked the way you'd ask a colleague, and every answer
            shows the assumptions it rests on.
          </p>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              Modelled answer
            </div>
            <h2 className="mt-1 text-[15px] font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
              {active.headline}
            </h2>

            <ul className="mt-4 space-y-2.5">
              {active.findings.map((f, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0">
                    <SeverityIcon severity={f.severity} />
                  </span>
                  <span className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 rounded-lg border-l-2 py-2 pl-3" style={{ borderColor: "var(--accent)", background: "var(--surface-2)" }}>
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Recommendation
              </div>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--text-primary)" }}>
                {active.recommendation}
              </p>
            </div>

            <div className="mt-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Assumptions this rests on
              </div>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs" style={{ color: "var(--text-muted)" }}>
                {active.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ol>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
