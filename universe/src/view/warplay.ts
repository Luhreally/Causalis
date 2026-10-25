// War in place (Phase 40 M203, asked for 2026-10-25: "...and like the more fluid views of wars
// and just actions of stuff yk"). History fights a war's battle once a year, at the year's turn,
// for the land its attacker wants most then (sim/war: frontier), and what it will want is known
// from the year's start (a probe of "first light", years 110–130: right in 98% of months, its
// mind changed once in 184 battles). So between the turns its hosts are seen doing what
// Classic's did (142–143), on the world's own clock:
// - the attacker's host musters in its land nearest that, marches on it by the roads, and draws
//   up before it;
// - the defenders' host keeps its seat, rallies to the land, and comes out to meet it;
// - the two are engaged as the year ends, and the battle is fought at its turn.
// After the battle, the beaten fall back or fly. The victors hold the field, then march into the
// land taken or lay siege to the seat; they camp about the seat all year and storm it at its end.
// At peace, both go home. Pure: where each host is, and at what, at a moment of the world's.
import { HEART_REACH, heartTown, type BattleOutcome, type WarsMap } from "../bridge/index.ts";
import { roadLine, roadTiles, tileOf, wayOf, type LandGround, type Way } from "./land.ts";
import { holdShape, landShape, type LandSpots } from "./war.ts";

type War = WarsMap["wars"][number];
type Fought = War["battles"][number];
type Flat = { readonly x: number; readonly z: number };

/**
 * When, through a war's year (from the turn its last battle was fought, 0, to the turn its next
 * is, 1), its hosts do what.
 */
export const WAR_YEAR = {
  /** The beaten in flight from the field until then. */
  rout: 0.03,
  /** The victors in the land taken or about the seat besieged, the beaten gone home, by then. */
  after: 0.15,
  /** Its host mustered by then; on the march until `marched`; drawn up until `engage`; engaged to the turn. */
  mustered: 0.3,
  marched: 0.82,
  engage: 0.94,
  /** The defenders' host rallies from its seat from then, to be drawn up before the land by `marched`. */
  rally: 0.55,
  /** At peace: both hosts home by then, and stood down over `disband` more. */
  home: 0.45,
  disband: 0.05,
} as const;

/** What a war's host is at. */
export type HostDoing =
  | "mustering"
  | "marching"
  | "facing"
  | "engaged"
  | "garrisoned"
  | "rallying"
  | "holding"
  | "withdrawing"
  | "routed"
  | "entering"
  | "besieging"
  | "assaulting"
  | "besieged"
  | "returning";

/** Each doing's sign, as a host's mark shows it. */
export const DOING_ICON: Readonly<Record<HostDoing, string>> = {
  mustering: "📯",
  marching: "🚩",
  facing: "🛡️",
  engaged: "⚔️",
  garrisoned: "🏰",
  rallying: "📯",
  holding: "🚩",
  withdrawing: "↩️",
  routed: "💨",
  entering: "🏴",
  besieging: "⛺",
  assaulting: "🪜",
  besieged: "🏰",
  returning: "🏠",
};

/** A doing told, about the land it is at or goes for ("Lithiv's land"). */
export function doingWords(doing: HostDoing, land: string): string {
  switch (doing) {
    case "mustering":
      return `mustering in ${land}`;
    case "marching":
      return `marching on ${land}`;
    case "facing":
      return `drawn up before ${land}`;
    case "engaged":
      return `fighting for ${land}`;
    case "garrisoned":
      return `holding ${land}`;
    case "rallying":
      return `rallying to ${land}`;
    case "holding":
      return `holding the field at ${land}`;
    case "withdrawing":
      return `falling back from ${land}`;
    case "routed":
      return `fleeing the field at ${land}`;
    case "entering":
      return `marching into ${land}`;
    case "besieging":
      return `besieging ${land}`;
    case "assaulting":
      return `storming the walls of ${land}`;
    case "besieged":
      return `on the walls of ${land}`;
    case "returning":
      return `going home to ${land}`;
  }
}

/** A host of a war now: what it is at, and its way between two lands (spots of the globe's grid). */
export type HostNow = {
  /** 0 the attacker's, 1 the defender's. */
  readonly side: 0 | 1;
  readonly doing: HostDoing;
  /** Its way now, from one land to another (the same: it stands there), and how far along (0 … 1). */
  readonly from: number;
  readonly to: number;
  readonly k: number;
  /** The land it fights, or fought, for. */
  readonly front: number;
  /** How much of it is there (0 … 1): coming in as it musters, gone as it stands down. */
  readonly gathered: number;
  /** What it is at, told. */
  readonly words: string;
};

export type WarNow = {
  readonly ref: string;
  /** The turn its year began at (the world's years), and how far through the year it is (0 … 1). */
  readonly turn: number;
  readonly f: number;
  readonly attacker: HostNow | null;
  readonly defender: HostNow | null;
  /** The battle its year ends in, once its hosts are drawn up for it: where, whether engaged yet, and how near the turn (0 … 1). */
  readonly closing: { readonly spot: number; readonly engaged: boolean; readonly k: number } | null;
  /** The battle its year began with (fought at its turn), and what came of it. */
  readonly fought: { readonly battle: Fought; readonly outcome: BattleOutcome } | null;
  /** A seat under siege (its besiegers' camp about it), or null. */
  readonly siege: number | null;
  /** A land held by its own garrison while the defenders' host is yet to come to it, or null. */
  readonly held: number | null;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

/**
 * A war at `y` (the world's years, fractional), as its map of `mapYear` knows it: past a turn its
 * map has not come for yet, as at the year's very end (its hosts still engaged). Null: not begun
 * by then, or over (its hosts home).
 */
export function warNow(w: War, y: number, mapYear: number): WarNow | null {
  const T = WAR_YEAR,
    at = Math.min(y, mapYear + 1 - 1e-9),
    turn = Math.floor(at),
    f = at - turn;
  // (Declared at a turn: the year after it is its first. Ended at a turn: its hosts go home after.)
  if (w.declared > turn - 1) return null;
  if (w.ended !== null && w.ended < turn - 1) return null;
  const prev = w.battles.find((b) => b.year === turn - 1) ?? null,
    outcome: BattleOutcome | null = prev ? (prev.outcome ?? (prev.won ? "taken" : "held")) : null,
    peace = w.ended !== null,
    seatA = w.seats && w.seats.attacker >= 0 ? w.seats.attacker : w.from,
    seatD = w.seats && w.seats.defender >= 0 ? w.seats.defender : w.to,
    muster = w.muster ?? w.from,
    next = peace ? null : (w.next ?? null),
    named = (spot: number) => w.places?.find((p) => p.spot === spot)?.name ?? "the land",
    host = (
      side: 0 | 1,
      doing: HostDoing,
      from: number,
      to: number,
      k: number,
      front: number,
      about: number,
      gathered = 1,
    ): HostNow => ({
      side,
      doing,
      from,
      to,
      k: clamp01(k),
      front,
      gathered: clamp01(gathered),
      words: doingWords(doing, named(about)),
    });
  let attacker: HostNow | null = null,
    defender: HostNow | null = null,
    closing: WarNow["closing"] = null,
    held: number | null = null;
  const begin = prev ? T.after : 0;
  if (prev && prev.spot >= 0 && f < T.after) {
    // The battle the year began with, at its end.
    const P = prev.spot,
      flight = ease(f / T.after),
      into = ease((f - T.rout) / (T.after - T.rout));
    if (outcome === "held") {
      attacker = host(0, "withdrawing", P, muster, flight, P, P);
      defender = host(1, "holding", P, P, 1, P, P);
    } else if (outcome === "siege") {
      attacker = host(0, f < T.rout ? "holding" : "besieging", P, P, 1, P, P);
      defender =
        f < T.rout
          ? host(1, "routed", P, P, ease(f / T.rout), P, P)
          : host(1, "besieged", P, P, 1, P, P);
    } else {
      // The field won, and the land with it (or the seat stormed, its realm fallen).
      attacker =
        outcome === "field" || f < T.rout
          ? host(0, "holding", P, P, 1, P, P)
          : host(0, "entering", P, P, into, P, P);
      defender =
        outcome === "stormed"
          ? f < T.rout
            ? host(1, "routed", P, P, 1, P, P, 1 - ease(f / T.rout))
            : null
          : host(1, "routed", P, seatD, flight, P, P, 1 - 0.5 * flight);
    }
  } else if (peace) {
    // Peace made at the turn: both hosts go home, and stand down there.
    const from = prev && prev.spot >= 0 ? prev.spot : muster,
      g = ease((f - begin) / (T.home - begin)),
      gone = 1 - clamp01((f - T.home) / T.disband);
    if (gone > 0) {
      attacker = host(0, "returning", from, seatA, g, from, seatA, gone);
      if (outcome !== "stormed") defender = host(1, "returning", from, seatD, g, from, seatD, gone);
    }
  } else if (w.siege !== null && (next === w.siege || next === null)) {
    // The seat under siege: its besiegers about it all year, storming its walls as it ends.
    const S = w.siege,
      storm = f >= T.engage;
    attacker = host(0, storm ? "assaulting" : "besieging", S, S, 1, S, S);
    defender = host(1, storm ? "engaged" : "besieged", S, S, 1, S, S);
    if (storm) closing = { spot: S, engaged: true, k: (f - T.engage) / (1 - T.engage) };
  } else if (next !== null) {
    // The year's march: mustered, on the way, drawn up before what it wants, engaged.
    if (f < T.mustered)
      attacker = host(
        0,
        "mustering",
        muster,
        muster,
        1,
        next,
        muster,
        0.25 + 0.75 * ease((f - begin) / (T.mustered - begin)),
      );
    else if (f < T.marched)
      attacker = host(
        0,
        "marching",
        muster,
        next,
        ease((f - T.mustered) / (T.marched - T.mustered)),
        next,
        next,
      );
    else attacker = host(0, f < T.engage ? "facing" : "engaged", muster, next, 1, next, next);
    // The defenders: the land's own garrison holds it while their host keeps the seat, then rallies.
    const D = seatD >= 0 ? seatD : next;
    if (f >= T.marched)
      defender = host(1, f < T.engage ? "facing" : "engaged", D, next, 1, next, next);
    else if (D === next) defender = host(1, "garrisoned", next, next, 1, next, next);
    else if (f >= T.rally) {
      defender = host(
        1,
        "rallying",
        D,
        next,
        ease((f - T.rally) / (T.marched - T.rally)),
        next,
        next,
      );
      held = next;
    } else {
      defender = host(1, "garrisoned", D, D, 1, next, D);
      held = next;
    }
    if (f >= T.marched)
      closing = {
        spot: next,
        engaged: f >= T.engage,
        k: (f - T.marched) / (1 - T.marched),
      };
  } else {
    // Nothing left between them to fight for: the war ends at the turn; its hosts wait at home.
    attacker = host(0, "garrisoned", muster, muster, 1, muster, muster);
    defender = host(1, "garrisoned", seatD, seatD, 1, seatD, seatD);
  }
  return {
    ref: w.ref,
    turn,
    f,
    attacker,
    defender,
    closing,
    fought: prev && outcome ? { battle: prev, outcome } : null,
    siege: peace ? null : w.siege,
    held,
  };
}

// —— On the globe ——————————————————————————————————————————————————————————————

/**
 * The wars of a map at `y` as the globe draws them in place (M203): each war's way now, from the
 * attacker's land to the land it fights for, and how far along it its host is (as a war watched
 * unfolding is drawn, Phase 38). A war whose hosts are home is drawn as ended.
 */
export function globeInPlace(
  map: WarsMap,
  y: number,
): { map: WarsMap; marching: Map<string, number> } {
  const marching = new Map<string, number>(),
    wars = map.wars.map((w) => {
      const n = warNow(w, y, map.year),
        a = n?.attacker;
      if (!n || !a) return { ...w, ended: w.ended ?? Math.floor(y) };
      const base = w.muster ?? w.from;
      let from: number, to: number, k: number;
      switch (a.doing) {
        case "marching":
          [from, to, k] = [a.from, a.to, a.k];
          break;
        // (Going back the way it came: its way still runs to what it fought for.)
        case "withdrawing":
        case "returning":
          [from, to, k] = [a.to, a.from, 1 - a.k];
          break;
        case "mustering":
        case "garrisoned":
          [from, to, k] = [a.from, a.front, 0];
          break;
        default:
          [from, to, k] = [base, a.front, 1];
      }
      if (from === to) from = from === w.from ? (w.seats?.attacker ?? w.from) : w.from;
      marching.set(w.ref, k);
      return { ...w, from, to, ended: null, siege: n.siege };
    });
  return { map: { ...map, wars }, marching };
}

// —— In a land ——————————————————————————————————————————————————————————————————

/** How far before a town's edge its battles are fought (km), each host drawn up off the field's middle, and where they meet. */
export const FIELD_GAP = 4;
const FACE = 3,
  MEET = 0.55,
  /** A column's ranks and files apart; a block's ranks. */
  RANK = 1.1,
  FILE = 0.9,
  /** How far beyond its walls a seat's besiegers camp. */
  CAMP_GAP = 3;

/** Ways over a land between points, by its roads' reckoning (round the water, easy on the climbs), each worked out once. */
export class LandWays {
  private readonly kept = new Map<string, Way>();
  private readonly g: LandGround;
  constructor(g: LandGround) {
    this.g = g;
  }
  way(from: Flat, to: Flat): Way {
    const a = tileOf(this.g, from.x, from.z),
      b = tileOf(this.g, to.x, to.z),
      key = `${a}>${b}`;
    let w = this.kept.get(key);
    if (!w) {
      const tiles = a === b ? [] : roadTiles(this.g, a, b),
        // (No way by land, across the sea: straight over it, in ships.)
        line = tiles.length >= 2 ? roadLine(this.g, tiles) : [from, to];
      w = wayOf([from, ...line.slice(1, -1), to]);
      if (this.kept.size >= 96) this.kept.clear();
      this.kept.set(key, w);
    }
    return w;
  }
}

/** A point `d` along a way (past its ends, on along their bearings), and which way it goes there. */
export function onWay(w: Way, d: number): { x: number; z: number; ux: number; uz: number } {
  const pts = w.line,
    n = pts.length;
  if (n < 2) return { x: pts[0]?.x ?? 0, z: pts[0]?.z ?? 0, ux: 1, uz: 0 };
  const seg = (i: number) => {
    const a = pts[i]!,
      b = pts[i + 1]!,
      l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { a, ux: (b.x - a.x) / l, uz: (b.z - a.z) / l };
  };
  if (d <= 0) {
    const s = seg(0);
    return { x: s.a.x + s.ux * d, z: s.a.z + s.uz * d, ux: s.ux, uz: s.uz };
  }
  if (d >= w.length) {
    const s = seg(n - 2),
      end = pts[n - 1]!;
    return {
      x: end.x + s.ux * (d - w.length),
      z: end.z + s.uz * (d - w.length),
      ux: s.ux,
      uz: s.uz,
    };
  }
  let lo = 1,
    hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (w.run[mid]! < d) lo = mid + 1;
    else hi = mid;
  }
  const s = seg(lo - 1),
    into = d - w.run[lo - 1]!;
  return { x: s.a.x + s.ux * into, z: s.a.z + s.uz * into, ux: s.ux, uz: s.uz };
}

/** One of a war's soldiers drawn in a land now (M203). */
export type PlayFigure = {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  /** Its colour (its realm's, as the map's colours are counted). */
  readonly color: number;
  /** The war it fights in (its index in the map), and which host (0 the attacker's). */
  readonly war: number;
  readonly side: 0 | 1;
  /** How much of it is drawn (0 … 1). */
  readonly size: number;
  readonly lead: boolean;
  readonly banner: boolean;
  readonly fallen: boolean;
  /** Over the sea: borne in a ship. */
  readonly afloat: boolean;
};

/** A host's mark in a land: where its head (or its middle) is, what it is at, its counter. */
export type PlayMark = {
  readonly key: string;
  readonly war: number;
  readonly side: 0 | 1;
  readonly ref: string;
  readonly realm: string;
  readonly x: number;
  readonly z: number;
  readonly doing: HostDoing;
  readonly men: number;
  /** "🚩 The league of Sairis's host: marching on Nirouv's land". */
  readonly name: string;
};

export type LandPlayNow = {
  readonly figures: readonly PlayFigure[];
  readonly marks: readonly PlayMark[];
  /**
   * The battles fought here about the turn (`key`: the war's and the turn's): drawn up for, engaged
   * in (a seat's walls stormed among them), and the rout after it — where, and how far on (0 … 1).
   */
  readonly fights: readonly {
    readonly key: string;
    readonly war: number;
    readonly ref: string;
    readonly x: number;
    readonly z: number;
    readonly stage: "drawn" | "engaged" | "rout";
    readonly k: number;
    readonly name: string;
  }[];
  /** Where each battle of the map in the land was fought (its field), by its event. */
  readonly fields: ReadonlyMap<string, Flat>;
  /** The field of each land fought for here (by its spot): its battles lately, and the one to come. */
  readonly lands: ReadonlyMap<number, Flat>;
  /** The besiegers' camps about seats under siege. */
  readonly camps: readonly {
    readonly war: number;
    readonly ref: string;
    readonly x: number;
    readonly z: number;
    readonly r: number;
    readonly color: number;
    readonly name: string;
  }[];
  /** Each war now (by its index in the map), for the look tools and the clock. */
  readonly wars: readonly (WarNow | null)[];
};

// (A land's heart, as the host finds it too: bridge/wars.ts.)
export { HEART_REACH, heartTown };

/** What a land's wars are played on: its spots, its ways, its heart, its sea, the map's colours. */
export type LandPlay = {
  readonly spots: LandSpots;
  readonly ways: LandWays;
  /** The land's heart (heartTown; null: none drawn): its battles are fought before it, its sieges laid about it. */
  readonly town: {
    readonly x: number;
    readonly z: number;
    readonly r: number;
    readonly name?: string;
  } | null;
  readonly sea: (x: number, z: number) => boolean;
  readonly colorOf: (c: readonly [number, number, number]) => number;
};

/**
 * Where on a way in the map its host is (0 … 1): a way with an end beyond it is the whole march
 * as this land sees it (from its border, or to it); with both ends beyond, none of it is here.
 */
function inMap(k: number, startIn: boolean, endIn: boolean): number | null {
  return startIn || endIn ? k : null;
}

/** A number of a text's own, and a unit draw of two numbers. */
function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}
const unit = (a: number, b: number) => {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

/**
 * A land's wars at `y` (the world's years) and screen time `s` (for the fighting's stir), each host
 * where warNow has it: a column on its way by the roads (in ships over the sea), a block drawn up
 * where it stands, the besieged on their walls; a way beyond the map, drawn while its host is in
 * it (coming in over the second half of its march, going out over the first).
 */
export function landInPlace(map: WarsMap, y: number, play: LandPlay, s: number): LandPlayNow {
  const { spots, ways, town } = play,
    figures: PlayFigure[] = [],
    marks: PlayMark[] = [],
    fights: LandPlayNow["fights"][number][] = [],
    fields = new Map<string, Flat>(),
    lands = new Map<number, Flat>(),
    camps: LandPlayNow["camps"][number][] = [],
    nows: (WarNow | null)[] = [];
  const placeOf = (spot: number): Flat | null =>
      spot === spots.middle && town ? town : spot >= 0 ? spots.here(spot) : null,
    reachOf = (spot: number) => (spot === spots.middle && town ? town.r : 0);
  map.wars.forEach((w, wi) => {
    const n = warNow(w, y, map.year);
    nows.push(n);
    if (!n) return;
    const colors = [play.colorOf(w.attacker.color), play.colorOf(w.defender.color)] as const,
      men = [w.attacker.fields, w.defender.fields] as const,
      sides = [w.attacker, w.defender] as const,
      muster = w.muster ?? w.from;
    /** The attacker's way to a land fought for (from its muster), and the field before it. */
    const approach = (front: number) => {
      const end0 = placeOf(front),
        start0 = placeOf(muster),
        start = start0 ?? (end0 ? spots.edgeToward(muster, end0) : null),
        end = end0 ?? (start ? spots.edgeToward(front, start) : null);
      if (!start || !end) return null;
      const way = ways.way(start, end),
        fieldD = end0 ? Math.max(way.length * 0.4, way.length - (reachOf(front) + FIELD_GAP)) : 0,
        f = onWay(way, fieldD);
      return { way, startIn: !!start0, endIn: !!end0, fieldD, field: f, end: end0 };
    };
    const put = (
      x: number,
      z: number,
      yaw: number,
      side: 0 | 1,
      lead: boolean,
      banner: boolean,
      size = 1,
      fallen = false,
    ) =>
      figures.push({
        x,
        z,
        yaw,
        color: colors[side],
        war: wi,
        side,
        size,
        lead,
        banner,
        fallen,
        afloat: play.sea(x, z),
      });
    const mark = (side: 0 | 1, x: number, z: number, h: HostNow) =>
      marks.push({
        key: `${w.ref}:${side}`,
        war: wi,
        side,
        ref: w.ref,
        realm: sides[side].ref,
        x,
        z,
        doing: h.doing,
        men: Math.round(men[side] * Math.max(0.25, h.gathered)),
        name: `${DOING_ICON[h.doing]} ${sides[side].name}'s host: ${h.words}`,
      });
    /** A host in ranks, its middle front at a point, facing (ux, uz); `stir` its front rank at the fight. */
    const block = (
      side: 0 | 1,
      at: Flat,
      ux: number,
      uz: number,
      shape: { files: number; ranks: number },
      size = 1,
      stir = 0,
      falling: (i: number) => boolean = () => false,
    ) => {
      const yaw = Math.atan2(ux, uz);
      for (let k = 0; k < shape.files * shape.ranks; k++) {
        const rank = Math.floor(k / shape.files),
          file = k % shape.files,
          across = (file - (shape.files - 1) / 2) * FILE,
          // (The front rank sways at the fight.)
          sway = rank === 0 && stir ? Math.sin(s * 3 + k * 1.7) * 0.12 * stir : 0,
          back = rank * 0.9 - sway,
          mid = file === Math.floor(shape.files / 2);
        put(
          at.x - ux * back - uz * across,
          at.z - uz * back + ux * across,
          yaw,
          side,
          rank === 0 && mid,
          (rank === 0 || rank % 3 === 0) && mid,
          size,
          falling(k),
        );
      }
    };
    /** A host in column on a way, its head `head` along it; going back (toward its start) where `back`. */
    const column = (
      side: 0 | 1,
      way: Way,
      head: number,
      shape: { files: number; ranks: number },
      back = false,
      size = 1,
    ) => {
      for (let k = 0; k < shape.files * shape.ranks; k++) {
        const rank = Math.floor(k / shape.files),
          file = k % shape.files,
          d = back ? head + rank * RANK : head - rank * RANK;
        if (d < 0 || d > way.length) continue;
        const p = onWay(way, d),
          ux = back ? -p.ux : p.ux,
          uz = back ? -p.uz : p.uz,
          mid = file === Math.floor(shape.files / 2);
        let across = k ? (file - (shape.files - 1) / 2) * FILE : 0;
        // (Where the way runs by the water, its files close up onto it.)
        while (across && play.sea(p.x - uz * across, p.z + ux * across) && !play.sea(p.x, p.z))
          across = Math.abs(across) < 0.2 ? 0 : across / 2;
        put(
          p.x - uz * across,
          p.z + ux * across,
          Math.atan2(ux, uz),
          side,
          k === 0,
          k === 0 || (rank > 0 && rank % 3 === 0 && mid),
          size,
        );
      }
    };
    /** A shape cut to how much of its host is there. */
    const cut = (shape: { files: number; ranks: number }, g: number) => ({
      files: shape.files,
      ranks: Math.max(1, Math.round(shape.ranks * g)),
    });
    const A = landShape(men[0]),
      D = holdShape(men[1]),
      Dw = { files: D.files + 2, ranks: D.ranks },
      front = n.attacker?.front ?? n.defender?.front ?? w.to,
      ap = approach(front);
    // The battles of the map fought here: their fields, before their lands' towns.
    for (const b of w.battles) {
      if (b.spot < 0 || !placeOf(b.spot)) continue;
      const a = b.spot === front ? ap : approach(b.spot);
      if (a?.endIn) {
        fields.set(b.event, { x: a.field.x, z: a.field.z });
        lands.set(b.spot, { x: a.field.x, z: a.field.z });
      }
    }
    if (ap?.endIn) lands.set(front, { x: ap.field.x, z: ap.field.z });
    // A seat under siege here: its besiegers' camp about its walls.
    if (n.siege !== null) {
      const at = placeOf(n.siege);
      if (at)
        camps.push({
          war: wi,
          ref: w.ref,
          x: at.x,
          z: at.z,
          r: reachOf(n.siege) + CAMP_GAP,
          color: colors[0],
          name: `⛺ The camp of ${w.attacker.name} before ${w.defender.name}'s seat`,
        });
    }
    const F = ap?.endIn ? ap.field : null,
      town0 = ap?.end ?? null,
      landName = w.places?.find((p) => p.spot === front)?.name ?? "the land",
      // (Before the land's heart, where it is this land and the town is not the one it is named for.)
      before =
        front === spots.middle && town?.name && !landName.startsWith(`${town.name}'s`)
          ? `, before ${town.name}`
          : "";
    // The fight the year ends in (a seat's walls stormed, or the field before a land), and the rout
    // after the one it began with.
    const where = n.siege !== null && n.siege === front ? town0 : F;
    if (n.closing && where && n.closing.spot === front)
      fights.push({
        key: `${w.ref}:${n.turn + 1}`,
        war: wi,
        ref: w.ref,
        x: where.x,
        z: where.z,
        stage: n.closing.engaged ? "engaged" : "drawn",
        k: n.closing.k,
        name: `⚔️ The battle for ${landName}${before}`,
      });
    else if (n.fought && n.f < WAR_YEAR.rout && n.fought.battle.spot === front && where)
      fights.push({
        key: `${w.ref}:${n.turn}`,
        war: wi,
        ref: w.ref,
        x: where.x,
        z: where.z,
        stage: "rout",
        k: n.f / WAR_YEAR.rout,
        name: `⚔️ The battle for ${landName}${before}`,
      });
    /** The besieged on their walls about a seat's town (stirred as it is stormed): where its middle stands. */
    const walls = (side: 0 | 1, spot: number, stir: boolean): Flat | null => {
      const c = placeOf(spot);
      if (!c) return null;
      const r = Math.max(0.8, reachOf(spot) * 0.95),
        many = Math.max(8, Math.min(24, Dw.files * 3));
      for (let i = 0; i < many; i++) {
        const t = (i / many) * Math.PI * 2,
          ox = Math.cos(t),
          oz = Math.sin(t),
          lean = stir ? Math.sin(s * 3 + i * 1.3) * 0.1 : 0;
        put(
          c.x + ox * (r + lean),
          c.z + oz * (r + lean),
          Math.atan2(ox, oz),
          side,
          i === 0,
          i % 6 === 0,
        );
      }
      return { x: c.x, z: c.z - r };
    };
    // The land's own garrison, holding it until its host comes.
    if (n.held !== null) {
      const at = placeOf(n.held);
      if (at && ap) {
        block(1, at, -ap.field.ux, -ap.field.uz, { files: Dw.files, ranks: 2 });
        marks.push({
          key: `${w.ref}:held`,
          war: wi,
          side: 1,
          ref: w.ref,
          realm: w.defender.ref,
          x: at.x,
          z: at.z,
          doing: "garrisoned",
          men: Math.round(men[1] * 0.2),
          name: `🏰 ${w.defender.name}'s garrison: holding ${landName}`,
        });
      }
    }
    // —— The attacker ——
    const a = n.attacker;
    if (a && ap) {
      const { way, startIn, endIn, fieldD } = ap,
        ux = ap.field.ux,
        uz = ap.field.uz;
      let at: Flat | null = null;
      switch (a.doing) {
        case "mustering":
        case "garrisoned": {
          if (!startIn && !endIn) break;
          const p = onWay(way, startIn ? reachOf(muster) + 1.5 : 1.5);
          block(0, p, p.ux, p.uz, cut(A, a.gathered));
          at = p;
          break;
        }
        case "marching": {
          const kk = inMap(a.k, startIn, endIn);
          if (kk === null) break;
          const head = kk * (endIn ? fieldD - FACE : way.length);
          column(0, way, head, A);
          at = onWay(way, head);
          break;
        }
        case "facing":
        case "holding":
        case "engaged": {
          if (!F) break;
          const close =
              a.doing === "engaged" && n.closing
                ? FACE - (FACE - MEET) * ease(n.closing.k / 0.4)
                : a.doing === "holding"
                  ? MEET
                  : FACE,
            p = { x: F.x - ux * close, z: F.z - uz * close },
            stir = a.doing === "engaged" ? 1 : 0;
          block(0, p, ux, uz, A, 1, stir, fallingAt(n, w, 0));
          at = p;
          break;
        }
        case "entering": {
          if (!F || !endIn) break;
          const head = fieldD - MEET + (way.length - (fieldD - MEET)) * a.k;
          column(0, way, head, A);
          at = onWay(way, head);
          break;
        }
        case "withdrawing": {
          // Back the way it came, from the field.
          const from = endIn ? fieldD - MEET : way.length,
            kk = inMap(1 - a.k, startIn, endIn);
          if (kk === null) break;
          const head = (endIn ? from : way.length) * kk;
          column(0, way, head, A, true);
          at = onWay(way, head);
          break;
        }
        case "besieging":
        case "assaulting": {
          if (!endIn) break;
          const r = reachOf(front),
            d =
              a.doing === "assaulting" && n.closing
                ? way.length - (r + CAMP_GAP) + (CAMP_GAP - 0.4) * ease(n.closing.k / 0.6)
                : way.length - (r + CAMP_GAP),
            p = onWay(way, d);
          block(0, p, p.ux, p.uz, A, 1, a.doing === "assaulting" ? 1 : 0);
          at = p;
          break;
        }
        case "returning": {
          const fromP = F ?? placeOf(a.from),
            home = placeOf(a.to) ?? (fromP ? spots.edgeToward(a.to, fromP) : null);
          if (!fromP || !home) break;
          const back = ways.way(fromP, home),
            kk = inMap(a.k, true, !!placeOf(a.to));
          if (kk === null) break;
          const head = kk * back.length;
          column(0, back, head, cut(A, a.gathered), false, a.gathered);
          at = onWay(back, head);
          break;
        }
        default:
          break;
      }
      if (at) mark(0, at.x, at.z, a);
    }
    // —— The defenders ——
    const d = n.defender;
    if (d) {
      let at: Flat | null = null;
      const ux = ap?.field.ux ?? 1,
        uz = ap?.field.uz ?? 0;
      switch (d.doing) {
        case "garrisoned": {
          const p = placeOf(d.from);
          if (!p) break;
          block(1, p, -ux, -uz, cut(Dw, d.gathered));
          at = p;
          break;
        }
        case "rallying": {
          if (!F) {
            // (Out from their seat here, toward a land beyond the map.)
            const seat = placeOf(d.from);
            if (!seat) break;
            const out = ways.way(seat, spots.edgeToward(d.to, seat)),
              kk = inMap(d.k, true, false);
            if (kk === null) break;
            column(1, out, kk * out.length, Dw);
            at = onWay(out, kk * out.length);
            break;
          }
          const stand = { x: F.x + ux * FACE, z: F.z + uz * FACE },
            seat = placeOf(d.from) ?? spots.edgeToward(d.from, stand),
            to = ways.way(seat, stand),
            kk = inMap(d.k, !!placeOf(d.from), true);
          if (kk === null) break;
          column(1, to, kk * to.length, Dw);
          at = onWay(to, kk * to.length);
          break;
        }
        case "facing":
        case "holding":
        case "engaged": {
          if (n.siege !== null && n.siege === front) {
            at = walls(1, front, d.doing === "engaged");
            break;
          }
          if (!F) break;
          const close =
              d.doing === "engaged" && n.closing
                ? FACE - (FACE - MEET) * ease(n.closing.k / 0.4)
                : d.doing === "holding"
                  ? MEET
                  : FACE,
            p = { x: F.x + ux * close, z: F.z + uz * close };
          block(1, p, -ux, -uz, Dw, 1, d.doing === "engaged" ? 1 : 0, fallingAt(n, w, 1));
          at = p;
          break;
        }
        case "besieged":
          at = walls(1, d.front, false);
          break;
        case "routed": {
          if (!F) break;
          // Fled the field: into the town (their seat), or off toward their seat.
          const start = { x: F.x + ux * MEET, z: F.z + uz * MEET },
            seat = d.to === d.front ? town0 : placeOf(d.to),
            goal = seat ?? spots.edgeToward(d.to, start),
            run = ways.way(start, goal),
            kk = inMap(d.k, true, !!seat);
          if (kk === null) break;
          const head = kk * run.length;
          column(1, run, head, cut(Dw, d.gathered), false, Math.max(0.2, d.gathered));
          at = onWay(run, head);
          break;
        }
        case "returning": {
          const fromP = F ?? placeOf(d.from),
            home = placeOf(d.to) ?? (fromP ? spots.edgeToward(d.to, fromP) : null);
          if (!fromP || !home) break;
          const back = ways.way(fromP, home),
            kk = inMap(d.k, true, !!placeOf(d.to));
          if (kk === null) break;
          const head = kk * back.length;
          column(1, back, head, cut(Dw, d.gathered), false, d.gathered);
          at = onWay(back, head);
          break;
        }
        default:
          break;
      }
      if (at) mark(1, at.x, at.z, d);
    }
  });
  return { figures, marks, fights, fields, lands, camps, wars: nows };
}

/**
 * Which of a host's ranks fall at the fight the year ends in, by how far on it is: a few of its
 * front rank, each at its own moment of the fight (no more than history's least for a victor, so
 * none rise again once the battle is told).
 */
function fallingAt(n: WarNow, w: War, side: 0 | 1): (i: number) => boolean {
  const c = n.closing;
  if (!c || !c.engaged) return () => false;
  const key = hashText(w.ref) + side * 7 + n.turn;
  return (i: number) => {
    if (i >= 6) return false;
    const at = 0.45 + 0.5 * unit(key, i);
    return unit(key + 3, i) < 0.35 && c.k > at;
  };
}
