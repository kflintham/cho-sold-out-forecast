import type { ReactNode } from "react";
import type { Severity } from "../engine/alerts";
import { useApp } from "../state/AppState";
import { PHASE_NAME, VIEW_PHASE, phaseLabel, phaseTier } from "../lib/phases";
import { Sparkline } from "./charts";

/** View header in the proposal deck's idiom: eyebrow, display headline, gradient rule. */
export function PageHeader({
  eyebrow,
  title,
  sub,
  right,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  const { view } = useApp();
  const phase = VIEW_PHASE[view];
  const tier = phaseTier(phase);
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-wide"
            style={{
              background: tier === "Full platform" ? "var(--surface-2)" : "var(--grad)",
              color: tier === "Full platform" ? "var(--text-secondary)" : "#ffffff",
              border: tier === "Full platform" ? "1px solid var(--border)" : "none",
            }}
            title={phase === "all" ? "Included with every phase" : PHASE_NAME[phase]}
          >
            {phase === "all" ? "Every phase" : `${phaseLabel(phase)} · ${tier}`}
          </span>
          <span className="eyebrow">{eyebrow}</span>
        </div>
        <h1 className="mt-1.5 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h1>
        <div className="grad-rule mt-2" />
        {sub && (
          <p className="mt-2 max-w-3xl text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {sub}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  children,
  className = "",
  actions,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border p-4 ${className}`}
      style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
    >
      {(title || actions) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                {subtitle}
              </p>
            )}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  sub,
  spark,
  status,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  spark?: number[];
  status?: { severity: Severity; text: string };
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
    >
      <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="disp text-[25px] font-semibold leading-8" style={{ color: "var(--text-primary)" }}>
          {value}
        </div>
        {spark && <Sparkline values={spark} />}
      </div>
      {sub && (
        <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {sub}
        </div>
      )}
      {status && (
        <div className="mt-1.5">
          <SeverityBadge severity={status.severity} text={status.text} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status — reserved colors, always icon + label, never color alone.
// ---------------------------------------------------------------------------

export const SEVERITY_META: Record<Severity, { label: string; varName: string }> = {
  critical: { label: "Critical", varName: "--status-critical" },
  serious: { label: "Serious", varName: "--status-serious" },
  warning: { label: "Worth acting on", varName: "--status-warning" },
  good: { label: "No action needed", varName: "--status-good" },
  info: { label: "Note", varName: "--baseline" },
};

export function SeverityIcon({ severity, size = 14 }: { severity: Severity; size?: number }) {
  const c = `var(${SEVERITY_META[severity].varName})`;
  const common = { width: size, height: size, viewBox: "0 0 16 16", "aria-hidden": true } as const;
  switch (severity) {
    case "critical":
      return (
        <svg {...common}>
          <path d="M5 1h6l4 4v6l-4 4H5l-4-4V5z" fill={c} />
          <rect x="7.2" y="4" width="1.6" height="5" rx="0.8" fill="#fff" />
          <circle cx="8" cy="11.2" r="1" fill="#fff" />
        </svg>
      );
    case "serious":
      return (
        <svg {...common}>
          <path d="M8 1.5 15 14H1z" fill={c} />
          <rect x="7.2" y="6" width="1.6" height="4" rx="0.8" fill="#fff" />
          <circle cx="8" cy="12" r="1" fill="#fff" />
        </svg>
      );
    case "warning":
      return (
        <svg {...common}>
          <rect x="2" y="2" width="12" height="12" rx="3" fill={c} />
          <rect x="7.2" y="4.5" width="1.6" height="4.5" rx="0.8" fill="#0b0b0b" />
          <circle cx="8" cy="11.3" r="1" fill="#0b0b0b" />
        </svg>
      );
    case "good":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="7" fill={c} />
          <path d="M4.6 8.2l2.2 2.2 4.4-4.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="7" fill="none" stroke={c} strokeWidth="1.6" />
          <rect x="7.2" y="7" width="1.6" height="4.4" rx="0.8" fill="var(--text-secondary)" />
          <circle cx="8" cy="4.8" r="1" fill="var(--text-secondary)" />
        </svg>
      );
  }
}

export function SeverityBadge({ severity, text }: { severity: Severity; text?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
      <SeverityIcon severity={severity} />
      {text ?? SEVERITY_META[severity].label}
    </span>
  );
}

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]"
      style={{
        borderColor: tone === "accent" ? "var(--accent)" : "var(--border)",
        color: tone === "accent" ? "var(--accent)" : "var(--text-secondary)",
        background: "var(--surface-1)",
      }}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-5.5 w-10 shrink-0 items-center rounded-full transition-colors"
      style={{ background: checked ? "var(--accent)" : "var(--baseline)" }}
    >
      <span
        className="absolute h-4 w-4 rounded-full transition-all"
        style={{ background: "#fff", left: checked ? 21 : 3 }}
      />
    </button>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg border p-0.5"
      style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      role="group"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className="rounded-md px-2.5 py-1 text-xs font-medium"
            style={{
              background: active ? "var(--surface-1)" : "transparent",
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function LeverRow({
  name,
  description,
  control,
}: {
  name: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
          {name}
        </div>
        <div className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {description}
        </div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
