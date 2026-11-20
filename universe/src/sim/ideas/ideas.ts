// Schools of thought (rules/ideas.ts; what is kept: ./kept.ts). The same life a faith has (sim/belief/belief.ts), of a thing that
// holds how a people should be ruled:
//   1. founded: one of name in knowledge or in faith, standing a line or more, in a land where a body teaches or some read, under
//      a realm one of whose groups wants it held otherwise than it is. They speak for the group whose wants are furthest from how
//      the realm is held, by its sway (one of faith for the temple, where the temple wants anything): the school's leanings are
//      that gap, and the position that group wants of each law. The chance is theirs to found by their standing and by how far the
//      wants go unmet; the founding cites the one who founded it and what the realm's holding came of;
//   2. spreads: to a neighbouring land, or one its ships reach, of like speech; more by a road, where a body teaches, from a land
//      of higher learning; less where word is watched and where another school is held. A land's taking is kept, not told; a
//      realm's seat taking it is told;
//   3. splits: held in lands of speech far from its seat's, it breaks there, the sooner for one of name in knowledge who teaches
//      it there; the new school keeps half its elder's leanings and takes half from what the breaking land's realm lacks;
//   4. pulls: on its realm's four numbers and its laws, where they are weighed (sim/order/holds.ts, laws.ts read ./kept.ts).
// Yearly work is one pass over the lands that hold a school and their neighbours; nothing is done while none exists but the
// founders' weighing (the living notables of two domains).
import {
  YEAR,
  defineEventType,
  defineStream,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { tongueLikeness, tongueName } from "../../gen/index.ts";
import {
  DOMAIN,
  HOLD_KINDS,
  IDEA,
  IDEA_CALLINGS,
  NOTE,
  ideaApart,
  ideaCreed,
  ideaLeads,
  ideaSpreads,
  ideaUnmet,
  satOf,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { cultureOf } from "../culture/culture.ts";
import { readersOf } from "../lore/letters.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { GROUPS, type Group } from "../polity/interests.ts";
import { orderOf } from "../order/order.ts";
import { LAWS, lawWanted } from "../order/laws.ts";
import { wantsOf } from "../order/wants.ts";
import { higherIn, taughtIn } from "../order/institutions-kept.ts";
import { notablesOf, type Notable } from "../notable/kept.ts";
import { creditNotable } from "../notable/notables.ts";
import { SchoolsStore, schoolRef, schoolsOf, type School } from "./kept.ts";

export const IDEA_EVENTS = {
  /** One of name founded a school of thought. */
  founded: defineEventType("ideas.founded", 5),
  /** A realm's seat took up a school. */
  taken: defineEventType("ideas.taken", 3),
  /** A school broke in two. */
  split: defineEventType("ideas.split", 5),
};

const FOUND = defineStream("ideas.found");
const SPREAD = defineStream("ideas.spread");

/**
 * A school's name: what it presses hard, of a word of its founders' tongue for their place. Of the leanings it presses nearly as
 * hard as its hardest (four fifths of it, each against the most that kind of leaning can be), the one fewest schools are yet
 * called for: a school is known by what sets it apart.
 */
function schoolName(
  world: World,
  store: SchoolsStore,
  creed: readonly number[],
  cell: number,
): string {
  const lead = ideaLeads(creed),
    press = (k: number) => Math.abs(creed[k] ?? 0) / (k < 4 ? IDEA.lean : IDEA.lawLean),
    most = Math.max(...creed.map((_, k) => press(k)));
  let calling = IDEA_CALLINGS[lead.part]![lead.end],
    fewest = Infinity;
  for (let k = 0; k < creed.length; k++) {
    if (!(creed[k] ?? 0) || press(k) < 0.8 * most) continue;
    const name = IDEA_CALLINGS[k]![(creed[k] ?? 0) >= 0 ? 1 : 0];
    let n = 0;
    for (const s of store.all()) if (s.name.startsWith(name)) n++;
    if (n < fewest) {
      fewest = n;
      calling = name;
    }
  }
  const ways = cultureOf(world).get(cell);
  return ways
    ? `${calling} of ${tongueName({ ...ways.tongue, seed: ways.tongue.seed ^ 0x1dea }, cell)}`
    : calling;
}

/** What the group of a realm whose wants go furthest unmet would have a school teach, or null where none wants enough. */
function teachingOf(
  world: World,
  realm: Polity,
  holy: boolean,
): { group: Group; gap: number; sway: number; creed: number[] } | null {
  const o = orderOf(world)?.of(realm.ref),
    wants = wantsOf(world)?.of(realm.ref);
  if (!o?.held || !wants) return null;
  const held = o.held;
  let best: Group | null = null,
    bestScore = 0,
    bestGap = 0;
  for (const g of GROUPS) {
    const w = wants.get(g);
    // (The court is how the realm is held: what it wants is no teaching against it.)
    if (!w || g === "the court") continue;
    let gap = 0;
    for (let k = 0; k < HOLD_KINDS.length; k++) gap += Math.abs(w.want[k]! - held[k]!) / 100;
    // (One of faith speaks for the temple where it wants anything of the realm.)
    const score = gap * (0.25 + w.sway) * (holy && g === "the temple" ? 4 : 1);
    if (gap >= IDEA.unmet && score > bestScore) {
      best = g;
      bestScore = score;
      bestGap = gap;
    }
  }
  if (!best) return null;
  const w = wants.get(best)!;
  return {
    group: best,
    gap: bestGap,
    sway: w.sway,
    creed: ideaCreed(
      w.want.map((x) => x / 100),
      held.map((x) => x / 100),
      LAWS.map((law) => lawWanted(best, law)),
      o.laws,
    ),
  };
}

function found(
  ctx: PopulationContext,
  store: SchoolsStore,
  n: Notable,
  realm: Polity,
  year: number,
  u: number,
  standing: number,
  holy: boolean,
): void {
  const { world } = ctx,
    teaching = teachingOf(world, realm, holy);
  if (!teaching) return;
  const unmet = ideaUnmet(teaching.gap),
    chance = IDEA.found * satOf(standing) * unmet;
  if (!(u < chance) || teaching.creed.every((x) => !x)) return;
  // (What they would teach is what their land already holds, or near it: they teach that, and found nothing.)
  const holds = store.of(n.home),
    heldNow = holds ? store.get(holds.school) : undefined;
  if (heldNow && ideaApart(teaching.creed, heldNow.creed) < IDEA.apart) return;
  const o = orderOf(world)!.of(realm.ref)!,
    lead = ideaLeads(teaching.creed),
    id = store.mint(),
    ref = schoolRef(id),
    name = schoolName(world, store, teaching.creed, n.home),
    // (What the realm's holding of the thing it presses hardest came of, where that was told.)
    stood =
      lead.part < 4 ? (o.heldEvents?.[lead.part] ?? null) : (o.lawEvents[lead.part - 4] ?? null),
    factors: Factor[] = [
      {
        name: `one of name who ${holy ? "speaks for a faith" : "teaches"}: ${n.name}`,
        value: standing / NOTE.line,
        contribution: satOf(standing),
        source: n.event ? { ref: n.event, role: "enabler", weight: 1 } : null,
      },
      {
        name: `what ${teaching.group} want and are not given`,
        value: teaching.gap,
        contribution: unmet,
        source: stood ? { ref: stood, role: "pressure", weight: 1 } : null,
      },
      {
        name: `the sway ${teaching.group} hold`,
        value: teaching.sway,
        contribution: 0.25 * teaching.sway,
        source: null,
      },
    ],
    decision = world.decisions.record({
      rule: "ideas.founded",
      subject: ref,
      outcome: { group: teaching.group },
      score: chance,
      threshold: u,
      factors,
    }),
    causes: CauseRef[] = [{ ref: decision, role: "trigger", weight: 1 }];
  if (n.event) causes.push({ ref: n.event, role: "enabler", weight: 0.6 });
  if (stood) causes.push({ ref: stood, role: "pressure", weight: 0.5 });
  if (o.crisis) causes.push({ ref: o.crisis, role: "pressure", weight: 0.3 });
  const event = world.events.emit({
    type: IDEA_EVENTS.founded.type,
    subjects: [ref, realm.ref],
    place: ctx.provinces.get(n.home)!.ref,
    causes,
    data: { name, by: n.name, group: teaching.group, realm: realmName(realm) },
  });
  store.add({
    id,
    name,
    founded: year,
    event,
    seat: n.home,
    from: null,
    creed: teaching.creed,
    founder: n.id,
    by: n.name,
    speaks: teaching.group,
    realm: realm.ref,
    holy,
  });
  store.set(n.home, { school: id, since: year, via: n.home });
  // (The founding is their deed: a line's fifth, less the higher they stand.)
  creditNotable(world, n.id, {
    y: year,
    d: holy ? DOMAIN.faith : DOMAIN.knowledge,
    w: IDEA_EVENTS.founded.type,
    e: event,
    g: Math.round(NOTE.line / 5),
    n: name,
  });
}

/** The year's schools: founded, spread, split. */
export function ideasYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    store = schoolsOf(world),
    notables = notablesOf(world);
  if (!store || !notables || !world.hasStore("polity.states")) return;
  const year = yearOfMoment(t),
    polities = politiesOf(world),
    culture = cultureOf(world);

  // 1. Founders.
  const line = IDEA.founder * NOTE.line;
  for (const n of notables.all()) {
    const k = n.by[DOMAIN.knowledge] ?? 0,
      f = n.by[DOMAIN.faith] ?? 0,
      standing = Math.max(k, f);
    if (standing < line || store.founded(n.id)) continue;
    const u = world.rng.real(FOUND, n.id, t, 0);
    if (!(u < IDEA.found * satOf(standing))) continue;
    const now = store.of(n.home);
    if (now && year - now.since < IDEA.fresh) continue;
    if (!ctx.provinces.get(n.home)?.total()) continue;
    if (!taughtIn(world, n.home) && !(readersOf(world, n.home) > 0)) continue;
    const realm = polities.of(n.home);
    if (!realm || realm.ended !== null) continue;
    found(ctx, store, n, realm, year, u, standing, f > k);
  }
  if (!store.holding) return;

  // 2. Spread: planned from the year's opening, then made.
  const markets = world.store<MarketStore>("economy.markets"),
    order = orderOf(world),
    takes: { cell: number; school: number; via: number }[] = [];
  for (const p of ctx.provinces.all()) {
    const mine = store.of(p.cell);
    if (!p.total()) {
      if (mine) store.set(p.cell, null);
      continue;
    }
    // (Each land is weighed in its own year of IDEA.every, at as many years' chance: a third of the lands a year.)
    if ((year + p.cell) % IDEA.every !== 0) continue;
    if (mine && mine.since === year) continue;
    let best = -1,
      bestVia = -1,
      bestChance = 0;
    const weigh = (n: number, road: boolean): void => {
      const theirs = store.of(n);
      if (!theirs || theirs.since === year || theirs.school === mine?.school) return;
      const a = culture.get(p.cell),
        b = culture.get(n);
      if (!a || !b) return;
      const realm = polities.of(p.cell),
        held = realm ? order?.of(realm.ref)?.held : undefined,
        chance = ideaSpreads(
          tongueLikeness(a.tongue, b.tongue),
          road,
          taughtIn(world, p.cell),
          higherIn(world, n),
          held ? held[2]! / 100 : 0.5,
          !!mine,
        );
      if (chance > bestChance || (chance === bestChance && theirs.school < best)) {
        best = theirs.school;
        bestVia = n;
        bestChance = chance;
      }
    };
    for (let k = g.grid.offsets[p.cell]!; k < g.grid.offsets[p.cell + 1]!; k++) {
      const n = g.grid.neighbours[k]!;
      if (store.of(n)) weigh(n, !!markets.route(p.cell, n));
    }
    for (const n of markets.seaPartners(p.cell)) if (store.of(n)) weigh(n, true);
    if (best >= 0 && world.rng.real(SPREAD, p.cell, t, 0) < IDEA.every * bestChance)
      takes.push({ cell: p.cell, school: best, via: bestVia });
  }
  for (const x of takes) {
    // (Told where a realm's seat takes up its first school: a seat's turning from one to another is kept, not told.)
    const before = store.of(x.cell);
    store.set(x.cell, { school: x.school, since: year, via: x.via });
    const realm = polities.of(x.cell);
    if (before || !realm || realm.seat !== x.cell || realm.ended !== null) continue;
    const s = store.get(x.school)!,
      road = markets.route(x.cell, x.via);
    world.events.emit({
      type: IDEA_EVENTS.taken.type,
      subjects: [schoolRef(s.id), realm.ref],
      place: ctx.provinces.get(x.cell)!.ref,
      causes: [
        { ref: s.event, role: "trigger", weight: 0.6 },
        ...(road ? [{ ref: road, role: "enabler" as const, weight: 0.4 }] : []),
      ],
      data: { name: s.name, realm: realmName(realm), via: x.via },
    });
  }

  // 3. Splits: a school held far from its seat by people of other speech breaks there.
  if (year % 10 === 0) {
    const far = new Map<number, number[]>();
    for (const p of ctx.provinces.all()) {
      const h = store.of(p.cell);
      if (!h || store.landsOf(h.school) < IDEA.ledLands + 1) continue;
      const s = store.get(h.school)!,
        seat = culture.get(s.seat),
        here = culture.get(p.cell);
      if (!seat || !here || tongueLikeness(here.tongue, seat.tongue) >= IDEA.far) continue;
      const l = far.get(s.id);
      if (l) l.push(p.cell);
      else far.set(s.id, [p.cell]);
    }
    for (const s of [...store.all()]) {
      const lands = far.get(s.id);
      if (!lands || lands.length < IDEA.ledLands) continue;
      const since = year - store.lastSplit(s.id);
      // (One of name in knowledge who teaches there leads it out sooner, from their own land.)
      let leader: Notable | undefined;
      if (since >= IDEA.ledYears)
        for (const c of lands)
          for (const n of notables.in(c)) {
            const k = n.by[DOMAIN.knowledge] ?? 0;
            if (k < IDEA.leader * NOTE.line || store.founded(n.id)) continue;
            if (!leader || k > (leader.by[DOMAIN.knowledge] ?? 0)) leader = n;
          }
      if (!leader && (lands.length < IDEA.splitLands || since < IDEA.splitYears)) continue;
      const first = leader?.home ?? lands[0]!,
        realm = polities.of(first),
        teaching = realm && realm.ended === null ? teachingOf(world, realm, false) : null,
        // (Half its elder's leanings, half what the breaking land's realm lacks; its elder's alone where no group there wants.)
        creed = s.creed.map((v, k) =>
          teaching ? Math.round((v + teaching.creed[k]!) / 2) : Math.round(v * 0.8),
        );
      // (A breaking that would teach all but what its elder does is no breaking.)
      if (ideaApart(creed, s.creed) < IDEA.apart) continue;
      const id = store.mint(),
        name = schoolName(world, store, creed, first);
      store.markSplit(s.id, year);
      const event = world.events.emit({
        type: IDEA_EVENTS.split.type,
        subjects: [schoolRef(id), schoolRef(s.id)],
        place: ctx.provinces.get(first)!.ref,
        causes: [
          { ref: s.event, role: "enabler", weight: 1 },
          ...(leader?.event ? [{ ref: leader.event, role: "trigger" as const, weight: 0.6 }] : []),
        ],
        data: { name, from: s.name, ...(leader ? { by: leader.name } : {}) },
      });
      const made: School = {
        id,
        name,
        founded: year,
        event,
        seat: first,
        from: s.id,
        creed,
        founder: leader?.id ?? 0,
        by: leader?.name ?? "",
        speaks: teaching?.group ?? s.speaks,
        realm: realm?.ref ?? null,
        holy: s.holy,
      };
      store.add(made);
      for (const c of lands) store.set(c, { school: id, since: year, via: first });
      if (leader)
        creditNotable(world, leader.id, {
          y: year,
          d: DOMAIN.knowledge,
          w: IDEA_EVENTS.split.type,
          e: event,
          g: Math.round(NOTE.line / 5),
          n: name,
        });
    }
    store.forget();
  }
}

/** Teach a peopled world its schools of thought. */
export function installIdeas(world: World, ctx: () => PopulationContext): SchoolsStore {
  const store = world.register(new SchoolsStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "198.ideas.year", every: YEAR, run: (t) => ideasYear(ctx(), t) });
  return store;
}
