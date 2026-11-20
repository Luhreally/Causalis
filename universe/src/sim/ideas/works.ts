// Works (rules/ideas.ts WORK; what is kept: ./works-kept.ts). A work is made by one of name (a maker, one of the learned, one who
// speaks for a faith), for a patron of their land who can keep such a one (the realm's seat where the land is its seat, a great
// house seated there, a body there that teaches, worships or carries word), of the thing of late most worth remembering there:
//   1. the year's events are read once (the log since the last read, by its serial) for what each land has most worth
//      remembering: an event of the chronicle's weight in that land, the weightier and the later kept, one a land;
//   2. each of name who could make a work is weighed: the chance is theirs by their standing; there must be something to
//      remember no work of their land has yet been made of, and a patron. Its form is what its people can do (told, raised,
//      written, sent); its renown comes of its maker's standing and the weight of what it remembers;
//   3. a land keeps WORK.keepLand: a new work past that displaces the least renowned, or is not made if it would be the least.
// What a work does flows back through ./works-kept.ts: the memory it carries fades the slower in its realm (sim/order), its
// land's renown is the greater for it (sim/culture/art.ts), and its patron is credited (a seat in its standing, here; a house in
// its power, sim/order/houses.ts; a body in how well it is held to be run, at the making).
import {
  YEAR,
  defineEventType,
  defineStream,
  kindCodeOf,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { tongueName } from "../../gen/index.ts";
import {
  DOES,
  DOMAIN,
  NOTE,
  WORK,
  WORK_FORMS,
  satOf,
  workForm,
  workRenown,
  workRenownNow,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { cultureOf } from "../culture/culture.ts";
import { loreOf } from "../lore/lore.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { addsStanding, orderOf } from "../order/order.ts";
import { housesOf } from "../order/houses.ts";
import { bodiesOf } from "../order/institutions-kept.ts";
import { notablesOf, type Notable } from "../notable/kept.ts";
import { creditNotable } from "../notable/notables.ts";
import { WorksStore, patronCredit, worksOf, type Patron } from "./works-kept.ts";

export const WORK_EVENTS = {
  /** One of name made a work for a patron. */
  made: defineEventType("ideas.work", 3),
};

const MAKE = defineStream("ideas.work");

const serialOf = (ref: Ref): number => Number(ref.slice(ref.lastIndexOf(":") + 1));

/** Who in a land could keep one who makes a work, each with a weight, and the event each stands by. */
function patronsIn(
  world: World,
  realm: Polity | undefined,
  cell: number,
): { patron: Patron; weight: number; event: Ref | null; body?: { quality: number } }[] {
  const out: { patron: Patron; weight: number; event: Ref | null; body?: { quality: number } }[] =
    [];
  if (!realm || realm.ended !== null) return out;
  if (realm.seat === cell)
    out.push({
      patron: { kind: "seat", ref: realm.ref, name: realmName(realm), realm: realm.ref },
      weight: 1,
      event: realm.ruler.event,
    });
  for (const h of housesOf(world)?.of(realm.ref)?.houses ?? [])
    if (h.seat === cell && !h.crown)
      out.push({
        patron: { kind: "house", ref: h.event, name: h.name, realm: realm.ref },
        weight: 0.5 + (2 * h.power) / 1000,
        event: h.event,
      });
  let best: (typeof out)[number] | null = null;
  for (const b of bodiesOf(world)?.of(realm.ref)?.bodies ?? []) {
    if (b.home !== cell) continue;
    if (b.does !== DOES.teach && b.does !== DOES.worship && b.does !== DOES.word) continue;
    const weight = 0.5 + b.quality / 2000;
    if (!best || weight > best.weight)
      best = {
        patron: { kind: "body", ref: b.event, name: b.name, realm: realm.ref },
        weight,
        event: b.event,
        body: b,
      };
  }
  if (best) out.push(best);
  return out;
}

/** The year's works. */
export function worksYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = worksOf(world),
    notables = notablesOf(world);
  if (!store || !notables) return;
  const year = yearOfMoment(t),
    events = world.events;

  // 1. What each land has most worth remembering, from the year's events.
  // (The year since the last reading, by the events' own moments: one told at the very moment of the last reading is read
  // again, and is known for the one a land already keeps.)
  const since = t - YEAR;
  for (let i = events.count - 1; i >= 0; i--) {
    const e = events.at(i);
    if (e.t < since) break;
    if (e.importance < WORK.worth || !e.place || kindCodeOf(e.place) !== "cell") continue;
    const type = e.type;
    if (type.startsWith("ideas.") || type.startsWith("notable.")) continue;
    const cell = serialOf(e.place),
      now = store.worthIn(cell);
    if (now && !now.used && year - now.y <= WORK.back && now.w > e.importance) continue;
    if (now && now.e === e.id) continue;
    store.setWorth(cell, { e: e.id, type, w: e.importance, y: year, used: false });
  }
  store.seen = year;

  // 2. Makers.
  const line = WORK.maker * NOTE.line,
    lore = loreOf(world),
    polities = world.hasStore("polity.states") ? politiesOf(world) : null,
    culture = cultureOf(world);
  for (const n of notables.all()) {
    const m = n.by[DOMAIN.making] ?? 0,
      k = n.by[DOMAIN.knowledge] ?? 0,
      f = n.by[DOMAIN.faith] ?? 0,
      standing = Math.max(m, k, f);
    if (standing < line) continue;
    const u = world.rng.real(MAKE, n.id, t, 0);
    if (!(u < WORK.made * satOf(standing))) continue;
    if (!ctx.provinces.get(n.home)?.total()) continue;
    const realm = polities?.of(n.home),
      // (What its realm itself remembers of this land, or of any of its lands for one at its seat (a rising, a massacre, those
      // carried off, a freedom won: sim/order), comes before what the land has otherwise worth remembering: a people makes
      // its works first of what it cannot forget. The heaviest no work yet carries.)
      held = realm ? orderOf(world)?.of(realm.ref)?.memory : undefined;
    let worth = store.worthIn(n.home);
    if (worth && (worth.used || year - worth.y > WORK.back)) worth = undefined;
    if (held)
      for (const mem of held) {
        if (year - mem.year > WORK.back || store.carries(mem.event)) continue;
        if (mem.cell !== n.home && realm!.seat !== n.home) continue;
        worth = {
          e: mem.event,
          type: `memory.${mem.what}`,
          w: WORK.worth + 1,
          y: mem.year,
          used: false,
        };
        break;
      }
    if (!worth) continue;
    const patrons = patronsIn(world, realm, n.home);
    if (!patrons.length) continue;
    make(ctx, store, n, standing, m >= k && m >= f, worth, patrons, realm!, year, t);
  }

  // 3. A world's bound, and lands emptied, once in ten years.
  if (year % 10 === 0) {
    const lost = new Set<number>();
    for (const w of store.all()) if (!ctx.provinces.get(w.land)?.total()) lost.add(w.id);
    const over = store.all().length - lost.size - WORK.keepWorld;
    if (over > 0)
      for (const w of [...store.all()]
        .filter((w) => !lost.has(w.id))
        .sort(
          (a, b) =>
            workRenownNow(a.renown, year - a.year) - workRenownNow(b.renown, year - b.year) ||
            a.id - b.id,
        )
        .slice(0, over))
        lost.add(w.id);
    store.lose(lost);
  }
  store.fold(year);

  function make(
    ctx: PopulationContext,
    store: WorksStore,
    n: Notable,
    standing: number,
    maker: boolean,
    worth: NonNullable<ReturnType<WorksStore["worthIn"]>>,
    patrons: ReturnType<typeof patronsIn>,
    realm: Polity,
    year: number,
    t: SimTime,
  ): void {
    const renown = workRenown(standing, worth.w),
      here = store.in(n.home);
    // (A land keeps so many: a new one displaces the least renowned, or is not made.)
    let least: (typeof here)[number] | null = null;
    if (here.length >= WORK.keepLand) {
      for (const w of here)
        if (
          !least ||
          workRenownNow(w.renown, year - w.year) < workRenownNow(least.renown, year - least.year)
        )
          least = w;
      if (least && workRenownNow(least.renown, year - least.year) >= renown) return;
    }
    let total = 0;
    for (const p of patrons) total += p.weight;
    let pick = world.rng.real(MAKE, n.id, t, 1) * total,
      chosen = patrons[patrons.length - 1]!;
    for (const p of patrons) {
      pick -= p.weight;
      if (pick < 0) {
        chosen = p;
        break;
      }
    }
    const ways = culture.get(n.home),
      id = store.mint(),
      title = ways
        ? tongueName({ ...ways.tongue, seed: ways.tongue.seed ^ 0x90e7 }, id)
        : `Work ${id}`,
      form = WORK_FORMS.indexOf(
        workForm(
          lore.effect(n.home, "writing"),
          lore.effect(n.home, "building"),
          lore.effect(n.home, "signal"),
          maker,
        ),
      ),
      causes: CauseRef[] = [{ ref: worth.e, role: "trigger", weight: 1 }];
    if (n.event) causes.push({ ref: n.event, role: "enabler", weight: 0.6 });
    if (chosen.event && chosen.event !== worth.e && chosen.event !== n.event)
      causes.push({ ref: chosen.event, role: "enabler", weight: 0.4 });
    const event = world.events.emit({
      type: WORK_EVENTS.made.type,
      // (A work of great renown is the chronicle's.)
      ...(renown >= 3 * NOTE.line ? { importance: 5 } : {}),
      subjects: [realm.ref],
      place: ctx.provinces.get(n.home)!.ref,
      causes,
      data: {
        id,
        title,
        by: n.name,
        form: WORK_FORMS[form],
        patron: chosen.patron.name,
        kind: chosen.patron.kind,
        theme: worth.type,
        of: worth.y,
      },
    });
    if (least) store.lose(new Set([least.id]));
    store.add({
      id,
      title,
      form,
      year,
      land: n.home,
      maker: n.id,
      by: n.name,
      patron: chosen.patron,
      of: worth.e,
      theme: worth.type,
      ofYear: worth.y,
      renown,
      event,
    });
    worth.used = true;
    // (A body that kept the maker is held the better run for it.)
    if (chosen.body) chosen.body.quality = Math.min(1000, chosen.body.quality + WORK.bodyQuality);
    creditNotable(world, n.id, {
      y: year,
      d: maker
        ? DOMAIN.making
        : (n.by[DOMAIN.faith] ?? 0) > (n.by[DOMAIN.knowledge] ?? 0)
          ? DOMAIN.faith
          : DOMAIN.knowledge,
      w: WORK_EVENTS.made.type,
      e: event,
      g: Math.round(NOTE.line / 10),
      n: title,
    });
  }
}

/** What the works made for a realm's seat give its standing. */
function workFactors(ctx: PopulationContext, realm: Polity): Factor[] {
  const { world } = ctx,
    store = worksOf(world);
  if (!store) return [];
  const works = store.for("seat", realm.ref);
  if (!works.length) return [];
  const year = yearOfMoment(world.now),
    contribution = WORK.credit * patronCredit(world, "seat", realm.ref, year);
  if (contribution <= 0.0005) return [];
  const latest = works[works.length - 1]!;
  return [
    {
      name: "works made for its seat",
      value: works.length,
      contribution,
      source: { ref: latest.event, role: "enabler", weight: 1 },
    },
  ];
}

/** Teach a peopled world its works. */
export function installWorks(world: World, ctx: () => PopulationContext): WorksStore {
  const store = world.register(new WorksStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "198.ideas.works", every: YEAR, run: (t) => worksYear(ctx(), t) });
  addsStanding(workFactors);
  return store;
}
