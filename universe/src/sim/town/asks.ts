// A town asked (H1, classic 34a): the god, or a ruler of their own realm, asks a town to put something first or to raise something. What can be asked is
// read off the world: what its land knows, what it has already, the people's body, how great it is. Who answers, and how, is read off what they are short
// of, what they have come through and what they believe of the one asking. What goes up goes up by hands, month by month, eating from the land's stores,
// and it stops for what stops any work. Nothing is kept for a town never asked, and a world where nobody asks anything runs exactly as it did.
import {
  MONTH,
  YEAR,
  defineEventType,
  defineStream,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { CIVICS, FOODS, G, civic, needsMet, wallYears, type CivicKind } from "../../rules/index.ts";
import { meansOfWorld } from "../../gen/index.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { beliefOf } from "../belief/belief.ts";
import { citiesOf } from "../city/city.ts";
import { DISASTER_EVENTS } from "../acts/disasters.ts";
import { watersOf } from "../ecology/ecology.ts";
import { knows, loreOf } from "../lore/lore.ts";
import type { Market } from "../economy/market.ts";
import { marketsOf, type PopulationContext } from "../population/systems.ts";
import type { Settlement } from "../population/stores.ts";
import { lawOf } from "../order/laws.ts";
import { orderOf } from "../order/order.ts";
import { politiesOf } from "../polity/polity.ts";
import { warsOf } from "../war/war.ts";
import { CIVIC_LOTS, TownBuilder, housingOf, townsOf, type Fabric } from "./fabric.ts";

export const ASK_EVENTS = {
  asked: defineEventType("town.asked", 5),
  raised: defineEventType("town.raised", 5),
  left: defineEventType("town.ask-left", 4),
};

const ASK_DRAW = defineStream("town.ask");

/** Whatever a town can put first. */
export const ASK_FIRSTS = [
  "food",
  "stores",
  "homes",
  "walls",
  "arms",
  "trade",
  "faith",
  "learning",
] as const;
export type AskFirst = (typeof ASK_FIRSTS)[number];

/** A thing to raise: one of a town's buildings, or walls about it. */
export type AskRaise = CivicKind | "walls";

/** Who answers, by what they are: as J1 reads who judges. */
export type AskForm = "hive" | "reef" | "elders" | "moot" | "head" | "council";
export type AskAnswer = "glad" | "grudged" | "half" | "refused";
export type AskWhyCode =
  | "lean"
  | "hungry"
  | "war"
  | "threat"
  | "peace"
  | "wants"
  | "few"
  | "long"
  | "asked"
  | "refusedLately"
  | "feared"
  | "blessed"
  | "devout"
  | "faithless"
  | "crown"
  | "unrest"
  | "little";

export type AskStop = {
  readonly from: number;
  to: number | null;
  readonly why: "war" | "quake" | "food";
  readonly ref: Ref | null;
};

export type AskWork = {
  /** The first lot it stands on (-1: walls), how many, the year begun: as its building is found in its town's fabric. */
  readonly at: number;
  readonly lots: number;
  readonly start: number;
  /** How many at work on it, and the person-months it wants in all. */
  readonly hands: number;
  readonly effort: number;
  /** A share of its land's harvest, in thousandths, those hands would have brought in. */
  readonly drain: number;
  worked: number;
  /** The moment it was finished, and its telling. */
  done: number | null;
  doneEvent: Ref | null;
  /** Given up: when, and why. */
  left: {
    readonly t: number;
    readonly why: "empty" | "fell" | "taken";
    readonly ref: Ref | null;
  } | null;
  stops: AskStop[];
  /** What it has eaten and worn out of the land's stores, in the market's own measures. */
  food: number;
  tools: number;
};

export type Ask = {
  /** Its number among its town's asks. */
  readonly n: number;
  readonly town: Ref;
  readonly cell: number;
  readonly kind: "raise" | "first";
  readonly what: string;
  readonly t: number;
  readonly event: Ref;
  /** A ruler's word, where it was one (null: the god's). */
  readonly by: { readonly realm: Ref; readonly ruler: string } | null;
  readonly form: AskForm;
  readonly answer: AskAnswer;
  /** Why they answered so: each a reason and how far it moved them, in hundredths. */
  readonly why: readonly (readonly [AskWhyCode, number])[];
  /** The town's share of its land's people when asked, in thousandths. */
  readonly share: number;
  /** How many it held then. */
  readonly people: number;
  /** A priority: until when it stands. */
  until: number | null;
  /** A thing raised. */
  work: AskWork | null;
};

export type AskArgs = {
  village: Ref;
  kind: "raise" | "first";
  what: string;
  by?: { realm: Ref; ruler: string };
};

/** A share of its hands a priority takes, by how it was taken up. */
export const ASK_PULL: Readonly<Record<AskAnswer, number>> = {
  glad: 0.14,
  grudged: 0.1,
  half: 0.06,
  refused: 0,
};
/** How much a hand put to the fields brings in, against one taken from them. */
const FOOD_GAIN = 0.8;
/** How long a priority stands (years). */
export const ASK_FIRST_YEARS = 6;
/** How far hands are spared to a site, by how it was taken up. */
const ASK_SPARES: Readonly<Record<AskAnswer, number>> = {
  glad: 1,
  grudged: 0.7,
  half: 0.5,
  refused: 0,
};
/** The most lots a people will ring with walls: past this a town has outgrown any ring. */
export const WALL_MOST_LOTS = 4000;
/** The fewest it takes to raise anything at all. */
const FEWEST = 30;
/** A granary's food, for how many a year: no one granary feeds a great city. */
const GRANARY_FEEDS = 4000;
/** Person-months in a year of a building's plan: six hands, all year. */
const YEARS_WORK = 72;
/** A well is a small thing. */
const WELL_EFFORT = 26;
/** One more of a kind, a great town may be asked for: one for so many of its people. */
const ASK_MORE: Partial<Readonly<Record<CivicKind, number>>> = {
  shrine: 60_000,
  granary: 30_000,
  market: 60_000,
  school: 40_000,
  hospital: 60_000,
  well: 20_000,
};

const isFirst = (w: string): w is AskFirst => (ASK_FIRSTS as readonly string[]).includes(w);
const isCivic = (w: string): w is CivicKind => CIVICS.some((c) => c.kind === w);

export class AskStore implements StateStore {
  readonly name = "town.asks";
  private list: Ask[] = [];
  private readonly byTown = new Map<string, Ask[]>();
  private readonly byCell = new Map<number, Ask[]>();
  /** Those at work now. */
  open: Ask[] = [];

  all(): readonly Ask[] {
    return this.list;
  }
  ofTown(town: string): readonly Ask[] {
    return this.byTown.get(town) ?? [];
  }
  ofCell(cell: number): readonly Ask[] {
    return this.byCell.get(cell) ?? [];
  }
  /** The priority standing in a town at a moment. */
  firstOf(town: string, t: number): Ask | null {
    const list = this.byTown.get(town);
    if (!list) return null;
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i]!;
      if (
        a.kind === "first" &&
        a.until !== null &&
        a.answer !== "refused" &&
        t >= a.t &&
        t < a.until
      )
        return a;
    }
    return null;
  }
  /** The ask behind one of its town's buildings, by its lot and year begun; or its walls (at -1). */
  raised(town: string, at: number, start: number): Ask | null {
    return (
      this.byTown
        .get(town)
        ?.find((a) => a.work !== null && a.work.at === at && (at < 0 || a.work.start === start)) ??
      null
    );
  }
  add(a: Ask): void {
    this.list.push(a);
    let t = this.byTown.get(a.town);
    if (!t) this.byTown.set(a.town, (t = []));
    t.push(a);
    let c = this.byCell.get(a.cell);
    if (!c) this.byCell.set(a.cell, (c = []));
    c.push(a);
    if (a.work && a.work.done === null && !a.work.left) this.open.push(a);
  }
  /**
   * What a land's asks do to its harvest this month: hands taken from the fields, or put to them. Exactly 1 on a land never asked.
   */
  gift(cell: number, t: number): number {
    const list = this.byCell.get(cell);
    if (!list) return 1;
    let k = 1;
    for (const a of list) {
      if (a.kind === "first") {
        if (a.until === null || t >= a.until || t < a.t) continue;
        const pull = (ASK_PULL[a.answer] * a.share) / 1000;
        k *= a.what === "food" ? 1 + pull * FOOD_GAIN : 1 - pull;
      } else if (a.work && a.work.done === null && !a.work.left) {
        k *= 1 - a.work.drain / 1000;
      }
    }
    return k;
  }
  /** Those at work on a land's sites eat from what came in this month, over what they'd have eaten at home (none stopped). */
  feed(cell: number, m: Market): void {
    for (const a of this.open) {
      if (a.cell !== cell || !a.work || a.work.stops.at(-1)?.to === null) continue;
      let due = Math.ceil(a.work.hands / 2);
      for (const g of FOODS) {
        if (due <= 0) break;
        const took = m.take("used", g, due);
        a.work.food += took;
        due -= took;
      }
    }
  }
  /** More months a land can keep, for what it was asked to store. Exactly 0 on a land never asked. */
  stored(cell: number, t: number): number {
    const list = this.byCell.get(cell);
    if (!list) return 0;
    let n = 0;
    for (const a of list) {
      if (a.kind === "first") {
        if (a.what === "stores" && a.until !== null && t >= a.t && t < a.until)
          n += (12 * ASK_PULL[a.answer] * a.share) / 1000;
      } else if (a.what === "granary" && a.work?.done != null) {
        n += (12 * Math.min(GRANARY_FEEDS, a.people)) / Math.max(1, (a.people * 1000) / a.share);
      }
    }
    return n;
  }
  /**
   * How much more a land's defenders count for what was asked of its towns: walls raised at the asking, a town at its walls or its arms. Exactly 1 on a land
   * never asked.
   */
  guard(cell: number, t: number): number {
    const list = this.byCell.get(cell);
    if (!list) return 1;
    let k = 1;
    for (const a of list) {
      if (a.kind === "raise" && a.what === "walls" && a.work?.done != null) {
        if (a.work.done <= t) k *= 1 + (0.35 * a.share) / 1000;
      } else if (a.kind === "first" && (a.what === "walls" || a.what === "arms")) {
        if (a.until !== null && t >= a.t && t < a.until)
          k *= 1 + (ASK_PULL[a.answer] * a.share) / 1000;
      }
    }
    return k;
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const a of this.list) {
      out.push(a.event);
      if (a.work?.doneEvent) out.push(a.work.doneEvent);
    }
    return out;
  }
  /** Nothing asked: nothing in a world's hash, not even a name. */
  dormant(): boolean {
    return !this.list.length;
  }
  hashInto(h: Hasher): void {
    h.value(this.list);
  }
  save(): unknown {
    return this.list.length ? { list: this.list } : {};
  }
  load(state: unknown): void {
    this.list = [];
    this.byTown.clear();
    this.byCell.clear();
    this.open = [];
    for (const a of (state as { list?: Ask[] } | null)?.list ?? [])
      this.add({
        ...a,
        work: a.work ? { ...a.work, stops: a.work.stops.map((s) => ({ ...s })) } : null,
      });
  }
}

export function asksOf(world: World): AskStore {
  return world.store<AskStore>("town.asks");
}

/** Who answers in a land, by what they are and how they are ruled. */
export function askFormOf(ctx: PopulationContext, cell: number): AskForm {
  const body = ctx.generated.life.people?.body;
  if ((body?.social ?? 0) >= 0.9 && (body?.size ?? 100) < 100 && body?.medium !== "water")
    return "hive";
  if (body?.medium === "water") return "reef";
  const world = ctx.world,
    realm = politiesOf(world).of(cell),
    order = realm ? orderOf(world)?.of(realm.ref) : undefined,
    written = loreOf(world).effect(cell, "writing") > 0;
  if (!written || !realm) return "elders";
  const justice = order ? lawOf(order, "justice").position : 0;
  return justice <= 0 ? "moot" : justice === 1 ? "head" : "council";
}

const standsOf = (f: Fabric | undefined, kind: CivicKind) =>
  f ? f.civics.filter((c) => c.fell === null && c.kind === kind).length : 0;

/** Whether a land's people could raise one of these, and why not if not (null: they could). */
export function raiseProblem(ctx: PopulationContext, s: Settlement, what: AskRaise): string | null {
  const f = townsOf(ctx.world).get(s.ref),
    cell = s.cell,
    people = s.population;
  if (!f) return "it has no streets yet to build on";
  const know = (id: string) => id.split("|").some((x) => knows(ctx, cell, x));
  if (what === "walls") {
    if (f.walls) return "it has its walls";
    if (!know("fortification")) return "they know nothing of walls yet";
    if (f.next > WALL_MOST_LOTS) return "it has grown too great for any ring to go about it";
    if (people < FEWEST * 3) return "there are too few of them to ring it";
    return null;
  }
  const def = civic(what);
  if (def.needs.length && !needsMet(def, know)) return "they don't yet know how";
  if (def.city && !citiesOf(ctx.world).get(s.ref)) return "only a city raises that";
  if (def.faith && !beliefOf(ctx.world).of(cell).faith) return "its land holds no faith";
  if (def.water && !watersOf(ctx.generated, cell)) return "there is no water at hand for it";
  if (what === "well") {
    if (ctx.medium === "water") return "they live in the water";
    if (watersOf(ctx.generated, cell)) return "it has water at hand";
    if (knows(ctx, cell, "electricity")) return "its water comes by pipe";
  }
  const floor = what === "well" ? FEWEST : Math.max(FEWEST, Math.floor(def.people / 2));
  if (people < floor) return "there are too few of them";
  if (
    f.civics.some((c) => c.fell === null && c.kind === what && c.end > yearOfMoment(ctx.world.now))
  )
    return "one is rising already";
  const planned = def.per ? Math.max(1, Math.min(def.most ?? 99, Math.floor(people / def.per))) : 1,
    more = ASK_MORE[what],
    want = Math.max(planned, more ? 1 + Math.min(5, Math.floor(people / more)) : 1),
    // (What took a building's place stands for it: a temple is the town's shrine.)
    above = CIVICS.filter((c) => c.replaces === what).reduce((n, c) => n + standsOf(f, c.kind), 0),
    has = standsOf(f, what) + above;
  if (has >= want) return "it has one";
  if (
    asksOf(ctx.world)
      .ofTown(s.ref)
      .some((a) => a.what === what && a.work?.done === null && !a.work?.left)
  )
    return "one is going up already";
  return null;
}

/** Whether a town could put this first, and why not if not (null: it could). */
export function firstProblem(ctx: PopulationContext, s: Settlement, what: AskFirst): string | null {
  const f = townsOf(ctx.world).get(s.ref),
    cell = s.cell,
    held = (kind: CivicKind) => standsOf(f, kind) > 0;
  if (asksOf(ctx.world).firstOf(s.ref, ctx.world.now)?.what === what)
    return "it has that first now";
  switch (what) {
    case "food":
      return null;
    case "stores":
      return held("granary") || knows(ctx, cell, "granaries") || knows(ctx, cell, "pottery")
        ? null
        : "it has nothing to keep them in";
    case "homes":
      return f && s.population > housingOf(f) * 0.9 ? null : "it has homes enough";
    case "walls":
      return f?.walls ? null : "it has no walls to see to";
    case "arms":
      return politiesOf(ctx.world).of(cell) &&
        (held("smithy") || held("workshop") || held("factory"))
        ? null
        : "it has no forge or works to make them";
    case "trade":
      return s.market || held("market") ? null : "no market comes to it";
    case "faith":
      return beliefOf(ctx.world).of(cell).faith ? null : "its land holds no faith";
    case "learning":
      return held("school") || knows(ctx, cell, "writing") ? null : "they have no letters yet";
  }
}

/** Whether a land's towns can be asked at all (null: this one can). */
export function askShut(ctx: PopulationContext, town: Ref): string | null {
  const s = ctx.settlements.get(town);
  if (!s) return `no town ${town}`;
  if (!ctx.settlements.held(town))
    return "your word reaches no sealed halls: its town is kept by its land";
  if (s.population <= 0) return "no one lives there";
  return null;
}

/** How long a thing takes in person-months: by its size, and what its people have to do it with. */
export function effortOf(ctx: PopulationContext, s: Settlement, what: AskRaise): number {
  const f = townsOf(ctx.world).get(s.ref),
    machines = knows(ctx, s.cell, "electricity") || knows(ctx, s.cell, "engines"),
    grips = meansOfWorld(ctx.generated).grips,
    base =
      what === "walls"
        ? wallYears(f?.next ?? 0) * YEARS_WORK * 2
        : what === "well"
          ? WELL_EFFORT
          : civic(what).years * YEARS_WORK;
  return Math.ceil(base * (machines ? 0.4 : 1) * (grips ? 1 : 1.5));
}

/** How many it takes on a site at most, however many there are. */
function siteMost(what: AskRaise, lots: number, reach: number): number {
  return what === "walls" ? 24 + Math.floor(Math.sqrt(reach)) : what === "well" ? 8 : 6 + 4 * lots;
}

/** How many it spares, by how it was taken up. */
export function handsFor(
  people: number,
  what: AskRaise,
  lots: number,
  reach: number,
  answer: AskAnswer,
): number {
  // (Of the grown, a third can be spared from the year's work.)
  const free = Math.floor(people * 0.5 * 0.34),
    most = siteMost(what, lots, reach);
  return Math.max(1, Math.round(Math.min(free, most) * ASK_SPARES[answer]));
}

const GOD_BAD = new Set(["act.fire", "act.quake", "act.flood", "act.meteor", "act.curse"]);
const GOD_GOOD = new Set(["act.shrine", "act.spring", "act.inspire"]);

/** What they believe of the god, from what the god has lately done to them. */
function godLately(
  ctx: PopulationContext,
  s: Settlement,
  t: number,
): { feared: boolean; blessed: boolean } {
  const events = ctx.world.events,
    land = ctx.provinces.get(s.cell)?.ref ?? null,
    since = t - 30 * YEAR;
  let feared = false,
    blessed = false;
  for (let i = events.count - 1; i >= 0 && events.at(i).t > since; i--) {
    const e = events.at(i);
    if (!e.type.startsWith("act.")) continue;
    if (e.place !== land && e.subjects[0] !== s.ref) continue;
    const sign = (e.data as { sign?: number } | null)?.sign;
    if (GOD_BAD.has(e.type) && !(e.data as { natural?: boolean } | null)?.natural) feared = true;
    else if (GOD_GOOD.has(e.type)) blessed = true;
    else if (e.type === "act.harvest" || e.type === "act.rain" || e.type === "act.plague") {
      if ((sign ?? 1) < 0) feared = true;
      else blessed = true;
    }
  }
  return { feared, blessed };
}

/** Whether war is on a land's people, and on the land itself. */
function warNear(ctx: PopulationContext, cell: number, year: number): "here" | "near" | "none" {
  const realm = politiesOf(ctx.world).of(cell);
  if (!realm) return "none";
  let near = false;
  for (const w of warsOf(ctx.world).fighting(realm.ref)) {
    if (w.ended !== null && w.ended < year - 3) continue;
    near = true;
    for (let i = w.battles.length - 1; i >= 0; i--) {
      const b = w.battles[i]!;
      if (b.year < year - 3) break;
      if (b.land === cell) return "here";
    }
  }
  return near ? "near" : "none";
}

/** How they answer, and why: read off what they are short of, what they have come through, what they believe of who asks. */
export function answerOf(
  ctx: PopulationContext,
  s: Settlement,
  kind: "raise" | "first",
  what: string,
  t: number,
  n: number,
  by: AskArgs["by"] | null,
): { answer: AskAnswer; why: (readonly [AskWhyCode, number])[]; form: AskForm } {
  const { world } = ctx,
    cell = s.cell,
    year = yearOfMoment(t),
    form = askFormOf(ctx, cell),
    ledger = ctx.history.yearsOf(cell),
    rec = ledger.findLast((y) => y.year <= year - 1),
    fed = rec ? rec.fed / 1000 : 1,
    before = ledger.filter((y) => y.year < year - 1 && y.year >= year - 11),
    usual = before.length ? before.reduce((a, y) => a + y.fed, 0) / before.length / 1000 : 1,
    lean = fed < 0.97 && fed < usual - 0.03,
    hungry = fed < 0.8,
    war = warNear(ctx, cell, year),
    feeds = what === "food" || what === "stores" || what === "granary" || what === "well",
    guards = what === "walls" || what === "arms",
    prayer = what === "faith" || what === "shrine" || what === "temple",
    why: [AskWhyCode, number][] = [],
    move = (code: AskWhyCode, by2: number) => {
      why.push([code, Math.round(by2 * 100)]);
      return by2;
    };
  let score = 0.7;
  // What they are short of.
  if (feeds) {
    if (lean || hungry) score += move("wants", 0.8);
  } else if (hungry) score += move("hungry", -1.3);
  else if (lean) score += move("lean", -0.7);
  // What is coming.
  if (guards) {
    if (war === "here") score += move("war", 0.9);
    else if (war === "near") score += move("threat", 0.5);
    else score += move("peace", -0.5);
  } else if (war === "here") score += move("war", -0.8);
  // What they think of the asking, and how much of it there has been.
  const asks = asksOf(world),
    lately = asks.ofTown(s.ref).filter((a) => t - a.t < 12 * YEAR),
    refused = lately.filter((a) => a.answer === "refused").length,
    hereOn = asks.ofCell(cell).filter((a) => a.town !== s.ref && t - a.t < 4 * YEAR).length;
  if (lately.length) score += move("asked", -0.45 * lately.length);
  if (hereOn) score += move("asked", -0.15 * hereOn);
  if (refused) score += move("refusedLately", -0.3 * refused);
  const god = by ? { feared: false, blessed: false } : godLately(ctx, s, t);
  if (god.feared) score += move("feared", 0.35);
  if (god.blessed) score += move("blessed", 0.5);
  // What they hold to.
  const ways = cultureOf(world).get(cell),
    piety = ways ? ways.traits[WAY.piety]! : 0.5,
    tenet = beliefOf(world).of(cell).faith;
  if (prayer) {
    if (piety > 0.6) score += move("devout", 0.5);
    else if (piety < 0.35) score += move("faithless", -0.5);
  } else if (!by && piety > 0.75 && tenet) score += move("devout", 0.25);
  // How much it asks of them.
  if (kind === "raise" && (what === "walls" || isCivic(what))) {
    const f = townsOf(world).get(s.ref),
      lots = what === "walls" ? 0 : CIVIC_LOTS[what as CivicKind],
      effort = effortOf(ctx, s, what as AskRaise),
      hands = handsFor(s.population, what as AskRaise, lots, f?.next ?? 0, "glad"),
      months = effort / hands;
    if (hands < 6) score += move("few", -0.5);
    if (months > 40) score += move("long", -0.5);
    if (s.population > 100_000) score += move("little", 0.4);
  }
  // A ruler's word: it is their ruler's, and their realm's temper with it.
  if (by) {
    score += move("crown", 0.35);
    const realm = politiesOf(world).get(by.realm),
      wars = realm
        ? warsOf(world)
            .fighting(realm.ref)
            .filter((w) => w.ended === null).length
        : 0;
    if (wars > 1) score += move("unrest", -0.35);
  }
  score += (world.rng.real(ASK_DRAW, cell, t, 0, n) - 0.5) * 0.7;
  // (A hive doesn't grudge. Either its hands can be spared or they can't.)
  const answer: AskAnswer =
    form === "hive"
      ? score >= 0.3
        ? "glad"
        : score >= -0.5
          ? "half"
          : "refused"
      : score >= 1.05
        ? "glad"
        : score >= 0.35
          ? "grudged"
          : score >= -0.35
            ? "half"
            : "refused";
  return { answer, why, form };
}

/** Teach a peopled world to be asked. */
export function installAsks(world: World, ctx: () => PopulationContext): AskStore {
  const store = world.register(new AskStore());
  world.addPinner(() => store.pinned());
  world.defineCommand({
    type: "town.ask",
    validate: (args) => {
      const a = args as Partial<AskArgs> | null,
        c = ctx();
      if (typeof a?.village !== "string") return "village must be a town's ref";
      const shut = askShut(c, a.village);
      if (shut) return shut;
      const s = c.settlements.get(a.village)!;
      if (a.by !== undefined) {
        const realm = politiesOf(world).of(s.cell);
        if (!realm || realm.ref !== a.by?.realm) return "it isn't of your realm";
      }
      if (a.kind === "first")
        return typeof a.what === "string" && isFirst(a.what)
          ? firstProblem(c, s, a.what)
          : "a town can put first only what a town can";
      if (a.kind === "raise")
        return typeof a.what === "string" && (a.what === "walls" || isCivic(a.what))
          ? raiseProblem(c, s, a.what as AskRaise)
          : "a town can raise only what a town can";
      return "ask it to put something first, or to raise something";
    },
    apply: (command, t) => {
      const c = ctx(),
        a = command.args as AskArgs,
        s = c.settlements.get(a.village)!,
        n = store.ofTown(s.ref).length,
        total = c.provinces.get(s.cell)?.total() ?? 0,
        share =
          total > 0
            ? Math.max(1, Math.round((1000 * Math.min(s.population, total)) / total))
            : 1000,
        read = answerOf(c, s, a.kind, a.what, t, n, a.by ?? null),
        event = world.events.emit({
          type: ASK_EVENTS.asked.type,
          subjects: [s.ref],
          place: c.provinces.get(s.cell)?.ref ?? null,
          causes: [{ ref: command.id, role: "agent", weight: 1 }],
          data: {
            name: s.name,
            kind: a.kind,
            what: a.what,
            answer: read.answer,
            ...(a.by ? { ruler: a.by.ruler } : {}),
          },
        });
      let work: AskWork | null = null,
        until: number | null = null;
      if (a.kind === "first") {
        // (A new priority takes the place of the one before.)
        for (const old of store.ofTown(s.ref))
          if (
            old.kind === "first" &&
            old.until !== null &&
            old.until > t &&
            read.answer !== "refused"
          )
            old.until = t;
        if (read.answer !== "refused") until = t + ASK_FIRST_YEARS * YEAR;
      } else if (read.answer !== "refused") {
        const f = townsOf(world).get(s.ref)!,
          what = a.what as AskRaise,
          year = yearOfMoment(t),
          builder = new TownBuilder(c, year),
          site = what === "walls" ? builder.askedWalls(f) : builder.askedCivic(f, what),
          hands = handsFor(s.population, what, site.lots, f.next, read.answer);
        work = {
          at: site.at,
          lots: site.lots,
          start: year,
          hands,
          effort: effortOf(c, s, what),
          drain: total > 0 ? Math.min(250, Math.round((1000 * hands) / total)) : 0,
          worked: 0,
          done: null,
          doneEvent: null,
          left: null,
          stops: [],
          food: 0,
          tools: 0,
        };
      }
      store.add({
        n,
        town: s.ref,
        cell: s.cell,
        kind: a.kind,
        what: a.what,
        t,
        event,
        by: a.by ?? null,
        form: read.form,
        answer: read.answer,
        why: read.why,
        share,
        people: s.population,
        until,
        work,
      });
    },
  });
  return store;
}

/** What stops a site this month: the fighting on its land, the ground's shaking, nothing in store to feed its hands. */
function stoppedBy(
  ctx: PopulationContext,
  a: Ask,
  t: SimTime,
): { why: AskStop["why"]; ref: Ref | null } | null {
  const { world } = ctx,
    year = yearOfMoment(t),
    realm = politiesOf(world).of(a.cell);
  if (realm)
    for (const w of warsOf(world).fighting(realm.ref)) {
      if (w.ended !== null && w.ended < year) continue;
      for (let i = w.battles.length - 1; i >= 0; i--) {
        const b = w.battles[i]!;
        if (b.year < year) break;
        if (b.land === a.cell) return { why: "war", ref: b.event };
      }
    }
  const land = ctx.provinces.get(a.cell)?.ref ?? null,
    events = world.events;
  for (let i = events.count - 1; i >= 0 && events.at(i).t > t - 2 * MONTH; i--) {
    const e = events.at(i);
    if (e.type === DISASTER_EVENTS.quake.type && e.place === land)
      return { why: "quake", ref: e.id };
  }
  // (Only a true famine: at a far age a land's stores stand empty at every month's turn, and it eats as it goes.)
  const rec = ctx.history.yearsOf(a.cell).at(-1),
    hungry = !!rec && rec.fed < 600;
  return hungry ? { why: "food", ref: null } : null;
}

/** The month's work on everything a town was asked to raise. */
export function asksMonth(ctx: PopulationContext, t: SimTime): void {
  const store = asksOf(ctx.world);
  if (!store.open.length) return;
  const { world } = ctx;
  for (const a of store.open.slice()) {
    const w = a.work!,
      s = ctx.settlements.get(a.town),
      f = townsOf(world).get(a.town),
      c = w.at >= 0 ? f?.civics.find((x) => x.at === w.at && x.start === w.start) : undefined,
      place = ctx.provinces.get(a.cell)?.ref ?? null,
      leave = (why: "empty" | "fell" | "taken") => {
        const ref = world.events.emit({
          type: ASK_EVENTS.left.type,
          subjects: [a.town],
          place,
          causes: [{ ref: a.event, role: "trigger", weight: 1 }],
          data: { name: s?.name ?? "", what: a.what, why },
        });
        w.left = { t, why, ref };
        const last = w.stops.at(-1);
        if (last && last.to === null) last.to = t;
        store.open.splice(store.open.indexOf(a), 1);
        if (f && c && c.fell === null) new TownBuilder(ctx, yearOfMoment(t)).askedFall(f, c);
      };
    if (!s || !f || s.population <= 0) {
      leave("empty");
      continue;
    }
    if (w.at >= 0 && (!c || c.fell !== null)) {
      leave("fell");
      continue;
    }
    if (a.by && politiesOf(world).of(a.cell)?.ref !== a.by.realm) {
      leave("taken");
      continue;
    }
    const stop = stoppedBy(ctx, a, t),
      last = w.stops.at(-1);
    if (stop) {
      if (last && last.to === null) continue;
      w.stops.push({ from: t, to: null, why: stop.why, ref: stop.ref });
      continue;
    }
    if (last && last.to === null) last.to = t;
    // A month's work: its hands fed from the land's stores over what they would have eaten, their tools worn.
    const m = marketsOf(world).of(a.cell);
    const wear = w.worked % 40 < w.hands ? Math.ceil(w.hands / 40) : 0;
    if (wear) w.tools += m.take("used", G.tools, wear);
    w.worked += w.hands;
    if (w.worked >= w.effort) {
      w.done = t;
      w.doneEvent = world.events.emit({
        type: ASK_EVENTS.raised.type,
        subjects: [a.town],
        place,
        causes: [{ ref: a.event, role: "trigger", weight: 1 }],
        data: {
          name: s.name,
          what: a.what,
          hands: w.hands,
          began: a.t,
          ...(a.by ? { ruler: a.by.ruler } : {}),
        },
      });
      if (a.what === "walls" && f.walls)
        f.walls = { start: f.walls.start, end: yearOfMoment(t), reach: f.walls.reach };
      townsOf(world).fold(a.town, 8, yearOfMoment(t), w.at);
      store.open.splice(store.open.indexOf(a), 1);
    }
  }
}
