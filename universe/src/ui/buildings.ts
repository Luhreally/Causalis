// A people's home and their works as pictures (asked 2026-11-13: "when you add the visuals overhaul will i see the photo of like their
// architectural varying styles across seeds?"). Built of the same plan the town in 3D is built of — the house its land's design says (its
// walls, roof, plan and pitch, read through houseLook, as render/village.ts reads it), as many storeys as its homes stand most often; and
// its works' hall, of its material, with what drives it (sails and a wheel, a chimney, a turbine in the current, mirrors) — so a style
// differs as its seed, its age and its world's own stuff make it, and the picture agrees with the town seen near. Low-poly solids on a
// 2D canvas (ui/portrait.ts), drawn only when on screen and kept.
import type { Portrait } from "../bridge/index.ts";
import { houseLook, lifeTint } from "../view/index.ts";
import type { Solid } from "./portrait.ts";

type Rgb = readonly [number, number, number];
type House = Extract<Portrait, { kind: "house" }>;
type Works = Extract<Portrait, { kind: "works" }>;

const box = (
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  color: Rgb,
  yaw = 0,
  shape: Solid["shape"] = "box",
  pitch = 0,
): Solid => ({ x, y, z, sx, sy, sz, yaw, pitch, color, shape });

const GROUND: Rgb = [0.44, 0.6, 0.3],
  DOOR: Rgb = [0.28, 0.18, 0.11],
  GLASS: Rgb = [0.55, 0.7, 0.82],
  TIMBER: Rgb = [0.48, 0.32, 0.18];

/** One wing of a house: its walls `storeys` high, its roof as the house's is, a door on its front. */
function wing(
  out: Solid[],
  look: ReturnType<typeof houseLook>,
  x: number,
  z: number,
  len: number,
  wid: number,
  storeys: number,
  yaw: number,
  door: boolean,
): void {
  const storey = 0.42 * look.height,
    h = look.tent ? 0 : storey * storeys,
    base = look.raised;
  if (look.raised)
    for (const [dx, dz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const)
      out.push(
        box(x + dx * len * 0.4, base / 2, z + dz * wid * 0.4, 0.05, base, 0.05, TIMBER, yaw),
      );
  if (h > 0) {
    out.push(box(x, base + h / 2, z, len, h, wid, look.wall, yaw));
    // (Its windows, a row a storey above the first, where it stands more than one.)
    for (let s = 1; s < Math.min(storeys, 6); s++)
      out.push(
        box(
          x,
          base + storey * (s + 0.5),
          z + wid / 2 + 0.005,
          len * 0.7,
          storey * 0.28,
          0.01,
          GLASS,
          yaw,
        ),
      );
    if (door)
      out.push(
        box(
          x,
          base + storey * 0.32,
          z + wid / 2 + 0.01,
          len * 0.16,
          storey * 0.62,
          0.02,
          DOOR,
          yaw,
        ),
      );
  }
  // (Every house has its roof: a tent's skin, drawn as its cone from the ground; a house its land gives nothing to roof with, closed over
  // in its walls' stuff (houseLook). Only one open to the water above has none.)
  if (look.open) return;
  const rise = Math.max(0.05, look.rise * wid * 0.5),
    domed = look.round || look.tent;
  out.push(
    box(
      x,
      base + h + (look.tent ? rise : rise / 2),
      z,
      len * (domed ? 1.02 : 1.1),
      look.tent ? rise * 2 : rise,
      wid * 1.12,
      look.roof,
      yaw,
      domed ? "pyramid" : look.rise < 0.12 ? "box" : "gable",
    ),
  );
}

/** A home as its land builds it: alone on its ground, or round its courtyard where its plan is one. */
export function houseSolids(p: House): Solid[] {
  const look = houseLook(p.house, p.lifeLook),
    storeys = Math.max(1, Math.min(8, Math.round(p.storeys))),
    len = look.length * 1.3,
    wid = look.width * 1.3,
    // (Its plot a little wider than it stands, so a small picture is the house, not its ground.)
    plot = (p.house.form === "court" ? len * 1.25 : Math.max(len, wid)) * 1.35 + 0.2,
    out: Solid[] = [box(0, -0.03, 0, plot, 0.06, plot, lifeTint(GROUND, p.lifeLook))];
  if (p.house.form === "court") {
    // (Four wings round an open square, its door on the front.)
    const s = len * 1.25,
      t = wid * 0.42;
    wing(out, look, 0, s / 2 - t / 2, s, t, storeys, 0, true);
    wing(out, look, 0, -s / 2 + t / 2, s, t, storeys, 0, false);
    wing(out, look, s / 2 - t / 2, 0, t, s - 2 * t, storeys, 0, false);
    wing(out, look, -s / 2 + t / 2, 0, t, s - 2 * t, storeys, 0, false);
    out.push(box(0, 0.01, 0, s - 2 * t, 0.02, s - 2 * t, [0.7, 0.64, 0.5]));
  } else wing(out, look, 0, 0, look.round ? wid : len, wid, storeys, 0, true);
  return out;
}

/** A works hall's material as it shows: its walls the colour the town's are of the same stuff. */
const HALL_STUFF: Readonly<Record<string, Rgb>> = {
  wood: [0.66, 0.42, 0.24],
  stone: [0.78, 0.78, 0.74],
  "fired clay": [0.8, 0.36, 0.24],
  mud: [0.92, 0.7, 0.44],
  coral: [0.98, 0.6, 0.54],
  shell: [0.98, 0.95, 0.84],
  iron: [0.42, 0.42, 0.45],
  steel: [0.66, 0.69, 0.74],
  ice: [0.84, 0.92, 0.98],
  pitch: [0.24, 0.22, 0.22],
  sulfur: [0.9, 0.82, 0.42],
};
const METAL: Rgb = [0.56, 0.58, 0.62],
  DARK: Rgb = [0.22, 0.22, 0.24],
  WATER: Rgb = [0.2, 0.42, 0.7],
  SAIL: Rgb = [0.92, 0.88, 0.76];

/**
 * A land's works: its hall — a workshop, a mill-house, a factory under its sawtooth roofs, a steel hall — of its material, and what
 * drives it, turning at `t` seconds: a mill's sails and wheel, steam's chimney, power brought in on its pylon, a turbine in the current,
 * a sun engine's mirrors, the ground's heat piped up, a flame held in its ring.
 */
export function worksSolids(p: Works, t = 0): Solid[] {
  const wall = HALL_STUFF[p.material] ?? HALL_STUFF.wood!,
    roof: Rgb = [wall[0] * 0.62, wall[1] * 0.58, wall[2] * 0.58],
    out: Solid[] = [box(0, -0.03, 0, 2.4, 0.06, 1.9, lifeTint(GROUND, p.lifeLook))];
  const hall = p.hall;
  let len = 1.3,
    wid = 0.8,
    h = 0.55;
  if (hall === "mill-house") [len, wid, h] = [0.8, 0.7, 0.85];
  else if (hall === "factory") [len, wid, h] = [1.7, 1, 0.6];
  else if (hall === "steel-hall") [len, wid, h] = [1.9, 1.1, 0.8];
  out.push(box(0, h / 2, 0, len, h, wid, wall));
  if (hall === "factory") {
    // (Its sawtooth roofs, their glass to the north.)
    for (let i = 0; i < 4; i++)
      out.push(
        box(
          -len / 2 + (len * (i + 0.5)) / 4,
          h + 0.09,
          0,
          len / 4,
          0.18,
          wid * 1.02,
          roof,
          Math.PI / 2,
          "gable",
        ),
      );
  } else if (hall === "steel-hall") {
    out.push(box(0, h + 0.03, 0, len * 1.02, 0.06, wid * 1.02, roof));
    for (let i = 0; i < 5; i++)
      out.push(
        box(
          -len / 2 + (len * (i + 0.5)) / 5,
          h * 0.55,
          wid / 2 + 0.005,
          len * 0.14,
          h * 0.6,
          0.01,
          GLASS,
        ),
      );
  } else out.push(box(0, h + 0.16, 0, len * 1.1, 0.32, wid * 1.12, roof, 0, "gable"));
  out.push(box(0, 0.16, wid / 2 + 0.01, 0.22, 0.32, 0.02, DOOR));
  const turn = t * 1.2;
  switch (p.drive) {
    case "wheel-and-sail": {
      // (Four sails on its gable end, turning in the wind; a wheel turning in the race at its side.)
      const hub = { x: len / 2 + 0.05, y: h + 0.15 };
      for (let i = 0; i < 4; i++) {
        const a = turn + (i * Math.PI) / 2;
        out.push(
          box(
            hub.x,
            hub.y - Math.sin(a) * 0.38,
            Math.cos(a) * 0.38,
            0.02,
            0.12,
            0.7,
            SAIL,
            0,
            "box",
            a,
          ),
        );
      }
      out.push(box(hub.x, hub.y, 0, 0.08, 0.08, 0.08, TIMBER));
      // (Its wheel at the other end, in the race: paddles round its rim.)
      const wx = -len / 2 - 0.1;
      out.push(box(wx - 0.05, 0.01, 0, 0.5, 0.02, wid * 2, WATER));
      out.push(box(wx, 0.3, 0, 0.12, 0.08, 0.08, TIMBER));
      for (let i = 0; i < 8; i++) {
        const a = -turn + (i * Math.PI) / 4;
        out.push(
          box(
            wx,
            0.3 + Math.sin(a) * 0.26,
            Math.cos(a) * 0.26,
            0.14,
            0.07,
            0.07,
            TIMBER,
            0,
            "box",
            a,
          ),
        );
      }
      break;
    }
    case "steam":
    case "oil-engine":
    case "acetylene-engine": {
      out.push(
        box(
          len / 2 - 0.15,
          h + 0.5,
          -wid / 4,
          0.16,
          1,
          0.16,
          p.drive === "steam" ? [0.6, 0.3, 0.2] : DARK,
        ),
      );
      if (p.drive !== "steam")
        out.push(box(-len / 2 - 0.25, 0.2, 0.1, 0.36, 0.4, 0.36, METAL, 0, "box"));
      break;
    }
    case "electric":
    case "sealed-power": {
      // (Power brought in: a pylon by it, a box of switches at its wall.)
      out.push(box(-len / 2 - 0.4, 0.55, -0.2, 0.06, 1.1, 0.06, METAL));
      out.push(box(-len / 2 - 0.4, 1.05, -0.2, 0.5, 0.04, 0.04, METAL));
      out.push(box(-len / 2 - 0.08, 0.2, 0.15, 0.14, 0.3, 0.2, DARK));
      break;
    }
    case "current-turbines":
    case "vent-engines": {
      out.push(box(0, 0.01, -wid / 2 - 0.35, len * 2, 0.02, 0.5, WATER));
      for (let i = 0; i < 3; i++) {
        const a = turn * 1.5 + (i * 2 * Math.PI) / 3;
        out.push(
          box(
            len * 0.25,
            0.12 + Math.sin(a) * 0.12,
            -wid / 2 - 0.35,
            0.03,
            0.22,
            0.06,
            METAL,
            0,
            "box",
            a,
          ),
        );
      }
      break;
    }
    case "sun-engine": {
      for (let i = 0; i < 3; i++)
        out.push(box(-len / 2 - 0.5, 0.25, -0.5 + i * 0.5, 0.42, 0.02, 0.36, GLASS, 0, "box", 0.6));
      break;
    }
    case "ground-heat": {
      out.push(box(len / 2 + 0.3, 0.3, 0, 0.1, 0.6, 0.1, METAL));
      out.push(box(len / 2 + 0.15, 0.58, 0, 0.3, 0.06, 0.06, METAL));
      break;
    }
    case "fusion-flame": {
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        out.push(
          box(
            Math.cos(a) * 0.32 - len / 2 - 0.5,
            0.4,
            Math.sin(a) * 0.32,
            0.1,
            0.1,
            0.1,
            [0.9, 0.7, 1],
          ),
        );
      }
      break;
    }
  }
  return out;
}
