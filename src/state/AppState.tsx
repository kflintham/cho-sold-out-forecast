import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LEVERS, type Levers } from "../engine/levers";
import { buildBuyPlan, type BuyLine } from "../engine/forecast";
import { ALERTS, type Alert } from "../engine/alerts";

export type View = "overview" | "soldout" | "buy" | "inseason" | "levers";
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

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>("overview");
  const [levers, setLeversState] = useState<Levers>(DEFAULT_LEVERS);
  const [openLine, setOpenLine] = useState<string | null>(null);
  const [focusLine, setFocusLine] = useState("SS26-HF-2611");
  const [theme, setThemeState] = useState<ThemeChoice>(readStoredTheme);

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

  const value: AppState = {
    view,
    setView,
    levers,
    setLevers: (patch) => setLeversState((l) => ({ ...l, ...patch })),
    resetLevers: () => setLeversState(DEFAULT_LEVERS),
    buyPlan,
    buyById,
    alerts: ALERTS,
    openLine,
    setOpenLine,
    focusLine,
    setFocusLine,
    theme,
    setTheme: setThemeState,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp outside AppStateProvider");
  return ctx;
}
