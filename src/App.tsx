import type { ReactNode } from "react";
import { useApp, type View } from "./state/AppState";
import { Overview } from "./views/Overview";
import { SoldOut } from "./views/SoldOut";
import { BuyPlan } from "./views/BuyPlan";
import { TrueDemand } from "./views/TrueDemand";
import { Deliveries } from "./views/Deliveries";
import { OrderTimeline } from "./views/OrderTimeline";
import { Advisories } from "./views/Advisories";
import { Scenarios } from "./views/Scenarios";
import { LeversView } from "./views/LeversView";
import { LineDrawer } from "./components/LineDrawer";

const ICONS: Record<View, ReactNode> = {
  overview: (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <rect x="1.5" y="1.5" width="5.5" height="7" rx="1.5" fill="currentColor" />
      <rect x="9" y="1.5" width="5.5" height="4" rx="1.5" fill="currentColor" opacity="0.55" />
      <rect x="9" y="7.5" width="5.5" height="7" rx="1.5" fill="currentColor" />
      <rect x="1.5" y="10.5" width="5.5" height="4" rx="1.5" fill="currentColor" opacity="0.55" />
    </svg>
  ),
  soldout: (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <path d="M1.5 12.5l4-5 3 2.5 5.5-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="14" cy="3" r="1.8" fill="currentColor" />
    </svg>
  ),
  buy: (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <rect x="1.5" y="4.5" width="13" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 4.5v9M10.5 4.5v9" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
      <path d="M4.5 2.5h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  demand: (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <rect x="1.5" y="8" width="3" height="6.5" rx="1" fill="currentColor" opacity="0.55" />
      <rect x="6.5" y="4.5" width="3" height="10" rx="1" fill="currentColor" />
      <rect x="11.5" y="1.5" width="3" height="13" rx="1" fill="currentColor" opacity="0.55" />
    </svg>
  ),
  deliveries: (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <path d="M1.5 3.5h8v7.5h-8z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9.5 6h3l2 2.5V11h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="4.5" cy="12.5" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12.5" r="1.6" fill="currentColor" />
    </svg>
  ),
  timeline: (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <path d="M1.5 8h13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="3.2" cy="8" r="2" fill="currentColor" />
      <circle cx="8" cy="8" r="2" fill="var(--side-bg)" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12.8" cy="8" r="2" fill="var(--side-bg)" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  scenarios: (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <path d="M2 8h4l1.5-3 2 6L11 8h3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  advisories: (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <path d="M8 1.8a4.4 4.4 0 0 1 4.4 4.4c0 3 .9 4 1.6 4.7H2c.7-.7 1.6-1.7 1.6-4.7A4.4 4.4 0 0 1 8 1.8z" fill="currentColor" />
      <path d="M6.4 13.2a1.7 1.7 0 0 0 3.2 0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  levers: (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <path d="M2 4.5h12M2 11.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10.5" cy="4.5" r="2.1" fill="var(--side-bg)" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="5.5" cy="11.5" r="2.1" fill="var(--side-bg)" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
};

const NAV: { view: View; label: string }[] = [
  { view: "overview", label: "Overview" },
  { view: "soldout", label: "Sold-out forecast" },
  { view: "demand", label: "True demand" },
  { view: "buy", label: "SS27 buy plan" },
  { view: "deliveries", label: "Deliveries" },
  { view: "timeline", label: "Order timeline" },
  { view: "advisories", label: "Advisories" },
  { view: "scenarios", label: "Scenarios" },
  { view: "levers", label: "Levers" },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <defs>
          <linearGradient id="brand-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6f34a2" />
            <stop offset="0.55" stopColor="#b76788" />
            <stop offset="1" stopColor="#ef9256" />
          </linearGradient>
        </defs>
        <path d="M7 5l11 11L7 27v-7l4-4-4-4z" fill="url(#brand-g)" />
        <path d="M15 5l11 11-11 11v-7l4-4-4-4z" fill="url(#brand-g)" opacity="0.6" />
      </svg>
      <div className="leading-tight">
        <div className="disp text-[13px] font-bold tracking-[0.22em]" style={{ color: "var(--side-ink)" }}>
          ELEVATE
        </div>
        <div className="text-[11px] tracking-wide" style={{ color: "var(--side-muted)" }}>
          Sold-out forecast
        </div>
      </div>
    </div>
  );
}

function ThemeControl({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useApp();
  const options = compact
    ? ([["system", "A"], ["light", "L"], ["dark", "D"]] as const)
    : ([["system", "Auto"], ["light", "Light"], ["dark", "Dark"]] as const);
  return (
    <div
      className="inline-flex rounded-lg p-0.5"
      style={{ background: "rgba(255,255,255,0.07)" }}
      role="group"
      aria-label="Theme"
    >
      {options.map(([value, label]) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(value)}
            className="rounded-md px-2.5 py-1 text-xs font-medium"
            style={{
              background: active ? "rgba(255,255,255,0.14)" : "transparent",
              color: active ? "var(--side-ink)" : "var(--side-muted)",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function App() {
  const { view, setView, alerts } = useApp();
  const critical = alerts.filter((a) => a.severity === "critical").length;

  const Nav = ({ horizontal = false }: { horizontal?: boolean }) => (
    <nav
      aria-label="Sections"
      className={horizontal ? "flex gap-1 overflow-x-auto" : "flex flex-col gap-0.5"}
    >
      {NAV.map((n) => {
        const active = view === n.view;
        return (
          <button
            key={n.view}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => setView(n.view)}
            className={`relative flex items-center gap-2.5 rounded-lg py-2 pl-3.5 pr-3 text-[13px] font-medium ${horizontal ? "shrink-0" : "w-full text-left"}`}
            style={{
              background: active ? "rgba(255,255,255,0.07)" : "transparent",
              color: active ? "var(--side-ink)" : "var(--side-muted)",
            }}
          >
            {active && (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full"
                style={{ background: "var(--grad)" }}
              />
            )}
            <span style={{ color: active ? "#ef9256" : "var(--side-muted)" }}>{ICONS[n.view]}</span>
            {n.label}
            {n.view === "advisories" && critical > 0 && (
              <span
                className="tnum ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold"
                style={{ background: "var(--status-critical)", color: "#fff" }}
              >
                {critical}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-full">
      <aside
        className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between p-4 lg:flex"
        style={{ background: "var(--side-bg)" }}
      >
        <div>
          <Brand />
          <div className="mt-6">
            <Nav />
          </div>
        </div>
        <div className="space-y-3">
          <ThemeControl />
          <div
            className="rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed"
            style={{ borderColor: "var(--side-border)", color: "var(--side-muted)", background: "var(--side-card)" }}
          >
            <span className="font-semibold" style={{ color: "var(--side-ink)" }}>
              Demo — synthetic data.
            </span>{" "}
            Every brand, style and number is invented. As of Thu 12 Nov 2026.
          </div>
          <div className="text-[11px]" style={{ color: "var(--side-muted)" }}>
            Prepared for CHO · Elevate · Commercial in confidence
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header
          className="sticky top-0 z-20 px-4 py-3 lg:hidden"
          style={{ background: "var(--side-bg)" }}
        >
          <div className="flex items-center justify-between">
            <Brand />
            <ThemeControl compact />
          </div>
          <div className="-mx-1 mt-2 px-1">
            <Nav horizontal />
          </div>
        </header>

        <main className="w-full p-4 pb-16 lg:p-6 2xl:px-10">
          {view === "overview" && <Overview />}
          {view === "soldout" && <SoldOut />}
          {view === "buy" && <BuyPlan />}
          {view === "demand" && <TrueDemand />}
          {view === "deliveries" && <Deliveries />}
          {view === "timeline" && <OrderTimeline />}
          {view === "advisories" && <Advisories />}
          {view === "scenarios" && <Scenarios />}
          {view === "levers" && <LeversView />}
        </main>
      </div>

      <LineDrawer />
    </div>
  );
}
