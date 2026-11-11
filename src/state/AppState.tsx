import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LEVERS, type Levers } from "../engine/levers";
import { buildBuyPlan, type BuyLine } from "../engine/forecast";
import { buildAlerts, type Alert } from "../engine/alerts";
import { ORDER_TIMELINES, type CpStatus, type OrderTimeline } from "../data/dataset";

export type View =
  | "overview"
  | "soldout"
  | "demand"
  | "buy"
  | "deliveries"
  | "timeline"
  | "ownlabel"
  | "advisories"
  | "scenarios"
  | "levers";
export type ThemeChoice = "system" | "light" | "dark";

interface AppState {
  view: View;
  setView: (v: View) => void;
  levers: Levers;
  setLevers: (patch: Partial<Levers>) => void;
  resetLevers: () => void;
  buyPlan: BuyLine[];
  buyById: Map<string, BuyLine>;
  alerts: Alert[];
  /** line open in the drill-down drawer */
  openLine: string | null;
  setOpenLine: (id: string | null) => void;
  /** line featured on the sold-out screen */
  focusLine: string;
  setFocusLine: (id: string) => void;
  theme: ThemeChoice;
  setTheme: (t: ThemeChoice) => void;
  timelines: OrderTimeline[];
  addTimeline: (t: OrderTimeline) => void;
  removeTimeline: (id: string) => void;
  cycleStage: (id: string, stageIndex: number) => void;
}

const Ctx = createContext<AppState | null>(null);

function readStoredTheme(): ThemeChoice {
  try {
    const t = localStorage.getItem("cho-theme");
    if (t === "light" || t === "dark" || t === "system") return t;
  } catch {
    /* storage unavailable — fall through to system */
  }
  return "system";
}

const NEXT_STATUS: Record<CpStatus, CpStatus> = {
  pending: "in-progress",
  "in-progress": "done",
  done: "pending",
  blocked: "done", // clicking a blocked gate clears it (budget signed off)
};

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>("overview");
  const [levers, setLeversState] = useState<Levers>(DEFAULT_LEVERS);
  const [openLine, setOpenLine] = useState<string | null>(null);
  const [focusLine, setFocusLine] = useState("SS26-HF-2611");
  const [theme, setThemeState] = useState<ThemeChoice>(readStoredTheme);
  const [timelines, setTimelines] = useState<OrderTimeline[]>(ORDER_TIMELINES);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("cho-theme", theme);
    } catch {
      /* fine without persistence */
    }
  }, [theme]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  const buyPlan = useMemo(() => buildBuyPlan(levers), [levers]);
  const buyById = useMemo(() => new Map(buyPlan.map((b) => [b.fc.line.id, b])), [buyPlan]);
  const alerts = useMemo(() => buildAlerts(levers, buyPlan), [levers, buyPlan]);

  const value: AppState = {
    view,
    setView,
    levers,
    setLevers: (patch) => setLeversState((l) => ({ ...l, ...patch })),
    resetLevers: () => setLeversState(DEFAULT_LEVERS),
    buyPlan,
    buyById,
    alerts,
    openLine,
    setOpenLine,
    focusLine,
    setFocusLine,
    theme,
    setTheme: setThemeState,
    timelines,
    addTimeline: (t) => setTimelines((l) => [...l, t]),
    removeTimeline: (id) => setTimelines((l) => l.filter((t) => !(t.id === id && t.custom))),
    cycleStage: (id, stageIndex) =>
      setTimelines((l) =>
        l.map((t) =>
          t.id !== id
            ? t
            : {
                ...t,
                stages: t.stages.map((s, i) =>
                  i === stageIndex
                    ? { ...s, status: NEXT_STATUS[s.status], note: s.status === "blocked" ? undefined : s.note }
                    : s,
                ),
              },
        ),
      ),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp outside AppStateProvider");
  return ctx;
}
