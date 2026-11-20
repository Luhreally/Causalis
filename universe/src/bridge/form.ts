// A town's form (asked 2026-11-19: "make the structures and gridding similar to a cities skyline mixed with suburbs etc and like
// ancient arechtecure but still all derived from first principles of the people and particular species"). One rule, no list of
// styles: a town's form is what moving, building and holding ground cost its people here.
//
//   • A street is as broad as two of what goes down it need to pass. Those on foot lay lanes two of their own bodies and their
//     loads wide; engines want twice that and a verge; a people who swim or fly pass over their town, and leave between their
//     blocks only what lets the light and the water through. A town founded after engines came is laid for them from its
//     first block; one that stood before keeps its lanes as far out as a household walks, and is laid for engines past that.
//   • Ground is worth what it saves in going. By the square, a short way from everything, it is dear: homes stand wall to wall
//     and a floor higher. At the edge it is cheap: homes stand apart in their yards. The faster and cheaper the going, the
//     flatter that falls: once households keep engines the edge is as near as the heart was, and most of the town is yards.
//     Walls make the ground within them scarce, and it is built close to the last lot. A people who pass over their town
//     save nothing by living at its heart: theirs is built alike from end to end; and those who fly lose nothing by
//     living high, so theirs are tall.
//   • How closely a people live (a hive, or each alone) sets how much of the town is built wall to wall.
//   • What grows in a yard is what its land's rain grows.
//   • A market is held on ground kept open for it: the next the town would have taken at its first market, as great as its
//     people then asked; under cover where there is one: posts and awnings, or a colonnade once its land builds in stone, as
//     high as its land has to spare. A realm seated here raises a column there, the higher the further its will is done
//     and the more its land has to spare. A way is kept broad from the square to its temple, and the temple stands on steps.
//     Where its ground rises and it was ever walled, whoever rules or is prayed to here holds the height on the walls' line.
//   • A home is built against its weather, of what its land holds, to its people's measure: its roof the steeper the more
//     snow and rain it sheds; its walls limewashed pale and built wall to wall about shaded courts where the sun is the
//     enemy; its floors as high as those who live on them; its front painted where there is something to spare.
//
// Pure: facts in (read by the host from what the world keeps, host/form.ts), a few numbers out; the view draws from them and
// the town's page says them. Nothing here is kept, and no world's history turns on it.
import { wallAt } from "./wall.ts";
import {
  SURVEYED,
  STRAIGHT,
  type MarketPlace,
  type StreetsLaid,
  type Survey,
  type TownSite,
} from "./sites.ts";

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
  /** The first block laid for engines (-1: they are not come to its land; host/form.ts laidForEngines). */
  readonly engines: number;
  /** Its land's rain (mm a year) and mean warmth (°C). */
  readonly rain: number;
  readonly warm: number;
  /** How far its realm's will is done on its land now (0 … 1), and what its land makes a head past what a head must eat (0 none … 1 plenty). */
  readonly reach: number;
  readonly spare: number;
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
  /** How high its market's cover stands (metres). */
  readonly cover: number;
  /** How pale its walls are washed against the sun (0 none … 0.6). */
  readonly pale: number;
  /** Its homes turn in on shaded courts, wall to wall (a hot, dry land). */
  readonly courts: boolean;
  /** How much steeper than its roofing asks a roof is pitched, for the snow it must shed (1: no steeper). */
  readonly steep: number;
  /** What its land has to spare, as its homes' fronts and its monuments show it (0 none … 1 plenty). */
  readonly spare: number;
};

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** A body's breadth against ours: as the cube root of its weight. */
export function bodyBreadth(mass: number): number {
  return clamp(Math.cbrt(Math.max(1, mass) / 70), 0.6, 1.6);
}

/** How long a household walks to its town's square and thinks nothing of it (minutes), and how fast ours walk (metres a minute). */
const WALK_MINUTES = 15,
  WALK_PACE = 75;

/**
 * How many blocks of a town lie within a household's walk of its square, for a people of a body's weight (they walk as fast
 * as the root of their breadth): the blocks of the round that far out, three quarters of it built, each with its street.
 */
export function walkBlocks(mass: number): number {
  const r = WALK_MINUTES * WALK_PACE * Math.sqrt(bodyBreadth(mass));
  return Math.round((Math.PI * r * r * 0.75) / ((36 + 7) * (28 + 7)));
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
    // (And where the sun is the enemy a wall shared is a wall shaded: more of the town is built so.)
    courts = !over && f.warm >= 20 && f.rain < 600,
    heart = f.water
      ? 0
      : clamp(0.14 + 0.26 * f.social + (f.winged ? 0.15 : 0) + (courts ? 0.25 : 0), 0, 0.75),
    spare = clamp(f.spare, 0, 1),
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
    // (A column is as high as the hands a realm can call to raise it: by how far its will is done, and what its land spares.)
    column:
      f.seat > 0 && f.stone
        ? Math.round(10 + 5 * (f.seat - 1) + 14 * clamp(f.reach, 0, 1) + 10 * spare)
        : 0,
    cover: Math.round((4.5 + 3.5 * spare) * Math.max(0.8, body) * 2) / 2,
    pale: f.water
      ? 0
      : Math.round(clamp((f.warm - 14) / 14, 0, 1) * (f.rain < 900 ? 0.6 : 0.3) * 20) / 20,
    courts,
    // (Snow lies where the year's mean is near freezing; heavy rain wants a quick roof too.)
    steep: f.water ? 1 : f.warm < 3 && f.rain > 250 ? 1.5 : f.rain > 1500 ? 1.25 : 1,
    spare: Math.round(spare * 10) / 10,
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
    fall = form.over ? 0.15 : 0.95 - 0.3 * form.rides;
  // (A swimmer's town has no dearest ground to build high on; a flier's is high from end to end.)
  return (
    (form.winged ? 1.5 : form.over ? 1.05 : 1.5) -
    fall * Math.min(1, out / Math.max(0.2, form.edge))
  );
}

/** From how much to spare a town's fronts are painted, each its own of a few washes. */
export const PAINTED_FROM = 0.4;

/**
 * From how steep a rise (metres in a kilometre, over its land's map about it) a town's ground has a height worth holding:
 * the steepest quarter of sites (on first light at year 120 a town's ground rises 3.5 at the median, 5.3 at the third
 * quarter, 8.8 at the nineteenth twentieth).
 */
export const HEIGHT_RISE = 6;

/**
 * The height a town holds, and for whom (null: none): its ground rises, it was once walled (the height is on its walls'
 * line (bridge/wall.ts), where no block was ever laid), and someone rules here (`seat`: a keep) or is prayed to here
 * (`temple`: a shrine). Not in its water, nor across a road in.
 */
export function heightHeld(
  site: TownSite,
  line: Float32Array,
  water: { readonly x: number; readonly z: number; readonly r: number } | null,
  seat: boolean,
  temple: boolean,
): { x: number; z: number; yaw: number; keep: boolean } | null {
  if (site.rise < HEIGHT_RISE || (!seat && !temple)) return null;
  const r = wallAt(line, site.up),
    x = r * Math.cos(site.up),
    z = r * Math.sin(site.up);
  if (water && Math.hypot(x - water.x, z - water.z) < water.r + 24) return null;
  for (const road of site.roads)
    if (
      Math.abs(Math.atan2(Math.sin(road.bearing - site.up), Math.cos(road.bearing - site.up))) <
      22 / r
    )
      return null;
  return { x, z, yaw: -site.up, keep: seat };
}

/** What of a town's form its page is told beside the form itself: all read, as its view reads them. */
export type FormSeen = {
  /** Its walls stand about it. */
  readonly walled: boolean;
  /** The lots it had when engines came were set down then (else: read off a household's walk). */
  readonly kept?: boolean;
  /** How far its realm's will was done as its ground was taken up (TownSite.surveys). */
  readonly surveys?: readonly Survey[];
  /** Its market place, where ground was kept for one. */
  readonly place?: MarketPlace | null;
  /** A ring street runs where its walls stood. */
  readonly ring?: boolean;
  /**
   * Its fields hold it back (TownSite.tilled): `fed`, the blocks it had when engines came to carry its food (-1: they
   * have not); `roads`, how many roads in it has.
   */
  readonly tilled?: { readonly fed: number; readonly roads: number };
  /** The height it holds. */
  readonly height?: "keep" | "shrine" | null;
  /** A temple stands in it. */
  readonly temple?: boolean;
  /** It has homes of five floors and more, and whether its land's walls can be stacked so. */
  readonly tall?: boolean;
  readonly stacks?: boolean;
  /** Its own ground on its land's map is water, and it stands on the bank (TownSite.bank): which water. */
  readonly bank?: "river" | "lake" | "sea" | null;
};

/** How a part of a town's ground was laid, by how far its realm's will was done there. */
function orderWords(order: number): string {
  const tenths = Math.round(order * 10);
  return order >= SURVEYED
    ? `its realm's will was done here ${tenths} parts in 10, enough to hold every household to a line: its ground was cut into equal blocks before it was built`
    : order >= STRAIGHT
      ? `its realm's will was done here ${tenths} parts in 10: enough to lay its streets straight, not to cut its blocks alike`
      : order > 0
        ? `its realm's will was done here only ${tenths} part${tenths === 1 ? "" : "s"} in 10: no one could hold a household to a line, and its lanes went where its people walked`
        : "no one here could hold a household to a line or write a plot down: its lanes went where its people walked";
}

/** The walls a people can stack five floors of as they are; the rest fire brick for it. */
export const STACKS: ReadonlySet<string> = new Set(["stone", "brick", "mudbrick"]);

/** A place in a row, in words. */
const ordinal = (n: number) =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;

/** A count of metres in words. */ const metres = (m: number) => `${Math.round(m)} m`;

/** A town's form in plain lines, each saying what is seen and why (`laid`: its streets, as streetsLaid gave them). */
export function formWhys(
  form: TownForm,
  laid: readonly StreetsLaid[] | undefined,
  seen: FormSeen | boolean,
): string[] {
  const see: FormSeen = typeof seen === "boolean" ? { walled: seen } : seen,
    walled = see.walled;
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
        ? see.kept
          ? `What it has taken since engines came to its land was laid for them: streets ${metres(engines.street)} wide and tarred${engines.verge ? ", each block behind a verge" : ""}. What stood before keeps the lanes it was walked in.`
          : `Past a quarter hour's walk from its square only engines make ground worth holding, and what stands there was laid for them: streets ${metres(engines.street)} wide${engines.verge ? ", each block behind a verge" : ""}. Nearer in it keeps the lanes it was walked in.`
        : `It was founded after engines came to its land, and laid for them from its first block: streets ${metres(engines.street)} wide${engines.verge ? ", each block behind a verge" : ""}.`,
    );
  if (form.heart > 0)
    out.push(
      form.winged
        ? "Nothing is lost by living high for those who fly: its homes by the square stand tall, wall to wall."
        : `Ground is dearest by its square, a short walk from everything: homes there stand wall to wall and a floor higher, the ground between them trodden bare${walled ? "; and as close everywhere within its walls, where ground is scarce" : ""}.`,
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
  if (see.bank)
    out.push(
      see.bank === "river"
        ? "It was founded on its river, for its water, and stands on the dry bank: its square by the water, its waterfront along it, the rest of it on the ground behind."
        : `It was founded on the ${see.bank === "sea" ? "sea" : "lake"}, for its water, and stands on the dry shore: its square by the water, its waterfront along it, the rest of it on the ground behind.`,
    );
  // How its ground was taken up, part by part.
  if (see.surveys && !form.over)
    see.surveys.forEach((v, k) => {
      const next = see.surveys![k + 1];
      if (next && next.from <= v.from) return;
      out.push(
        k === 0
          ? `When it was founded ${orderWords(v.order)}.`
          : `Where it grew on from its ${ordinal(v.from)} block ${orderWords(v.order)}.`,
      );
    });
  if (see.tilled && !form.over && see.tilled.roads > 0)
    out.push(
      see.tilled.fed >= 0
        ? `Until engines came (it had ${see.tilled.fed * 8} lots) it lived on the fields about it, and a field close in was worth the walk it saved: it built along its ${see.tilled.roads === 1 ? "road" : "roads"} before it built over one. Since its food comes from further off, it has filled the ground between.`
        : `It lives on the fields about it, and a field close in is worth the walk it saves: so it builds along its ${see.tilled.roads === 1 ? "road" : "roads"} before it builds over one, and fields reach in beside them until the road is built along far past them.`,
    );
  // (Measured ground is held by no field: once its realm's clerks have cut it into lots, those lots are no one's field
  // any more, and its blocks are taken nearest the square first: bridge/sites.ts takeCell.)
  if (
    see.tilled &&
    !form.over &&
    see.surveys?.some(
      (v, k) => v.order >= SURVEYED && (see.surveys![k + 1]?.from ?? Infinity) > v.from,
    )
  )
    out.push(
      "Where its ground was cut into equal blocks, each was a lot to be had and no longer anyone's field: no field holds its measured streets back, and they are built on nearest the square first.",
    );
  if (see.ring)
    out.push(
      "Nothing was built on the line of its walls while they stood: a ring street runs there now they are down.",
    );
  const where = see.place ? "on its market place" : "about its square";
  if (see.place)
    out.push(
      `Its market place is the ground it would have built on next at its first market, kept open: ${metres(see.place.w)} by ${metres(see.place.d)}, as great as its people then asked${see.place.through ? ", its main street through its middle" : ""}.`,
    );
  if (form.forum)
    out.push(
      form.forum === 2
        ? `Its market is held under a colonnade of stone ${where}, ${metres(form.cover)} high: the more its land has to spare, the higher.`
        : `Its market is held under posts and awnings ${where}: its land does not build in stone.`,
    );
  if (form.column)
    out.push(
      `A column ${metres(form.column)} high stands ${see.place ? "there" : "in its square"}, raised by the realm seated here: as high as the hands it can call on, by how far its will is done and what its land spares.`,
    );
  if (see.temple && form.stone)
    out.push(
      "Its temple stands on steps, two tall stones before its doors, and a way is kept to it from the square between pillars.",
    );
  if (see.height)
    out.push(
      see.height === "keep"
        ? "Its ground rises to one side, and whoever rules here holds that height: a keep on the line of its walls, in the realm's colours."
        : "Its ground rises to one side, and its people pray on that height: a shrine on the line of its walls.",
    );
  if (form.courts)
    out.push(
      "The sun is the enemy here: walls are washed pale with lime, and homes stand wall to wall about shaded courts well out from its square.",
    );
  else if (form.pale >= 0.15) out.push("Its walls are washed pale with lime against the sun.");
  if (form.steep > 1)
    out.push(
      form.steep >= 1.5
        ? "Its roofs are pitched steep and laid dark, to shed the snow."
        : "Its roofs are pitched steep, to shed its heavy rain.",
    );
  if (Math.abs(form.body - 1) > 0.08 && !form.over)
    out.push(
      `Its floors are ${(3 * Math.max(0.75, Math.min(1.5, form.body))).toFixed(1)} m high: its people stand ${form.body > 1 ? "broader and taller" : "smaller"} than ours.`,
    );
  if (!form.over)
    out.push(
      "Its quarters differ as what stands in them does: soot on the walls and roofs of its lee, where its smithies and kilns are; lime and its best roofing on its high ground; fronts washed to be seen down its busiest road; the damp's grey by its water. Its oldest blocks have weathered darkest.",
    );
  if (form.spare >= PAINTED_FROM)
    out.push("Its land makes well more than it eats: one front in three is painted.");
  else if (form.spare < 0.15)
    out.push("Its land has little to spare: its homes stand in the bare stuff they are built of.");
  if (see.tall && !form.own)
    out.push(
      see.stacks
        ? "Its tall homes are raised in what its low ones are built of: its land's walls can be stacked floor on floor."
        : "Its tall homes are of fired brick: what its low ones are built of cannot be stacked five floors high.",
    );
  if (form.own)
    out.push(
      "Its tall homes are raised in what its low ones are built of: its people have no brick to stack.",
    );
  return out;
}
