// A town's form (asked 2026-11-19: "make the structures and gridding similar to a cities skyline mixed with suburbs etc and like
// ancient arechtecure but still all derived from first principles of the people and particular species"). One rule, no list of
// styles: a town's form is what moving, building and holding ground cost its people here.
//
//   • A street is as broad as two of what goes down it need to pass. Those on foot lay lanes two of their own bodies and their
//     loads wide; engines want twice that and a verge; a people who swim or fly pass over their town, and leave between their
//     blocks only what lets the light and the water through.
//   • Ground is worth what it saves in going. By the square, a short way from everything, it is dear: homes stand wall to wall
//     and a floor higher. At the edge it is cheap: homes stand apart in their yards. The faster and cheaper the going, the
//     flatter that falls: once households keep engines the edge is as near as the heart was, and most of the town is yards.
//     Walls make the ground within them scarce, and it is built close to the last lot. A people who pass over their town
//     save nothing by living at its heart: theirs is built alike from end to end; and those who fly lose nothing by
//     living high, so theirs are tall.
//   • How closely a people live (a hive, or each alone) sets how much of the town is built wall to wall.
//   • What grows in a yard is what its land's rain grows.
//   • A market is held under cover where there is one: posts and awnings, or a colonnade once its land builds in stone. A realm
//     seated here raises a column in its square, as high as it is old and great. A way is kept broad from the square to its
//     temple.
//
// Pure: facts in (read by the host from what the world keeps, host/form.ts), a few numbers out; the view draws from them and
// the town's page says them. Nothing here is kept, and no world's history turns on it.
import type { StreetsLaid } from "./sites.ts";

/** What a town's form is reckoned from: all read from what the world keeps. */
export type FormFacts = {
  /** How its people get about now (GetAbout.how), and the share of households that keep what they ride. */
  readonly how: "wheels" | "sled" | "hauler" | "line" | "swim" | "mount" | "feet";
  readonly share: number;
  /** Their body: its weight (kg), whether it flies, whether it lives in the water, how closely they live (0 alone … 1 a hive). */
  readonly mass: number;
  readonly winged: boolean;
  readonly water: boolean;
  readonly social: number;
  /** The first block laid since engines came to its land (-1: none yet). */
  readonly engines: number;
  /** Its land's rain (mm a year) and mean warmth (°C). */
  readonly rain: number;
  readonly warm: number;
  /** Whether its land builds in stone, and whether it holds a market. */
  readonly stone: boolean;
  readonly market: boolean;
  /** A realm's seat: 0 none, 1 a hall, 2 a palace, 3 a palace with wings (as the realm is old and great). */
  readonly seat: number;
  readonly people: number;
  /** Its world is not of rock and water as ours, or its people's own stuff is not clay: its tall homes are of what its low ones are. */
  readonly own: boolean;
};

/** A town's form, as its view draws it and its page says it. */
export type TownForm = {
  /** Its people's breadth against ours (1). */
  readonly body: number;
  /** They pass over their town (they swim, or fly): its lanes need let no one by. */
  readonly over: boolean;
  /** They fly: nothing is lost by living high. */
  readonly winged: boolean;
  /** Households keep engines to ride; the share that do. */
  readonly drive: boolean;
  readonly rides: number;
  /** The first block laid for engines (-1: none). */
  readonly engines: number;
  /** How far out from the square, of the whole way to its edge (0 … 1), its ground is dear enough to build wall to wall and a floor higher. */
  readonly heart: number;
  /** From how far out its homes stand apart in their yards (1: none do). */
  readonly edge: number;
  /** How much grows in a yard (0 bare … 1 lush). */
  readonly green: number;
  /** Its tall homes are of its people's own stuff, not brick. */
  readonly own: boolean;
  /** Its land builds in stone. */
  readonly stone: boolean;
  /** Its market's cover about its square: 0 none, 1 posts and awnings, 2 a colonnade of stone. */
  readonly forum: 0 | 1 | 2;
  /** The column in its square, metres high (0: none). */
  readonly column: number;
};

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** A body's breadth against ours: as the cube root of its weight. */
export function bodyBreadth(mass: number): number {
  return clamp(Math.cbrt(Math.max(1, mass) / 70), 0.6, 1.6);
}

/** How broad what goes down a street is (metres): a walker with a load, a beast with panniers, a cart, an engine. */
const BREADTH = {
  feet: 0.75,
  mount: 0.75,
  swim: 0,
  sled: 0,
  line: 1.25,
  hauler: 1.6,
  wheels: 2.25,
} as const;
/** What a street keeps each side of those passing (a doorstep, a stall, a gutter), and what a people who pass over leave between blocks. */
const SIDE = 1.5,
  OVER = 3;

/**
 * How a town's streets were laid, part by part (TownSite.laid; undefined: as our own on foot lay theirs, six metres and eight):
 * a lane two of what goes down it and a doorstep each side, a measured street a third broader. What was laid since engines came
 * is laid for them, behind a verge.
 */
export function streetsLaid(f: FormFacts): StreetsLaid[] | undefined {
  const body = bodyBreadth(f.mass),
    over = f.water || f.winged;
  if (over) return [{ from: 0, lane: OVER, street: OVER, verge: 0 }];
  const lane = (breadth: number) => Math.round((2 * breadth * 2 + 2 * SIDE) * 2) / 2,
    foot = lane(BREADTH.feet * body),
    out: StreetsLaid[] = [];
  // (Ours on foot: 6 and 8, as they have always been laid; said only where a body is not ours.)
  if (Math.abs(body - 1) > 0.08)
    out.push({ from: 0, lane: foot, street: Math.round(foot * 1.33 * 2) / 2, verge: 0 });
  if (f.engines >= 0 && (f.how === "wheels" || f.how === "hauler" || f.how === "line")) {
    const wide = lane(BREADTH[f.how] * Math.max(1, body));
    out.push({
      from: f.engines,
      lane: Math.max(foot, wide - 3),
      street: wide,
      // (A household's own engine wants room to stand: a verge. A line or a hauler shared by all wants none.)
      verge: f.how === "wheels" ? 3 : 0,
    });
  }
  return out.length ? out : undefined;
}

/** A town's form from its facts. */
export function townForm(f: FormFacts): TownForm {
  const body = bodyBreadth(f.mass),
    over = f.water || f.winged,
    drive = f.engines >= 0 && (f.how === "wheels" || f.how === "sled"),
    rides = drive ? clamp(f.share, 0, 1) : 0,
    // (The closer they live, the more of the town is built wall to wall; a swimmer saves nothing by the heart.)
    heart = f.water ? 0 : clamp(0.14 + 0.26 * f.social + (f.winged ? 0.15 : 0), 0, 0.6),
    // (On foot the last sixth of the way out is cheap enough for yards; with engines, as far in as they are kept.)
    edge = over ? 1 : clamp(1 - (0.16 + 0.7 * rides), Math.max(heart + 0.1, 0.35), 1),
    green = f.water ? 0 : clamp(f.rain / 900, 0, 1) * (f.warm < -4 ? 0.3 : 1);
  return {
    body,
    over,
    winged: f.winged,
    drive,
    rides,
    engines: drive || f.how === "hauler" || f.how === "line" ? f.engines : -1,
    heart,
    edge,
    green: Math.round(green * 100) / 100,
    own: f.own,
    stone: f.stone,
    forum: f.market ? (f.stone ? 2 : 1) : 0,
    column:
      f.seat > 0 && f.stone
        ? Math.round(6 + 5 * (f.seat - 1) + 2 * Math.log10(Math.max(10, f.people)))
        : 0,
  };
}

/** The ground a lot stands on, as its worth sorts it: the heart, the town between, the edge. */
export const TIER = { heart: 0, town: 1, edge: 2 } as const;

/**
 * Which ground lot `p` of a town of `whole` lots stands on. Its lots are taken outward from its square, so how far out a lot
 * stands goes as the root of its place among them. `walled`: the lots its standing walls ring, all of them built close.
 */
export function lotTier(form: TownForm, p: number, whole: number, walled = 0): number {
  const out = Math.sqrt((p + 0.5) / Math.max(1, whole));
  if (p < walled || out < form.heart) return TIER.heart;
  return out >= form.edge ? TIER.edge : TIER.town;
}

/** How high a tall home stands against its kind's height, by how far out it is: the dearest ground builds highest. */
export function tallShare(form: TownForm, p: number, whole: number): number {
  const out = Math.sqrt((p + 0.5) / Math.max(1, whole)),
    // (Flatter where the going is fast and cheap.)
    fall = form.over ? 0.15 : 0.55 - 0.3 * form.rides;
  return (form.winged ? 1.25 : 1.15) - fall * Math.min(1, out / Math.max(0.2, form.edge));
}

/** A count of metres in words. */
const metres = (m: number) => `${Math.round(m)} m`;

/** A town's form in plain lines, each saying what is seen and why (`laid`: its streets, as streetsLaid gave them). */
export function formWhys(
  form: TownForm,
  laid: readonly StreetsLaid[] | undefined,
  walled: boolean,
): string[] {
  const out: string[] = [],
    first = laid?.[0],
    engines = laid?.find((l) => l.from === form.engines && form.engines >= 0);
  if (form.over)
    out.push(
      `Its people pass over their town${form.winged ? " on the wing" : ", swimming"}, so no lane has to let two of them by: its blocks stand ${metres(first?.lane ?? 3)} apart, enough for ${form.winged ? "light" : "light and the water's flow"}.`,
    );
  else if (first && first.from === 0 && first !== engines)
    out.push(
      `Its lanes are ${metres(first.lane)} wide: two of its people passing with their loads, and a doorstep each side.`,
    );
  if (engines)
    out.push(
      engines.from > 0
        ? `What was laid since engines came is laid for them: streets ${metres(engines.street)} wide${engines.verge ? ", each block behind a verge" : ""}. Its old heart keeps the lanes it was walked in.`
        : `It was laid for engines from its first block: streets ${metres(engines.street)} wide${engines.verge ? ", each block behind a verge" : ""}.`,
    );
  if (form.heart > 0)
    out.push(
      form.winged
        ? "Nothing is lost by living high for those who fly: its homes by the square stand tall, wall to wall."
        : `Ground is dearest by its square, a short walk from everything: homes there stand wall to wall and a floor higher${walled ? ", and as close everywhere within its walls, where ground is scarce" : ""}.`,
    );
  else if (form.over)
    out.push(
      "No one saves a walk by living at its heart, so no ground is dearer than the rest: it is built alike from end to end.",
    );
  if (form.edge < 1)
    out.push(
      form.drive
        ? `${Math.round(form.rides * 10)} in 10 of its households keep an engine to ride, so the edge is as near as the heart once was: from ${Math.round(form.edge * 10)} tenths of the way out its homes stand apart in their yards.`
        : `At its edge ground is cheap: homes stand apart, each in its yard${form.green >= 0.35 ? " and garden" : form.green < 0.12 ? ", bare for want of rain" : ""}.`,
    );
  if (form.forum)
    out.push(
      form.forum === 2
        ? "Its market is held under a colonnade of stone about its square."
        : "Its market is held under posts and awnings about its square: its land does not build in stone.",
    );
  if (form.column)
    out.push(
      `A column ${metres(form.column)} high stands in its square, raised by the realm seated here: the older and greater the realm, the higher.`,
    );
  if (form.own)
    out.push(
      "Its tall homes are raised in what its low ones are built of: its people have no brick to stack.",
    );
  return out;
}
