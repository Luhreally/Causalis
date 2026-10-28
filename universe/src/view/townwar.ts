// A town at war (Phase 40 M204, asked for 2026-10-25: "...like the more fluid views of wars and
// just actions of stuff yk"). Its land's wars as the land plays them (M203: view/warplay.ts), at
// its gates and on the world's clock:
// - its men muster on open ground past its homes and march out by its road;
// - before the land's heart (the town its battles are fought before, view/warplay's heartTown) the
//   hosts come by the road, draw up, close and fight as the year ends; at the turn the beaten fly
//   (behind its walls, a siege laid), the fallen lie where they fell, the victors hold the field
//   and march in — fought the morning after the turn, and in place where its own layer draws it
//   (Phase 55 M227: view/placed.ts), the fallen lying until they are borne in two days on;
// - a siege: the besiegers camped about it all year and storming its walls at the end; a town
//   stormed burns;
// - at the peace its men come home by the road.
// Pure: who stands where, at a moment of the world's.
import type { BattleOutcome, VillagePlan, WarsMap } from "../bridge/index.ts";
import {
  BATTLE_DAY,
  battleSecond,
  battleStage,
  battleTurnWords,
  borneShare,
  type BattleStage,
} from "./battleday.ts";
import { keepOut, villageGround } from "./ground.ts";
import { drillGround } from "./village.ts";
import { WAR_YEAR, warNow, type HostNow, type WarNow } from "./warplay.ts";
import type { Soldier } from "./war.ts";

type War = WarsMap["wars"][number];
type Side = War["attacker"];
type Flat = { readonly x: number; readonly z: number };

/** What a host is at, at a town. */
export type TownDoing =
  | "mustering"
  | "leaving"
  | "coming"
  | "drawn"
  | "engaged"
  | "guard"
  | "holding"
  | "fleeing"
  | "entering"
  | "besieging"
  | "assaulting"
  | "besieged"
  | "home";

/** Each doing's sign, as the host's label shows it (as a land's marks show theirs). */
export const TOWN_DOING_ICON: Readonly<Record<TownDoing, string>> = {
  mustering: "📯",
  leaving: "🚩",
  coming: "🚩",
  drawn: "🛡️",
  engaged: "⚔️",
  guard: "🏰",
  holding: "🚩",
  fleeing: "💨",
  entering: "🏴",
  besieging: "⛺",
  assaulting: "🪜",
  besieged: "🏰",
  home: "🏠",
};

/** A host of a war at a town now. */
export type TownHost = {
  /** 0 the attacker's, 1 the defender's. */
  readonly side: 0 | 1;
  readonly doing: TownDoing;
  /** How far through it (0 … 1). */
  readonly k: number;
  /** How much of the host is there (0 … 1). */
  readonly gathered: number;
  /** Leaving from the field before it (falling back, or going home), not from its muster. */
  readonly field?: boolean;
  /** In flight behind its walls (a siege laid), not away. */
  readonly inward?: boolean;
  /** Drawn up from its own gate (the town's guard), not come in from elsewhere. */
  readonly out?: boolean;
  /** What it is at, told. */
  readonly words: string;
};

/** A war as a town sees it now. */
export type TownWar = {
  readonly ref: string;
  /** The war's two sides (their names, colours, hosts' kinds). */
  readonly sides: readonly [Side, Side];
  readonly hosts: readonly TownHost[];
  /** The battle before it at its year's end: drawn up, engaged, its rout — and how far through (0 … 1). */
  readonly fight: {
    readonly stage: "drawn" | "engaged" | "rout";
    readonly k: number;
    /** The battle's key, as its land's fight is keyed (its war, and the turn it is fought at). */
    readonly key: string;
  } | null;
  /** The battle fought before it at the year's turn (its fallen lie there), and what came of it. */
  readonly fought: {
    readonly event: string;
    readonly won: boolean;
    readonly fallen: number;
    readonly outcome: BattleOutcome;
    /** Fought about its walls (a siege's storm), not on the field before it. */
    readonly walls: boolean;
    /** Its fallen borne in and buried (two days after it was fought: Phase 55 M227), lying there no more. */
    readonly buried: boolean;
  } | null;
  /**
   * The battle at the turn fought in place before it (Phase 55 M227; null: none now), from the turn
   * until its fallen are buried: the battle, the turn it is fought at, its stage, its own second now,
   * and how many of its fallen are borne in (0 … 1).
   */
  readonly placed: {
    readonly event: string;
    readonly turn: number;
    readonly stage: Exclude<BattleStage, "eve">;
    readonly s: number;
    readonly borne: number;
  } | null;
  /** The night before the battle at the turn before it (from six on its eve to eight): the hosts by their fires. */
  readonly eve: boolean;
  /** Whether a siege is about it this year (its besiegers' camp; the storm at the year's end). */
  readonly siege: boolean;
  /** How hard it burns (0 … 1): a town stormed (a land taken, a little). */
  readonly burning: number;
  /** The most pressing of what its hosts are at, told ("📯 Hyv: mustering for the war upon Taitrandath"). */
  readonly words: string;
};

/** What a town is to its land's wars: its land's spot (the globe's grid), and whether it is the land's heart. */
export type TownPlace = { readonly spot: number; readonly heart: boolean };

const YEAR = 365 * 86_400;
/** How much of a march's way (eased) a town sees: its column leaving by the road, and coming in by it. */
const OUT = 0.08,
  IN = 0.08;
/** Which of two at a town is the more pressing, shown when wars meet there. */
const PRESSING: Readonly<Record<TownDoing, number>> = {
  engaged: 10,
  assaulting: 10,
  drawn: 9,
  fleeing: 8,
  entering: 8,
  holding: 7,
  besieging: 7,
  besieged: 7,
  coming: 6,
  leaving: 6,
  mustering: 5,
  home: 4,
  guard: 3,
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

/** A host of a war now, at a town: what it is at there (null: not there). */
function atTown(h: HostNow, n: WarNow, w: War, place: TownPlace): TownHost | null {
  const S = place.spot,
    heart = place.heart,
    foe = (h.side === 0 ? w.defender : w.attacker).name,
    host = (
      doing: TownDoing,
      words: string,
      k = 1,
      more: { field?: boolean; inward?: boolean; out?: boolean; gathered?: number } = {},
    ): TownHost => ({
      side: h.side,
      doing,
      k: clamp01(k),
      gathered: clamp01(more.gathered ?? h.gathered),
      ...(more.field ? { field: true } : {}),
      ...(more.inward ? { inward: true } : {}),
      ...(more.out ? { out: true } : {}),
      words,
    });
  switch (h.doing) {
    case "mustering":
      return h.from === S ? host("mustering", `mustering for the war upon ${foe}`) : null;
    case "marching":
    case "rallying":
      // (Every town of the land it musters in sends its men; the heart alone sees them come.)
      if ((h.doing === "marching" || heart) && h.from === S && h.k < OUT)
        return host("leaving", `marching out to the war upon ${foe}`, h.k / OUT);
      if (heart && h.to === S && h.k > 1 - IN)
        return host(
          "coming",
          h.side === 0 ? `coming by the road to give battle` : `come to hold the land`,
          (h.k - (1 - IN)) / IN,
        );
      return null;
    case "facing":
      return heart && h.front === S
        ? host("drawn", `drawn up for battle`, 1, { out: h.side === 1 && h.from === S })
        : null;
    case "engaged":
      if (!heart || h.front !== S) return null;
      return n.siege === S && h.side === 1
        ? host("besieged", `fighting on the walls`)
        : host("engaged", `fighting before the town`);
    case "garrisoned":
      return heart && h.from === S ? host("guard", `holding the town`) : null;
    case "holding":
      return heart && h.from === S ? host("holding", `holding the field`) : null;
    case "withdrawing":
      if (heart && h.from === S && h.k < 0.5)
        return host("leaving", `falling back from the field`, h.k / 0.5, { field: true });
      if (h.to === S && h.from !== S && h.k > 1 - IN)
        return host("home", `come back from the field`, (h.k - (1 - IN)) / IN);
      return null;
    case "routed": {
      // (Out of the town's sight, or behind its walls, as the rout ends.)
      const inward = h.to === S && n.fought?.outcome === "siege";
      return heart && h.from === S
        ? host("fleeing", inward ? `fled behind the walls` : `in flight`, n.after / WAR_YEAR.rout, {
            inward,
          })
        : null;
    }
    case "entering":
      return heart && h.to === S ? host("entering", `marching into the town`, h.k) : null;
    case "besieging":
      return heart && h.from === S
        ? host(
            "besieging",
            `besieging the town`,
            n.fought ? (n.after - WAR_YEAR.rout) / (WAR_YEAR.after - WAR_YEAR.rout) : 1,
          )
        : null;
    case "assaulting":
      return heart && h.from === S ? host("assaulting", `storming the walls`) : null;
    case "besieged":
      return heart && h.from === S ? host("besieged", `on the walls`) : null;
    case "returning":
      if (h.to === S && (h.from === h.to || h.k > 1 - IN))
        return host("home", `come home from the war`, h.from === h.to ? 1 : (h.k - (1 - IN)) / IN);
      if (heart && h.from === S && h.k < OUT)
        return host("leaving", `going home`, h.k / OUT, { field: true });
      return null;
  }
}

/**
 * The war a town sees at `y` (the world's years, fractional), as its land plays it: of the wars of
 * the map that reach it, the one most pressing there (a battle before it over a muster in it; the
 * first of the map where two press alike). Null: none reaches it.
 */
export function townWarNow(
  map: WarsMap,
  y: number,
  place: TownPlace,
  preferredBattle?: string,
): TownWar | null {
  let best: TownWar | null = null,
    bestScore = -1;
  for (const w of map.wars) {
    const n = warNow(w, y, map.year);
    if (!n) continue;
    const hosts: TownHost[] = [];
    for (const h of [n.attacker, n.defender]) {
      const t = h ? atTown(h, n, w, place) : null;
      if (t) hosts.push(t);
    }
    if (place.heart && n.held === place.spot && !hosts.some((h) => h.side === 1))
      hosts.push({
        side: 1,
        doing: "guard",
        k: 1,
        gathered: 1,
        words: `holding the town until their host comes`,
      });
    // (Its fallen lie there once it is fought: the morning after the turn, D4.)
    const fought =
      place.heart && n.fought && n.fought.battle.spot === place.spot && n.closing?.at !== n.turn
        ? n.fought
        : null;
    if (!hosts.length && !fought) continue;
    const chosen =
        preferredBattle !== undefined &&
        n.fought?.battle.event === preferredBattle &&
        !!battleStage(y * YEAR, n.turn),
      score =
        Math.max(0, ...hosts.map((h) => PRESSING[h.doing])) +
        (fought ? 0.5 : 0) +
        (chosen ? 1e6 : 0);
    if (score <= bestScore) continue;
    bestScore = score;
    const c = place.heart && n.closing?.spot === place.spot ? n.closing : null,
      T = WAR_YEAR,
      // (Drawn up to the turn and through the night; engaged the next morning, D4: Phase 55 M227.)
      fight: TownWar["fight"] = c
        ? { stage: c.engaged ? "engaged" : "drawn", k: clamp01(c.k), key: `${w.ref}:${c.at}` }
        : fought && n.after < T.rout
          ? { stage: "rout", k: clamp01(n.after / T.rout), key: `${w.ref}:${n.turn}` }
          : null,
      // (A storm of its walls: the battle the year before laid the siege it ended.)
      walls =
        !!fought &&
        w.battles.some(
          (b) => b.year === n.turn - 2 && b.spot === place.spot && b.outcome === "siege",
        ),
      fire = fought?.outcome === "stormed" ? 1 : fought?.outcome === "taken" && !walls ? 0.35 : 0,
      // (Burning through the victors' entry, smouldering a season after.)
      burning = fire * (n.after < T.after ? 1 : clamp01(1 - (n.after - T.after) / 0.25)),
      top = [...hosts].sort((a, b) => PRESSING[b.doing] - PRESSING[a.doing])[0],
      sideName = (side: 0 | 1) => {
        const name = (side === 0 ? w.attacker : w.defender).name;
        return name.charAt(0).toUpperCase() + name.slice(1);
      },
      // The battle at the turn fought in place before its heart (Phase 55 M227): from the turn until
      // its fallen are buried; and the night before it, its hosts by their fires.
      t = y * YEAR,
      atTurn =
        place.heart && n.fought && n.fought.battle.spot === place.spot ? n.fought.battle : null,
      stage = atTurn ? battleStage(t, n.turn) : null,
      placed: TownWar["placed"] =
        atTurn && stage && stage !== "eve"
          ? {
              event: atTurn.event,
              turn: n.turn,
              stage,
              s: battleSecond(t, n.turn),
              borne: borneShare(t, n.turn),
            }
          : null,
      night = c && !c.engaged ? battleStage(t, c.at) : null,
      told = battleTurnWords(n.turn).replace(/^the/, "The");
    best = {
      ref: w.ref,
      sides: [w.attacker, w.defender],
      hosts,
      fight,
      fought: fought
        ? {
            event: fought.battle.event,
            won: fought.battle.won,
            fallen: fought.battle.fallen,
            outcome: fought.outcome,
            walls,
            buried: t >= n.turn * YEAR + BATTLE_DAY.buried,
          }
        : null,
      placed,
      eve: night === "eve" || night === "morning",
      siege: place.heart && (n.siege === place.spot || (walls && n.after < T.after)),
      burning,
      words:
        placed?.stage === "morning"
          ? `🛡️ ${sideName(0)} and ${w.defender.name} drawn up before the town: ${battleTurnWords(n.turn)}, at eight`
          : placed?.stage === "battle"
            ? `⚔️ ${told}, fought before the town`
            : top
              ? `${TOWN_DOING_ICON[top.doing]} ${sideName(top.side)}: ${top.words}`
              : `⚔️ The field where ${sideName(0)} fought ${w.defender.name}`,
    };
  }
  return best;
}

// —— Drawn ————————————————————————————————————————————————————————————————————

/** A town's war drawn now: its soldiers, its besiegers' tents, its fires, where each host stands. */
export type TownWarScene = {
  /**
   * Each side's `2 × each`: its host (`each`, the attackers' first), then the fallen of a battle
   * fought before it (`each`, lying where they fell). Those not there are drawn at size 0.
   */
  readonly soldiers: readonly Soldier[];
  readonly tents: readonly { readonly x: number; readonly z: number; readonly yaw: number }[];
  /** Its houses burning: where, how high the flames (0 … 1). */
  readonly fires: readonly { readonly x: number; readonly z: number; readonly size: number }[];
  /** The hosts' fires the night before a battle before it, behind their lines (Phase 55 M227). */
  readonly camp: readonly { readonly x: number; readonly z: number }[];
  /** Where each side's host stands (the middle of those drawn), for its label; null: none there. */
  readonly middles: readonly [Flat | null, Flat | null];
};

/** The besiegers' camp: how far past the homes; how many tents. */
const CAMP_OUT = 55,
  TENTS = 12;
/** How far past its homes a column comes into view by the road, and goes out of it (metres). */
const ROAD_OUT = 230;
/** Where the hosts meet, past its homes along its road (as a battle about a village always met). */
const FRONT = 40;
/** A column's rows apart, and its two files (metres). */
const ROW = 2.2,
  FILE = 1.6;

/** A keyed number in [0, 1). */
const unit = (a: number, b: number) => {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};
const hashText = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
};
/** The yaw that faces a soldier along (dx, dz). */
const facing = (dx: number, dz: number) => Math.atan2(dx, dz);

/** A way through the town's ground: its points, and how far along each lies. */
type Path = {
  readonly points: readonly Flat[];
  readonly at: readonly number[];
  readonly length: number;
};
function pathOf(points: readonly Flat[]): Path {
  const at = [0];
  for (let i = 1; i < points.length; i++)
    at.push(
      at[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.z - points[i - 1]!.z),
    );
  return { points, at, length: at[at.length - 1]! };
}
/** Where along a path `d` metres from its start lies, and which way it runs there. */
function along(p: Path, d: number): { x: number; z: number; dx: number; dz: number } {
  let i = 1;
  while (i < p.points.length - 1 && p.at[i]! < d) i++;
  const a = p.points[i - 1]!,
    b = p.points[i]!,
    len = Math.max(1e-6, p.at[i]! - p.at[i - 1]!),
    t = clamp01((d - p.at[i - 1]!) / len);
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    dx: (b.x - a.x) / len,
    dz: (b.z - a.z) / len,
  };
}

/**
 * Who of a host fell (a keyed turn through it: as many as `count`, the same ones as it grows) —
 * at what point of the fight each falls (0 … 1).
 */
const falls = (i: number, side: number, each: number, count: number) =>
  (i * 11 + side * 3) % Math.max(1, each) < count;
const fallsAt = (i: number, side: number) => 0.3 + 0.6 * unit(i, side * 13 + 1);

/**
 * A town's war drawn as it stands now: `each` of a side's host, placed by what it is
 * at — on its muster ground, in column on the road, in two ranks on its line before the town or
 * closing and fighting at the line between, about its walls, in flight — and the fallen of the
 * battle fought before it lying where they fell, the beaten the more, until they are buried; the
 * night before a battle, its hosts' fires. `placed`: the battle at the turn drawn in place by its
 * own layer (Phase 55 M227), so none of its hosts here while it is fought, nor its fallen. Pure.
 */
export function townWarScene(
  plan: VillagePlan,
  war: TownWar,
  each: number,
  placed = false,
): TownWarScene {
  const ground = villageGround(plan),
    way = Math.atan2(plan.road.z, plan.road.x),
    ux = Math.cos(way),
    uz = Math.sin(way),
    reach = ground.homesReach,
    front = reach + FRONT,
    key = hashText(war.ref),
    at = (out: number, across: number): Flat => ({
      x: ux * out - uz * across,
      z: uz * out + ux * across,
    }),
    muster = drillGround(plan),
    road = at(reach + ROAD_OUT, 0),
    gate = at(reach + 12, 0),
    // (The defenders rallying to the land come in across the open ground, the road the attackers'.)
    aside = (unit(key, 3) < 0.5 ? -1 : 1) * (reach + ROAD_OUT),
    soldiers: Soldier[] = [],
    tents: { x: number; z: number; yaw: number }[] = [],
    fires: { x: number; z: number; size: number }[] = [],
    nightFires: { x: number; z: number }[] = [],
    sum = [
      { x: 0, z: 0, n: 0 },
      { x: 0, z: 0, n: 0 },
    ];
  /** A soldier's place in two ranks across the road (`out` metres along it), facing `toward`. */
  const rankOf = (i: number, side: number) => {
    const file = (i >> 1) - (Math.ceil(each / 2) - 1) / 2,
      rank = i & 1;
    return { across: file * 3.2 + (unit(i, side * 7 + key) - 0.5) * 1.2, rank };
  };
  const lineAt = (i: number, side: number, out: number, step: number): Flat => {
    const { across, rank } = rankOf(i, side);
    return at(out + rank * step, across);
  };
  /** The attackers' line, the defenders', and where each meets the other. */
  const attackLine = (i: number) => lineAt(i, 0, front + 34, 4),
    defendLine = (i: number) => lineAt(i, 1, front - 30, -4),
    meetOf = (i: number, side: number) =>
      side === 0 ? lineAt(i, 0, front + 1.6, 2.6) : lineAt(i, 1, front - 1.6, -2.6);
  /** About its walls: each soldier's turn about the town (the defenders' paired with the besiegers'). */
  const ringAngle = (i: number) =>
      way + ((i + 0.5) / each) * 2 * Math.PI + (unit(key, 5) - 0.5) * 0.3,
    ringAt = (i: number, r: number): Flat => {
      const a = ringAngle(i);
      return { x: Math.cos(a) * r, z: Math.sin(a) * r };
    },
    camp = reach + CAMP_OUT,
    wallOut = reach + 1.6,
    wallIn = Math.max(4, reach - 2);
  /** A block of four files on the muster ground, facing the road. */
  const blockAt = (i: number, middle: Flat): Flat => {
    const col = (i % 4) - 1.5,
      row = Math.floor(i / 4),
      dx = road.x - middle.x,
      dz = road.z - middle.z,
      d = Math.max(1e-6, Math.hypot(dx, dz)),
      fx = dx / d,
      fz = dz / d;
    return {
      x: middle.x - fz * col * 1.9 - fx * row * 1.9,
      z: middle.z + fx * col * 1.9 - fz * row * 1.9,
    };
  };
  const push = (
    i: number,
    side: 0 | 1,
    p: Flat,
    yaw: number,
    doing: Soldier["doing"],
    size = 1,
    keep = true,
  ) => {
    const q = { x: p.x, z: p.z };
    if (keep && doing !== "fallen") keepOut(ground, q, 1.2);
    soldiers[side * 2 * each + i] = { x: q.x, z: q.z, yaw, side, doing, size };
    if (size > 0.5 && doing !== "fallen") {
      sum[side]!.x += q.x;
      sum[side]!.z += q.z;
      sum[side]!.n++;
    }
  };
  const hide = (i: number, side: 0 | 1) => {
    soldiers[side * 2 * each + i] = { x: 0, z: 0, yaw: 0, side, doing: "advance", size: 0 };
  };
  /** A column on a way: its head `k` of the way and the column's length along; those not on it at its ends. */
  const column = (
    i: number,
    side: 0 | 1,
    path: Path,
    k: number,
    start: ((i: number) => Flat) | null,
    end: ((i: number) => Flat) | null,
    endYaw: number,
    doing: Soldier["doing"] = "advance",
  ) => {
    const rows = Math.ceil(each / 2),
      row = i >> 1,
      file = (i & 1) - 0.5,
      head = k * (path.length + rows * ROW),
      d = head - row * ROW;
    if (d <= 0) {
      if (start)
        push(
          i,
          side,
          start(i),
          facing(path.points[1]!.x - path.points[0]!.x, path.points[1]!.z - path.points[0]!.z),
          "stand",
        );
      else hide(i, side);
      return;
    }
    if (d >= path.length) {
      if (end) push(i, side, end(i), endYaw, "stand");
      else hide(i, side);
      return;
    }
    const p = along(path, d);
    push(
      i,
      side,
      { x: p.x - p.dz * file * FILE, z: p.z + p.dx * file * FILE },
      facing(p.dx, p.dz),
      doing,
    );
  };
  const fight = war.fight,
    fought = war.fought,
    // (Drawn in place by its own layer: its hosts while it is fought, its fallen till they are buried.)
    inPlace = placed && war.placed !== null,
    fighting = inPlace && (war.placed!.stage === "morning" || war.placed!.stage === "battle"),
    beaten: 0 | 1 = fought ? (fought.won ? 1 : 0) : 1,
    // (As many fell, the beaten two in three of them, as fell of those who fought — at least a few.)
    share = fought ? Math.max(0.1, Math.min(0.5, fought.fallen / (fought.fallen + 400))) : 0,
    down = Math.round(share * 2 * each),
    during = Math.round(each * 0.2),
    deadOf = (side: number) =>
      !fought
        ? 0
        : Math.max(
            during,
            side === beaten
              ? Math.min(each, Math.round(down * 0.65))
              : down - Math.min(each, Math.round(down * 0.65)),
          ),
    /** Where each fought in the battle fought before it: at the line, or about its walls. */
    foughtAt = (i: number, side: number): Flat =>
      fought?.walls ? ringAt(i, side === 0 ? wallOut : wallIn) : meetOf(i, side),
    /** Facing the foe there. */
    foughtFacing = (p: Flat, side: number) =>
      fought?.walls
        ? side === 0
          ? facing(-p.x, -p.z)
          : facing(p.x, p.z)
        : side === 0
          ? facing(-ux, -uz)
          : facing(ux, uz);
  for (const side of [0, 1] as const) {
    const h = war.hosts.find((x) => x.side === side) ?? null,
      shown = h ? Math.round(h.gathered * each) : 0;
    for (let i = 0; i < each; i++) {
      // The fallen of the battle fought before it, where they fell until buried; its host without them.
      const fell = !!fought && falls(i, side, each, deadOf(side)),
        dead = fell && !fought.buried && !inPlace;
      if (dead) {
        const p = foughtAt(i, side);
        soldiers[side * 2 * each + each + i] = {
          x: p.x,
          z: p.z,
          yaw: foughtFacing(p, side),
          side,
          doing: "fallen",
          size: 1,
        };
      } else
        soldiers[side * 2 * each + each + i] = {
          x: 0,
          z: 0,
          yaw: 0,
          side,
          doing: "fallen",
          size: 0,
        };
      if (!h || i >= shown || fighting || (fell && h.doing !== "mustering" && h.doing !== "home")) {
        hide(i, side);
        continue;
      }
      const k = h.k;
      switch (h.doing) {
        case "mustering":
          push(
            i,
            side,
            blockAt(i, muster),
            facing(road.x - muster.x, road.z - muster.z),
            i % 3 ? "drill" : "stand",
          );
          break;
        case "leaving": {
          const from = h.field ? (j: number) => meetOf(j, side) : (j: number) => blockAt(j, muster),
            path = pathOf(h.field ? [at(front, 0), road] : [muster, at(reach + 30, 0), road]);
          column(i, side, path, k, from, null, 0);
          break;
        }
        case "coming": {
          const end = side === 0 ? attackLine : defendLine,
            to = side === 0 ? at(front + 34, 0) : at(front - 30, 0),
            path = pathOf(side === 0 ? [road, to] : [at(front - 30, aside), to]);
          column(i, side, path, k, null, end, side === 0 ? facing(-ux, -uz) : facing(ux, uz));
          break;
        }
        case "home": {
          const path = pathOf([road, at(reach + 30, 0), muster]);
          column(i, side, path, k, null, (j) => blockAt(j, muster), facing(-ux, -uz));
          break;
        }
        case "guard": {
          // (A guard across the road at the town's edge, facing out: one in two of its host.)
          if (i % 2) {
            hide(i, side);
            break;
          }
          const j = i >> 1,
            n = Math.ceil(each / 2);
          push(i, side, at(reach + 4, (j - (n - 1) / 2) * 2.4), facing(ux, uz), "stand");
          break;
        }
        case "drawn":
        case "engaged":
        case "holding": {
          const line = side === 0 ? attackLine(i) : defendLine(i),
            meet = meetOf(i, side),
            face = side === 0 ? facing(-ux, -uz) : facing(ux, uz);
          if (h.doing === "holding") {
            // (Where they won it: on the field, or about the walls they stormed.)
            const p = fought ? foughtAt(i, side) : meet;
            push(i, side, p, fought ? foughtFacing(p, side) : face, "stand");
            break;
          }
          if (fight?.stage !== "engaged") {
            // Drawn up: the defenders come out of the town to their line (its own guard, out of its gate).
            const out = h.out ? smooth((fight?.k ?? 1) / 0.35) : 1,
              p = { x: gate.x + (line.x - gate.x) * out, z: gate.z + (line.z - gate.z) * out };
            push(i, side, p, face, out < 1 ? "advance" : "stand");
            break;
          }
          // Engaged: closing from the lines, then fighting at the line between, falling.
          const e = fight.k,
            close = smooth(e / 0.25),
            p = { x: line.x + (meet.x - line.x) * close, z: line.z + (meet.z - line.z) * close };
          if (falls(i, side, each, during) && e > fallsAt(i, side))
            push(i, side, meet, face, "fallen");
          else push(i, side, p, face, close < 1 ? "advance" : "fight");
          break;
        }
        case "fleeing": {
          // The beaten fly from the line: behind the walls (a siege laid), or away past the town.
          // (Scattering across the open ground either hand, away from the victors.)
          const from = foughtAt(i, side),
            to = h.inward
              ? ringAt(i, wallIn)
              : at(
                  front - 20 - unit(i, key + 9) * 60,
                  (unit(i, key) < 0.5 ? -1 : 1) * (reach + ROAD_OUT),
                ),
            e = smooth(k),
            p = { x: from.x + (to.x - from.x) * e, z: from.z + (to.z - from.z) * e };
          push(
            i,
            side,
            p,
            facing(to.x - from.x, to.z - from.z),
            "fall back",
            h.inward ? 1 : 1 - smooth((k - 0.7) / 0.3),
            !h.inward,
          );
          break;
        }
        case "entering": {
          // (Over its walls where they stormed them; else in at its gate.)
          const inner = at(Math.max(0, reach * 0.35), 0),
            path = pathOf(
              fought?.walls ? [foughtAt(i, side), inner] : [foughtAt(i, side), gate, inner],
            );
          column(
            i,
            side,
            path,
            k,
            (j) => foughtAt(j, side),
            (j) => blockAt(j, at(Math.max(0, reach * 0.35), 0)),
            facing(-ux, -uz),
          );
          break;
        }
        case "besieging":
        case "assaulting": {
          // Camped about it, by their tents; storming its walls as the year ends.
          const storm = h.doing === "assaulting" && fight?.stage === "engaged" ? fight.k : 0,
            close = smooth(storm / 0.3),
            r = camp - 6 + (wallOut - (camp - 6)) * close,
            ring = ringAt(i, r),
            // (From the field won, the year's first weeks, to its place about the town.)
            settle = h.doing === "besieging" ? smooth(k) : 1,
            from = foughtAt(i, side),
            p = {
              x: from.x + (ring.x - from.x) * settle,
              z: from.z + (ring.z - from.z) * settle,
            };
          if (h.doing === "assaulting" && falls(i, side, each, during) && storm > fallsAt(i, side))
            push(i, side, ringAt(i, wallOut), facing(-p.x, -p.z), "fallen");
          else
            push(
              i,
              side,
              p,
              facing(-p.x, -p.z),
              h.doing === "assaulting" ? (close < 1 ? "advance" : "fight") : "stand",
              1,
              false,
            );
          break;
        }
        case "besieged": {
          // On its walls, facing out; fighting there as they are stormed.
          const storm = fight?.stage === "engaged" ? fight.k : 0,
            p = ringAt(i, wallIn);
          if (storm > 0 && falls(i, side, each, during) && storm > fallsAt(i, side))
            push(i, side, p, facing(p.x, p.z), "fallen", 1, false);
          else push(i, side, p, facing(p.x, p.z), storm > 0 ? "fight" : "stand", 1, false);
          break;
        }
      }
    }
    for (let i = 0; i < each; i++) if (!soldiers[side * 2 * each + i]) hide(i, side);
  }
  // The besiegers' tents about the town, and their camp's fires (none while the battle before it
  // is fought in place: its hosts and their fires are its own layer's then).
  if (
    !fighting &&
    (war.siege || war.hosts.some((h) => h.doing === "besieging" || h.doing === "assaulting"))
  )
    for (let j = 0; j < TENTS; j++) {
      const a = way + ((j + 0.25) / TENTS) * 2 * Math.PI + (unit(key, 5) - 0.5) * 0.3,
        r = camp + 4 + unit(j, key) * 6;
      tents.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, yaw: a });
    }
  // The night before a battle before it: the hosts' fires behind their lines across the road.
  if (war.eve && !inPlace && war.hosts.some((h) => h.doing === "drawn"))
    for (let k = 0; k < 6; k++) {
      const across = (k - 2.5) * 9;
      nightFires.push(at(front + 34 + 12, across), at(front - 30 - 8, across + 4));
    }
  // A town stormed burns: its houses nearest the road it was stormed from, and about its gate.
  if (war.burning > 0) {
    const homes = [...plan.homes]
        .map((h) => ({ x: h.x, z: h.z, d: Math.hypot(h.x - gate.x, h.z - gate.z) }))
        .sort((a, b) => a.d - b.d),
      count = Math.max(2, Math.round(12 * war.burning));
    for (let j = 0; j < count; j++) {
      const home = homes[j],
        p =
          home ??
          at(reach * (0.3 + 0.6 * unit(j, key + 1)), (unit(j, key + 2) - 0.5) * reach * 1.2);
      fires.push({ x: p.x, z: p.z, size: war.burning * (0.6 + 0.4 * unit(j, key + 3)) });
    }
  }
  const middle = (s: 0 | 1): Flat | null =>
    sum[s]!.n ? { x: sum[s]!.x / sum[s]!.n, z: sum[s]!.z / sum[s]!.n } : null;
  return { soldiers, tents, fires, camp: nightFires, middles: [middle(0), middle(1)] };
}
