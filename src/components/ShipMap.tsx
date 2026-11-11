/**
 * Vessel globe — an orthographic view of the real Earth (Natural Earth
 * coastlines) centred on the China → Suez → UK sea lane, with each seaborne
 * own-label PO placed along the actual route by transit progress. Positions
 * are modelled from ETAs here; in production this reads the freight
 * forwarder's API / AIS vessel feed live.
 */

import { FACTORY_BY_ID, PO_STAGE_LABEL, PRODUCTION_POS, type PoStage } from "../data/dataset";
import { fmtInt } from "../lib/format";
import { GLOBE_SIZE, GRATICULE_PATH, LAND_PATH, LANE_POINTS, SPHERE_PATH } from "./globePaths";

const SEA_STAGES: PoStage[] = ["fob", "on-water", "customs"];

function pointAt(t: number): { x: number; y: number } {
  const pts = LANE_POINTS;
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    lengths.push(d);
    total += d;
  }
  let target = t * total;
  for (let i = 0; i < lengths.length; i++) {
    if (target <= lengths[i]) {
      const f = lengths[i] === 0 ? 0 : target / lengths[i];
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * f,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * f,
      };
    }
    target -= lengths[i];
  }
  return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
}

function wp(name: string) {
  return LANE_POINTS.find((p) => p.name === name)!;
}

function progressFor(status: PoStage, etaWeeks: number): number {
  if (status === "fob") return 0.015;
  if (status === "customs") return 0.96;
  return Math.min(0.94, Math.max(0.07, 1 - etaWeeks / 5));
}

export function ShipMap() {
  const shipments = PRODUCTION_POS.filter(
    (po) => FACTORY_BY_ID[po.factoryId].mode === "sea" && SEA_STAGES.includes(po.status),
  ).map((po, i) => ({
    po,
    vessel: po.vessel ?? "MV Harbour Light",
    progress: progressFor(po.status, po.etaWeeks),
    offset: i,
  }));

  const routePath = LANE_POINTS.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join("");
  const ports = [
    { name: "Ningbo", at: wp("shenzhen"), dx: -16, dy: 6, anchor: "end" as const },
    { name: "Singapore", at: wp("singapore"), dx: 12, dy: 14, anchor: "start" as const },
    { name: "Suez", at: wp("suez"), dx: -12, dy: -8, anchor: "end" as const },
    { name: "Felixstowe", at: wp("felixstowe"), dx: -14, dy: -12, anchor: "end" as const },
  ];

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="mx-auto w-full max-w-[480px] flex-shrink" style={{ minWidth: 280 }}>
        <svg
          viewBox={`0 0 ${GLOBE_SIZE} ${GLOBE_SIZE}`}
          role="img"
          aria-label="Globe showing own-label shipments on the China to UK sea lane"
          style={{ width: "100%", display: "block" }}
        >
          <path d={SPHERE_PATH} fill="var(--surface-1)" stroke="var(--baseline)" strokeWidth="1.5" />
          <path d={GRATICULE_PATH} fill="none" stroke="var(--grid)" strokeWidth="0.7" />
          <path d={LAND_PATH} fill="var(--surface-2)" stroke="var(--grid)" strokeWidth="1" />
          <path d={routePath} fill="none" stroke="var(--baseline)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

          {ports.map((p) => (
            <g key={p.name}>
              <circle cx={p.at.x} cy={p.at.y} r={5} fill="var(--text-muted)" stroke="var(--surface-1)" strokeWidth="2" />
              <text
                x={p.at.x + p.dx}
                y={p.at.y + p.dy}
                textAnchor={p.anchor}
                fontSize="19"
                fill="var(--text-secondary)"
                stroke="var(--surface-1)"
                strokeWidth="4"
                paintOrder="stroke"
              >
                {p.name}
              </text>
            </g>
          ))}

          {shipments.map((s) => {
            const pt = pointAt(s.progress);
            const lift = s.po.status === "fob" ? (s.offset % 2 === 0 ? -30 : 30) : 0;
            const y = pt.y + lift;
            const labelBelow = lift > 0 || s.po.status === "customs";
            return (
              <g key={s.po.id}>
                {lift !== 0 && <line x1={pt.x} y1={pt.y} x2={pt.x} y2={y} stroke="var(--baseline)" strokeWidth="1.2" />}
                <circle cx={pt.x} cy={y} r={13.5} fill="var(--surface-1)" />
                <circle cx={pt.x} cy={y} r={10} fill="var(--accent)" />
                <path d={`M${pt.x - 5.2} ${y + 1} h10.4 l-2.5 4 h-5.4 z`} fill="var(--accent-ink)" />
                <rect x={pt.x - 1.2} y={y - 5.2} width={2.4} height={5.6} fill="var(--accent-ink)" />
                <text
                  x={pt.x}
                  y={labelBelow ? y + 33 : y - 20}
                  textAnchor="middle"
                  fontSize="18.5"
                  fontWeight="700"
                  fill="var(--text-primary)"
                  stroke="var(--surface-1)"
                  strokeWidth="5"
                  paintOrder="stroke"
                >
                  {s.po.ref}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="min-w-[280px] flex-1 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-xs">
          <thead>
            <tr style={{ color: "var(--text-muted)" }}>
              {["Vessel", "PO", "Cargo", "Stage", "Lands in"].map((h, i) => (
                <th
                  key={h}
                  className={`border-b py-2 pr-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] ${i === 4 ? "text-right" : ""}`}
                  style={{ borderColor: "var(--grid)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shipments.map((s) => (
              <tr key={s.po.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                <td className="py-2 pr-3 font-semibold" style={{ color: "var(--text-primary)" }}>
                  {s.vessel}
                </td>
                <td className="pr-3" style={{ color: "var(--text-secondary)" }}>
                  {s.po.ref}
                </td>
                <td className="pr-3" style={{ color: "var(--text-secondary)" }}>
                  {fmtInt(s.po.qty)} × {s.po.cargo}
                </td>
                <td className="pr-3" style={{ color: "var(--text-secondary)" }}>
                  {PO_STAGE_LABEL[s.po.status]}
                </td>
                <td className="tnum pr-3 text-right" style={{ color: "var(--text-primary)" }}>
                  {s.po.etaWeeks <= 1 ? "this week" : `~${s.po.etaWeeks} wks`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Real coastlines, real route — Malacca Strait, the Red Sea and Suez, Gibraltar and up the Channel. Vessel positions
          are modelled from ETAs in the demo; the freight forwarder's API / AIS feed drives them live in production.
        </p>
      </div>
    </div>
  );
}
