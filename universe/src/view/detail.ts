// Deeper making (Phase 8 M79): things built more finely as the setting allows. People's
// faces, hands and hair; homes' windows (lit at night), chimneys, porches and fences, by
// their era; what a carried thing is made of, told — a stone hoe knapped from flint, a
// bronze one of copper and tin, a steel one of iron and a little carbon — and each
// material's sheen (metals bright, wood and cloth matte). All of it presentation.
import { finish, hashString, mix } from "../kernel/index.ts";
import type { VillagePlan } from "../bridge/index.ts";
import type { Carry, Material } from "./work.ts";

type Rgb = readonly [number, number, number];

/** Hair, by the person (keyed): black, dark brown, brown, auburn, fair; grey in old age. */
export const HAIRS: readonly Rgb[] = [
  [0.08, 0.07, 0.06],
  [0.22, 0.14, 0.08],
  [0.38, 0.24, 0.12],
  [0.52, 0.22, 0.1],
  [0.82, 0.68, 0.38],
  [0.7, 0.7, 0.7],
];

/** Which of the hairs a person has: keyed by who they are; grey from late in their people's span. */
export function hairOf(ref: string, age: number, span = 70): number {
  if (age >= (58 * span) / 70) return HAIRS.length - 1;
  return (finish(mix(hashString(ref), 11), 7) >>> 0) % (HAIRS.length - 1);
}

/** A home's finer parts, in its own frame (units; +z its front, as its door faces). */
export type HomePiece = {
  readonly role: "window" | "chimney" | "porch" | "post" | "fence";
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  /** Turned about the home's own up axis (a fence's run). */
  readonly yaw: number;
};

/**
 * A home's finer parts at a setting's detail: windows either side of its door and along
 * its sides (from Balanced); a chimney (a pitched roof in the farming ages and after); a
 * porch over the door (High); a fence about a watched home's yard (Ultra).
 */
export function homeDetail(
  look: {
    length: number;
    width: number;
    tent: boolean;
    open: boolean;
    round: boolean;
    raised: number;
  },
  walls: number,
  roofTop: number,
  era: VillagePlan["era"],
  detail: number,
  watched: boolean,
): HomePiece[] {
  const out: HomePiece[] = [];
  if (look.tent || look.open || detail < 1) return out;
  const w = look.width / 2,
    l = look.length / 2,
    sill = look.raised + walls * 0.45,
    win = Math.min(0.12, walls * 0.3),
    add = (
      role: HomePiece["role"],
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      yaw = 0,
    ) => out.push({ role, x, y, z, sx, sy, sz, yaw });
  if (!look.round) {
    // Front windows beside the door; one on each side wall.
    for (const s of [-1, 1]) add("window", s * l * 0.55, sill, w + 0.012, win, win, 0.02);
    for (const s of [-1, 1]) add("window", s * (l + 0.012), sill, 0, 0.02, win, win);
  } else
    for (const a of [-0.9, 0.9])
      add("window", Math.sin(a) * w, sill, Math.cos(a) * w, win, win, 0.03, a);
  // A chimney through the roof, once there is a hearth to draw.
  if (era !== "forage")
    add(
      "chimney",
      l * 0.45,
      roofTop * 0.92,
      -w * 0.25,
      0.08,
      Math.max(0.16, roofTop - walls) * 0.9 + 0.1,
      0.08,
    );
  if (detail >= 2 && !look.round) {
    // A porch roof over the door, on two posts.
    add("porch", 0, look.raised + walls * 0.72, w + 0.09, 0.3, 0.02, 0.17);
    for (const s of [-1, 1])
      add("post", s * 0.13, look.raised + walls * 0.36, w + 0.16, 0.02, walls * 0.72, 0.02);
  }
  if (detail >= 3 && watched) {
    // A fence about the yard before it: three runs, open at the gate.
    const yard = w + 0.55,
      side = l + 0.25;
    add("fence", 0, 0.05, yard, side * 2, 0.07, 0.02);
    for (const s of [-1, 1]) add("fence", s * side, 0.05, (w + yard) / 2, 0.02, 0.07, yard - w);
  }
  return out;
}

/** Windows by the hour: dark glass by day, lamplight from dusk to dawn (0 … 1). */
export function lamplight(hour: number): number {
  if (hour >= 21 || hour < 5) return 1;
  if (hour >= 18) return (hour - 18) / 3;
  if (hour < 7) return 1 - (hour - 5) / 2;
  return 0;
}

// —— What things are made of ————————————————————————————————————————————————————

/** What a tool's head is made of in an era, and what that is made of (the chemistry told). */
export function metalOf(era: VillagePlan["era"]): { name: string; of: string } {
  switch (era) {
    case "metal":
      return { name: "bronze", of: "copper and tin, smelted together" };
    case "industry":
      return { name: "iron", of: "iron ore smelted with coke in a furnace" };
    case "modern":
      return { name: "steel", of: "iron with a little carbon, blown in a converter" };
    default:
      return { name: "stone", of: "flint knapped to an edge" };
  }
}

/** A carried thing in words, with what it is made of where that is worth telling. */
export function carryWords(
  carry: Carry,
  era: VillagePlan["era"],
  what: "coal" | "ore" | "stone" | null = null,
): string {
  const m = metalOf(era);
  switch (carry) {
    case "tool":
      return `a ${m.name}-headed tool (${m.name}: ${m.of})`;
    case "sheaf":
      return "sheaves from the harvest";
    case "sack":
      return "a sack of wares";
    case "basket":
      return "a basket of what the wild gives";
    case "fish":
      return "the day's catch";
    case "ore":
      return what === "coal"
        ? "a load of coal (the buried forests of the deep ages)"
        : what === "stone"
          ? "cut stone"
          : "a load of ore (copper in its rock, to be smelted)";
    case "pack":
      return "a trader's pack";
    case "staff":
      return "a herder's staff";
    case "water":
      return "a bucket of water from the well";
  }
}

/** Each material's sheen: metal bright, the rest matte (gloss 0 … 1, and whether metallic). */
export const SHEEN: Readonly<Record<Material, { gloss: number; metal: boolean }>> = {
  wood: { gloss: 0.15, metal: false },
  head: { gloss: 0.75, metal: true },
  straw: { gloss: 0.1, metal: false },
  cloth: { gloss: 0.05, metal: false },
  wicker: { gloss: 0.1, metal: false },
  catch: { gloss: 0.8, metal: false },
  rock: { gloss: 0.3, metal: false },
  leather: { gloss: 0.35, metal: false },
  water: { gloss: 0.9, metal: false },
};
