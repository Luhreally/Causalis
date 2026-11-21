// The god's gifts to a body held, the page's part beside app/possess.ts and app/held.ts (2026-11-21, rules/gifts.ts): a
// stroke called down seen on the screen as it falls (a bolt's white, fire's red, the ground's shudder, rain's grey), and,
// for those that are also the god's own acts on a town or its land (fire, the ground shaken, rain), the act sent through
// the one held, at its least strength, so its event says through whom (sim/acts: `through`).
import "./gifts.css";
import type { VillagePlan } from "../bridge/index.ts";

/** Slow time: the world about the one held at a quarter of its pace (the possession's clock; he moves four steps to its one). */
export const SLOW_PACE = 0.25;
/** The strength a stroke's act is laid at: the least of the god's hand's sliders (sim/acts/fortune.ts FORTUNE_STRENGTHS). */
const STROKE_STRENGTH = 0.5;
const FLASH = ["bolt", "fire", "quake", "rain"] as const;

/** The screen as a stroke falls: a flash, or a shudder, gone in a moment. */
export function smiteFlash(hud: HTMLElement, kind: number): void {
  const name = FLASH[kind];
  if (!name) return;
  const f = document.createElement("div");
  f.className = `smite-flash smite-${name}`;
  f.setAttribute("aria-hidden", "true");
  hud.append(f);
  setTimeout(() => f.remove(), 900);
}

/** The god's own act a stroke also is, at a town touched where (m) and on its land, through whom (null: a bolt is the small world's alone). */
export function smiteAct(
  kind: number,
  plan: Pick<VillagePlan, "ref" | "cell">,
  at: { x: number; z: number },
  lot: number,
  name: string,
): { type: string; args: Record<string, unknown> } | null {
  const through = name.replace(/ of .*$/, "").slice(0, 80);
  if (kind === 1)
    return {
      type: "act.fire",
      args: {
        village: plan.ref,
        ...(lot >= 0 ? { lot } : {}),
        x: at.x,
        z: at.z,
        strength: STROKE_STRENGTH,
        through,
      },
    };
  if (plan.cell === undefined) return null;
  if (kind === 2)
    return { type: "act.quake", args: { cell: plan.cell, strength: STROKE_STRENGTH, through } };
  if (kind === 3)
    return {
      type: "act.rain",
      args: { cell: plan.cell, sign: 1, years: 1, strength: STROKE_STRENGTH, through },
    };
  return null;
}
