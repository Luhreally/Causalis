// A town run by its own head (town mode; asked 2026-11-25: "an auto management ... mode"). Its head is one of its own
// people: a key figure of its realm who lives in it where there is one (its ruler, an heir, a keeper: host/leaders.ts),
// else the eldest of those who lead in it, else its eldest grown. Each hour of its clock the head looks the town over by
// the very readings its sheets show and decides on orders: the same commands a player gives (sim/town/managed.ts),
// handed to the page to give by the path its own orders take (app/townplace.ts), so they reach the world by the one
// ruled way and nothing is counted twice. Each follows from a force that can be stated, and is told in the town's log
// under the head's name with that force and its number.
//
// What moves the head, and by what measure (nothing here is a table of the head's own):
//   What threatens. A town may be held to an answer its world's peoples come to by loss (rules/lessons.ts: a fire
//     watch, the sick kept apart, grain put by). Its land keeps what each cause has cost it, faded with the years
//     (sim/lore), and the world's own rule says how readily a people so pressed takes an answer up, against what the
//     answer asks of them (takeUpChance). The head takes it up as their land's people would, by that rule: the press
//     weighed by their own temper (host/place.ts placeTemper: one who bears hardship boldly is pressed less by fire and
//     sickness; one who sets store by plenty, more by hunger), against a draw that is the head's own for that answer,
//     the same on every day. So the order is kept while the loss is fresh enough to press this head, and let go when
//     it has faded.
//   A siege. While one lies about the town no one goes out to its fields (host/place.ts), so standing to arms takes no
//     hand from them: the head calls the town to arms for as long as the siege lies, and stands it down when it lifts.
//   Those without a roof. Where a household lives in the square and no building is opened to them, the head opens the
//     one the fewest work at.
//   What is going up. A crew at a site all its working day raises it sooner than the town's month does (the month
//     counts a third of its people's time as work: WORK_SHARE), and eats half again as much. So the head takes a site in
//     hand while its land's food meets all its needs and no one in the town has gone a day in want, and gives it back
//     when its land runs short. The crew is of the hands the town's own answer to the asking spares (siteMostHands),
//     all of them under a head who sets no store by plenty, down to half under one who does, never fewer than its
//     month puts to it.
//   Idle hands. Whoever stands at their work with nothing to work is told what to turn to when that happens: their own
//     trade still first, so no one changes trade and its land is told nothing; then the two other trades a year of which
//     is worth most in their land now (its wages, as the world reckons them); and building, where a site is in hand.
// The head holds no food back and forbids no good. In a place a mouth eats what its land's reckoning counts it to eat,
// no more in plenty, so food held back only moves a hunger earlier; and what the market will not let go, its own
// makers at home cannot have either. No force a town knows of speaks for either order, so none is given.
//
// The player may overrule any of it. The head remembers what it ordered (`did`); where the town's orders no longer say
// what the head set once it was given, someone else has spoken, and the head leaves that matter alone from then on
// (`let`) for as long as it stewards, and says so. Choosing the steward anew gives everything back to it.
//
// Its memory is kept with the place (host/place.ts Place.steward), in the save and out of the world's hash; its one draw
// is keyed on the place's own stream. Nothing of it runs in a town run by hand or watched.
import { DAY, HOUR, YEAR, type World } from "../kernel/index.ts";
import { LESSON_RESPONSE, OCC, takeUpChance } from "../rules/index.ts";
import {
  MANAGED_TRADES,
  PRIO_FIRE_OWN,
  PRIO_KINDS,
  lessonsOf,
  lifeOf,
  populationContext,
  pressIn,
} from "../sim/index.ts";
import type { StewardOrder } from "../bridge/index.ts";
import {
  ACT,
  HAP,
  PLACE_HOOKS,
  WHY,
  leans,
  ordersOf,
  placeNote,
  placePrio,
  placeSites,
  placeTemper,
  stewardDraw,
  type Place,
  type PlaceHap,
  type Steward,
} from "./place.ts";
import { lotWords, placeWho, siteOf } from "./placeplan.ts";

/** What the head decides on: said in its log's line by its number. */
export const DECIDED = {
  keep: 1,
  letGo: 2,
  arms: 3,
  standDown: 4,
  shelter: 5,
  site: 6,
  giveBack: 7,
  idle: 8,
  yielded: 9,
  taken: 10,
} as const;
/** The answers a head can hold its town to, with the cause each answers and what the order is called. */
const ANSWERS = [
  { what: "firebreaks", cause: "fire", name: "a fire watch", of: "fire" },
  { what: "quarantine", cause: "sickness", name: "the sick kept apart", of: "sickness" },
  { what: "granaries", cause: "famine", name: "grain put by", of: "hunger" },
] as const;
/** A day or more in want (ticks of lack, host/place.ts: a tick is ten minutes). */
const IN_WANT = DAY / 600;
/** An order handed over and not yet standing in the town's orders a day after: given up, and decided afresh. */
const GIVEN_UP = DAY;
/** The matters the head speaks of, said in a few words, for the line that says it leaves one to the player. */
const MATTER_WORDS: Record<string, string> = {
  respond: "what the town is held to",
  shelter: "the building opened to the homeless",
  site: "a site",
  prio: "one of the town's work",
};

/** The town's head: one of its realm's key figures living in it; else the eldest who leads in it; else its eldest grown. */
export function stewardHead(
  world: World,
  place: Place,
): { i: number; id: number; name: string; ref: string } | null {
  const p = place.people,
    grown = lifeOf(world).adulthood;
  let best = -1,
    rank = -1;
  for (let i = 0; i < p.n; i++) {
    const occ = p.sexOcc[i]! & 15;
    if (occ === OCC.dependent || (place.t / DAY - p.born[i]!) / 365 < grown) continue;
    const r = place.figId.includes(p.id[i]!) ? 2 : occ === OCC.leader ? 1 : 0;
    if (
      best < 0 ||
      r > rank ||
      (r === rank &&
        (p.born[i]! < p.born[best]! || (p.born[i] === p.born[best] && p.id[i]! < p.id[best]!)))
    ) {
      best = i;
      rank = r;
    }
  }
  return best < 0 ? null : { i: best, id: p.id[best]!, ...placeWho(world, place)(best) };
}

/** A head's temper in two words, as far as it bears on what they order. */
export function temperWords(place: Place, i: number): string {
  const t = placeTemper(place, i);
  return `${t.bold >= 0.5 ? "bold" : "cautious"}, ${t.thrifty >= 0.5 ? "thrifty" : "open-handed"}`;
}

/** How hard what a cause has cost the town's land presses its head (0 … 1): the land's own memory, weighed by their temper. */
export function stewardPress(world: World, place: Place, head: number, cause: string): number {
  const land = populationContext(world).provinces.get(place.cell)?.ref,
    press = land ? pressIn(lessonsOf(world)?.get(land), cause, Math.floor(place.t / YEAR)) : 0,
    t = placeTemper(place, head);
  return Math.min(1, press * leans(cause === "famine" ? t.thrifty : 1 - t.bold));
}

/**
 * The head given the town (`on`), its memory begun afresh; or the town taken from them, their memory let go with what
 * they had yet to give (the orders they gave stand, as a player's do, until another is given).
 */
export function stewardTaken(world: World, place: Place, on: boolean): void {
  if (!on) {
    delete place.steward;
    return;
  }
  place.steward = { n: 0, did: {}, let: [], orders: [] };
  const head = stewardHead(world, place);
  if (head) placeNote(place, HAP.steward, head.id, DECIDED.taken);
  stewardLooks(world, place);
}

/**
 * The head looks the town over and decides: on every hour of its clock while it stewards (host/place.ts advancePlace),
 * and once when it is given the town. What it decides waits in its memory, numbered, to be given by the page.
 */
export function stewardLooks(world: World, place: Place): void {
  const s = place.steward,
    head = stewardHead(world, place);
  if (!s || !head) return;
  const p = place.people,
    orders = ordersOf(world, place.town),
    sites = placeSites(world, place);
  /** What the town's orders say of a matter now, as the head would set it. */
  const stands = (key: string): string => {
      const [kind, of] = key.split(":");
      if (kind === "respond") return orders?.held.includes(of as never) ? "1" : "0";
      if (kind === "shelter") return String(orders?.shelter ?? -1);
      if (kind === "site") {
        const x = sites.find((q) => q.n === Number(of));
        return x?.inHand ? String(x.hands) : "0";
      }
      if (kind === "prio") return (placePrio(world, place, Number(of)) ?? []).join("");
      return "";
    },
    /** Whether a matter is still there to speak of (a site going up, one of its people living). */
    there = (key: string): boolean => {
      const [kind, of] = key.split(":");
      if (kind === "site") return sites.some((q) => q.n === Number(of));
      if (kind === "prio") return (living ??= new Set(p.id.subarray(0, p.n))).has(Number(of));
      return true;
    };
  let living: Set<number> | null = null;
  // What was handed over and stands now is given; what has waited a day is given up (it could not be taken).
  s.orders = s.orders.filter((o) => {
    if (stands(o.key) === s.did[o.key]) return false;
    if (place.t - o.t < GIVEN_UP) return true;
    delete s.did[o.key];
    return false;
  });
  const waiting = new Set(s.orders.map((o) => o.key));
  // What no longer stands as the head set it, once given, has been spoken for by another: left alone from now on.
  for (const key of Object.keys(s.did)) {
    if (waiting.has(key)) continue;
    if (!there(key)) delete s.did[key];
    else if (stands(key) !== s.did[key]) {
      delete s.did[key];
      if (!s.let.includes(key)) {
        s.let.push(key);
        say(DECIDED.yielded, Object.keys(MATTER_WORDS).indexOf(key.split(":")[0]!));
      }
    }
  }
  function say(what: number, a = 0, b = 0): void {
    placeNote(place, HAP.steward, head!.id, what + 256 * a, b);
  }
  const free = (key: string) => !s.let.includes(key) && !waiting.has(key),
    give = (key: string, type: string, args: Record<string, unknown>, set: string, why: string) => {
      s.orders.push({ n: ++s.n, t: place.t, type, args, key, why });
      s.did[key] = set;
    },
    temper = placeTemper(place, head.i);

  // What threatens: an answer kept while what its cause has cost the land presses this head past their own draw.
  ANSWERS.forEach((x, k) => {
    const key = `respond:${x.what}`,
      r = LESSON_RESPONSE.get(x.what);
    if (!r || !free(key)) return;
    const press = stewardPress(world, place, head.i, x.cause),
      keeps = takeUpChance(press, r.asks) > stewardDraw(world, place, head.id, k),
      on = stands(key) === "1";
    if (keeps && !on) {
      say(DECIDED.keep, k, Math.round(press * 100));
      give(key, "place.respond", { what: x.what, on: true }, "1", `${x.of} presses its head`);
    } else if (!keeps && on && s.did[key] === "1") {
      say(DECIDED.letGo, k, Math.round(press * 100));
      give(key, "place.respond", { what: x.what, on: false }, "0", `${x.of} presses no longer`);
    }
  });
  // A siege: to arms while it lies, no hand being taken from fields no one can go out to.
  if (free("respond:muster")) {
    const on = stands("respond:muster") === "1",
      sieged = !!place.matched.sieged;
    if (sieged && !on) {
      say(DECIDED.arms);
      give("respond:muster", "place.respond", { what: "muster", on: true }, "1", "a siege");
    } else if (!sieged && on && s.did["respond:muster"] === "1") {
      say(DECIDED.standDown);
      give(
        "respond:muster",
        "place.respond",
        { what: "muster", on: false },
        "0",
        "the siege lifted",
      );
    }
  }
  // Those without a roof, and who works where.
  const h = place.houses,
    grown = lifeOf(world).adulthood,
    working = new Map<number, number>(),
    idle: number[] = [];
  let roofless = 0,
    inWant = 0;
  for (let k = 0; k < h.n; k++)
    if (h.members[k]! > 0 && h.lost[k]! >= 0 && h.home[k]! < 0) roofless += h.members[k]!;
  for (let i = 0; i < p.n; i++) {
    if (p.lack[i]! >= IN_WANT) inWant++;
    working.set(p.work[i]!, (working.get(p.work[i]!) ?? 0) + 1);
    if (
      p.act[i] === ACT.wait &&
      p.why[i] === WHY.noStuff &&
      (MANAGED_TRADES as readonly number[]).includes(p.sexOcc[i]! & 15) &&
      (place.t / DAY - p.born[i]!) / 365 >= grown
    )
      idle.push(i);
  }
  if (roofless > 0 && free("shelter") && (orders?.shelter ?? -1) < 0) {
    let best = -1;
    for (let b = 1; b < place.bldgs.lot.length; b++) {
      if (place.bldgs.site[b] || place.bldgs.lot[b]! < 0) continue;
      const n = working.get(place.bldgs.lot[b]!) ?? 0;
      if (best < 0 || n < (working.get(place.bldgs.lot[best]!) ?? 0)) best = b;
    }
    if (best > 0) {
      const lot = place.bldgs.lot[best]!;
      say(DECIDED.shelter, Math.min(roofless, 60_000), lot);
      give("shelter", "place.shelter", { lot }, String(lot), `${roofless} without a roof`);
    }
  }
  // What is going up: in hand while its land is fed and no one is in want, given back when its land runs short.
  const fedNow = place.matched.fedNow ?? 1000,
    fed = fedNow >= 1000;
  let inHand = false;
  for (const x of sites) {
    const key = `site:${x.n}`;
    if (x.inHand) inHand = true;
    if (!free(key) || x.raised || x.stopped || x.most < 1) continue;
    if (!x.inHand && fed && inWant === 0) {
      const hands = Math.max(
        Math.min(x.most, Math.max(1, x.hands)),
        Math.min(x.most, Math.round(x.most * Math.min(1, leans(1 - temper.thrifty)))),
      );
      say(DECIDED.site, hands, x.lot);
      give(key, "place.site", { ask: x.n, hands }, String(hands), "its land is fed");
      inHand = true;
    } else if (x.inHand && !fed && s.did[key] !== undefined) {
      say(DECIDED.giveBack, Math.round(fedNow / 10), x.lot);
      give(key, "place.site", { ask: x.n, hands: null }, "0", "its land runs short");
    }
  }
  // Idle hands: what each who stands with nothing to work turns to, by what a year of each trade is worth there now.
  const ranked = MANAGED_TRADES.map((occ, k) => ({ k, occ, wage: place.matched.wage[occ] ?? 0 }));
  let told = 0,
    first = -1;
  for (const i of idle) {
    const id = p.id[i]!,
      key = `prio:${id}`,
      own = p.sexOcc[i]! & 15;
    if (!free(key) || placePrio(world, place, id)) continue;
    const rest = ranked
      .filter((x) => x.occ !== own && x.wage > 0)
      .sort((a, b) => b.wage - a.wage || a.k - b.k);
    if (!rest.length) continue;
    const kinds: number[] = PRIO_KINDS.map((k) => (k === "fire" ? PRIO_FIRE_OWN : 0));
    kinds[(MANAGED_TRADES as readonly number[]).indexOf(own)] = 3;
    rest.slice(0, 2).forEach((x, n) => (kinds[x.k] = 2 - n));
    if (inHand) kinds[PRIO_KINDS.indexOf("building")] = 2;
    if (first < 0) first = rest[0]!.occ;
    give(key, "place.prio", { person: id, kinds }, kinds.join(""), "idle for want of stuff");
    told++;
  }
  if (told) say(DECIDED.idle, Math.min(told, 60_000), first);
}

/**
 * The orders its head has decided on that have yet to be handed to the page, after the one numbered `after` (the last
 * the page gave): each handed over once, and kept until it is seen standing in the town's orders (or given up a day on).
 */
export function stewardOrders(place: Place, after = 0): StewardOrder[] {
  const s = place.steward;
  if (!s) return [];
  const from = Math.max(after, s.handed ?? 0),
    out = s.orders
      .filter((o) => o.n > from)
      .map(({ type, args, key, why, n }) => ({ type, args, key, why, n }));
  if (out.length) s.handed = out.at(-1)!.n;
  return out;
}

/** Whether a matter stands as the head set it (host/place.ts: "by its head's order" where it does). */
export function headsMatter(place: Place, key: string): boolean {
  const s = place.steward;
  return !!s && place.mode === 2 && s.did[key] !== undefined && !s.let.includes(key);
}

const TURN_WORDS: Record<number, string> = {
  [OCC.farmer]: "the fields",
  [OCC.herder]: "the herds",
  [OCC.crafter]: "a craft",
  [OCC.trader]: "hauling",
};

/** What the head decided, said for the town's log: the order, and the force it was given for. */
export function stewardTold(place: Place, x: PlaceHap): string {
  const what = x.a & 255,
    a = Math.floor(x.a / 256),
    answer = ANSWERS[a],
    lot = () => siteOf(lotWords(place, x.b));
  switch (what) {
    case DECIDED.taken:
      return "took the running of the town in hand, as its head";
    case DECIDED.keep:
      return `ordered ${answer?.name ?? "an answer"} kept, as the town's head: what ${answer?.of ?? "it"} has cost its land presses them ${x.b} in a hundred, enough for what it takes from the fields`;
    case DECIDED.letGo:
      return `let the order for ${answer?.name ?? "an answer"} go, as the town's head: what ${answer?.of ?? "it"} has cost its land presses them ${x.b} in a hundred now, too little for what it takes from the fields`;
    case DECIDED.arms:
      return "called the town to arms, as its head: a siege lies about it, and no hand can go out to its fields";
    case DECIDED.standDown:
      return "stood the town down from arms, as its head: the siege is lifted";
    case DECIDED.shelter:
      return `opened ${lot()} to those without a home, as the town's head: ${a === 1 ? "one of the town had" : `${a} of the town had`} no roof, and the fewest work there`;
    case DECIDED.site:
      return `took ${lot()} in hand with a crew of ${a}, as the town's head: its land's food meets its needs, no one is in want, and a crew at it all day raises it sooner than the town's month`;
    case DECIDED.giveBack:
      return `gave ${lot()} back to the town's month, as its head: its land's food meets ${a} in a hundred of its needs, and a crew eats half again as much`;
    case DECIDED.idle:
      return `told ${a === 1 ? "one who" : `${a} who`} stood at their work with nothing to work what to turn to when that happens, as the town's head: their own work first, then ${TURN_WORDS[x.b] ?? "other work"}, where a year's work is worth most now`;
    case DECIDED.yielded:
      return `leaves ${Object.values(MATTER_WORDS)[a] ?? "a matter"} to you from now on, as the town's head: you gave another order for it`;
    default:
      return "gave an order, as the town's head";
  }
}

PLACE_HOOKS.look = (world, place) => {
  if (place.t % HOUR === 0) stewardLooks(world, place);
};
PLACE_HOOKS.told = stewardTold;
PLACE_HOOKS.heads = headsMatter;
