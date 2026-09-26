// Languages (docs/architecture §19, Phase 3 M31): each land's speech belongs to a
// language, and languages to families. At the chronicle's opening the bands' speech
// has drifted along the paths they took, so a language is the speech of lands that
// still understand each other, and a family all the languages grown from one of the
// first people's daughters. Through the chronicle a language's standard is the speech
// of its home land; a land whose speech drifts too far from it has a language of its
// own (a decision, with how far and why), a land whose speech has grown more like a
// neighbouring language's takes that language up (the road, the realm that brought
// it), a language no land speaks is gone, and families that meet for the first time —
// down a new road or across the sea — meet in history.
import {
  YEAR,
  Hasher,
  defineEventType,
  defineKind,
  defineStream,
  dmath,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import {
  borrowSound,
  cellRef,
  commonTongue,
  languageName,
  tongueLikeness,
  type Tongue,
} from "../../gen/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { cultureOf } from "./culture.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { loreOf } from "../lore/lore.ts";
import { homePlanet } from "../planet/store.ts";
import { kmBetween } from "../economy/sea.ts";

export const LANGUAGE = defineKind("lang", "language", "minted");

export const LANGUAGE_EVENTS = {
  arose: defineEventType("language.arose", 4),
  shifted: defineEventType("language.shifted", 3),
  died: defineEventType("language.died", 4),
  contact: defineEventType("language.contact", 5),
};

export type Language = {
  readonly ref: Ref;
  readonly index: number;
  /** Its speakers' own name for it. */
  readonly name: string;
  /** The language it grew from, and the first of its line (its family); indices. */
  readonly parent: number | null;
  readonly family: number;
  readonly born: number;
  /** The event it arose in (for the first people's speech, their coming). */
  readonly event: Ref;
  /** The land whose speech is its standard, and that speech as it now stands. */
  home: number;
  standard: Tongue;
  died: number | null;
};

/** At the chronicle's opening, a land speaks a language whose standard its speech is this like. */
export const APART = 0.72;
/** Through the chronicle, below this likeness to its language's standard a land's speech is a language of its own. */
export const SPLIT = 0.62;
/** Each year, the chance a land ruled from a seat of another speech takes it up (doubled by roads, tripled with writing too). */
const TAKE_UP = 0.002;
/** Years a land keeps to a language it has gone over to before it may go over again. */
const SETTLING = 50;
/** The old sounds a people keep when they take up their rulers' speech. */
const KEPT_SOUNDS = 3;

const RULERS = defineStream("culture.rulers");
/** A land takes up a neighbouring language when its speech is this much more like it than its own. */
export const NEARER = 0.06;

export class LanguageStore implements StateStore {
  readonly name = "culture.languages";
  private list: Language[] = [];
  private readonly byRef = new Map<string, Language>();
  /** Each land's language, and the event it came with. */
  private readonly spoken = new Map<number, { language: number; since: Ref }>();
  /** Families that have met, as "a|b" (a < b). */
  private readonly met = new Set<string>();

  add(l: Language): Language {
    this.list.push(l);
    this.byRef.set(l.ref, l);
    return l;
  }
  all(): readonly Language[] {
    return this.list;
  }
  at(index: number): Language {
    return this.list[index]!;
  }
  get(ref: Ref): Language | undefined {
    return this.byRef.get(ref);
  }
  /** The language a land speaks, and since what. */
  of(cell: number): Language | undefined {
    const s = this.spoken.get(cell);
    return s ? this.list[s.language] : undefined;
  }
  since(cell: number): Ref | null {
    return this.spoken.get(cell)?.since ?? null;
  }
  speak(cell: number, language: number, since: Ref): void {
    this.spoken.set(cell, { language, since });
  }
  /** The lands speaking each language, by index, each list in cell order. */
  speakers(): Map<number, number[]> {
    const out = new Map<number, number[]>();
    for (const cell of [...this.spoken.keys()].sort((a, b) => a - b)) {
      const l = this.spoken.get(cell)!.language,
        list = out.get(l);
      if (list) list.push(cell);
      else out.set(l, [cell]);
    }
    return out;
  }
  haveMet(a: number, b: number): boolean {
    return a === b || this.met.has(a < b ? `${a}|${b}` : `${b}|${a}`);
  }
  meet(a: number, b: number): void {
    if (a !== b) this.met.add(a < b ? `${a}|${b}` : `${b}|${a}`);
  }
  /** A family's name: its first language's, as the family of tongues. */
  familyName(l: Language): string {
    return this.list[l.family]!.name;
  }

  pinned(): Ref[] {
    const refs = this.list.map((l) => l.event);
    for (const s of this.spoken.values()) refs.push(s.since);
    return refs;
  }
  hashInto(h: Hasher): void {
    h.int(this.list.length);
    for (const l of this.list)
      h.string(l.ref)
        .string(l.name)
        .int(l.parent ?? -1)
        .int(l.family)
        .int(l.born)
        .string(l.event)
        .int(l.home)
        .value(l.standard)
        .int(l.died ?? -1);
    for (const cell of [...this.spoken.keys()].sort((a, b) => a - b)) {
      const s = this.spoken.get(cell)!;
      h.int(cell).int(s.language).string(s.since);
    }
    h.value([...this.met].sort(byText));
  }
  save(): unknown {
    return {
      languages: this.list,
      spoken: [...this.spoken.entries()].sort((a, b) => a[0] - b[0]),
      met: [...this.met].sort(byText),
    };
  }
  load(state: unknown): void {
    const s = state as {
      languages: Language[];
      spoken: [number, { language: number; since: Ref }][];
      met: string[];
    };
    this.list = [];
    this.byRef.clear();
    for (const l of s.languages) this.add({ ...l, standard: { ...l.standard } });
    this.spoken.clear();
    for (const [cell, v] of s.spoken) this.spoken.set(cell, { ...v });
    this.met.clear();
    for (const m of s.met) this.met.add(m);
  }
}

const byText = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);

export function languagesOf(world: World): LanguageStore {
  return world.store<LanguageStore>("culture.languages");
}

/** A new language's name: its speakers' word for their speech, never one already taken. */
function freshName(store: LanguageStore, t: Tongue, key: number): string {
  const taken = new Set(store.all().map((l) => l.name));
  let name = languageName(t, key);
  for (let k = 1; k < 16 && taken.has(name); k++) name = languageName(t, key + 7919 * k);
  return name;
}

/**
 * The languages at the chronicle's opening. `lands` are in the order the bands reached
 * them, each with the land they came from (the cradle names itself). A land speaks the
 * language, of those its forebears or placed neighbours speak, whose standard its
 * speech is most like — or, if none is like enough, a language of its own, a daughter
 * of its forebears'. The first people's daughters each begin a family.
 */
export function foundLanguages(world: World, lands: readonly [number, number][], cause: Ref): void {
  const store = languagesOf(world),
    culture = cultureOf(world),
    g = homePlanet(world).generated;
  for (const [cell, from] of lands) {
    const tongue = culture.get(cell)!.tongue;
    if (cell === from) {
      const ref = world.minter.mint(LANGUAGE);
      store.add({
        ref,
        index: 0,
        name: freshName(store, tongue, cell),
        parent: null,
        family: 0,
        born: 0,
        event: cause,
        home: cell,
        standard: tongue,
        died: null,
      });
      store.speak(cell, 0, cause);
      continue;
    }
    // The candidates: the forebears' language, and any a placed neighbour speaks.
    const candidates = new Set<number>([store.of(from)!.index]);
    for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++) {
      const l = store.of(g.grid.neighbours[k]!);
      if (l) candidates.add(l.index);
    }
    let best = -1,
      like = -1;
    for (const i of [...candidates].sort((a, b) => a - b)) {
      const v = tongueLikeness(tongue, store.at(i).standard);
      if (v > like) [best, like] = [i, v];
    }
    if (like >= APART) {
      store.speak(cell, best, cause);
      continue;
    }
    const parent = store.of(from)!,
      index = store.all().length,
      name = freshName(store, tongue, cell),
      event = world.events.emit({
        type: LANGUAGE_EVENTS.arose.type,
        subjects: [],
        place: cellRef(0, cell),
        causes: [{ ref: cause, role: "trigger", weight: 1 }],
        data: { name, from: parent.name, kept: Math.round(100 * like), year: 0 },
      });
    store.add({
      ref: world.minter.mint(LANGUAGE),
      index,
      name,
      parent: parent.index,
      family: parent.index === 0 ? index : parent.family,
      born: 0,
      event,
      home: cell,
      standard: tongue,
      died: null,
    });
    store.speak(cell, index, event);
  }
  // Families living side by side (or a sea's step apart) since the ages before have met.
  for (const [cell, from] of lands) {
    const a = store.of(cell)!.family;
    store.meet(a, store.of(from)!.family);
    for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++) {
      const l = store.of(g.grid.neighbours[k]!);
      if (l) store.meet(a, l.family);
    }
  }
}

/** The year of languages: new lands take their comers' speech; standards are what each language's lands share; lands shift, split off, take up their rulers' speech; families meet. */
export function languagesYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    store = languagesOf(world),
    culture = cultureOf(world),
    markets = world.store<MarketStore>("economy.markets"),
    realms = politiesOf(world),
    lore = loreOf(world),
    year = yearOfMoment(t),
    provinces = ctx.provinces.all(),
    peopled = (c: number) => (ctx.provinces.get(c)?.total() ?? 0) > 0;

  // 1. A land newly peopled (or peopled again after its speech died out) speaks as those
  // who came: failing that, as its most alike neighbour.
  for (const p of provinces) {
    const had = store.of(p.cell);
    if ((had && had.died === null) || !p.total()) continue;
    const tongue = culture.get(p.cell)?.tongue;
    if (!tongue) continue;
    const flow = ctx.history.flows().find((f) => f.to === p.cell && f.event === p.arrival);
    let lang = flow ? store.of(flow.from) : undefined;
    if (lang && lang.died !== null) lang = undefined;
    if (!lang) {
      let like = -1;
      for (let k = g.grid.offsets[p.cell]!; k < g.grid.offsets[p.cell + 1]!; k++) {
        const l = store.of(g.grid.neighbours[k]!);
        if (!l || l.died !== null) continue;
        const v = tongueLikeness(tongue, l.standard);
        if (v > like || (v === like && l.index < lang!.index)) [lang, like] = [l, v];
      }
    }
    const spoken = lang ?? store.all().find((l) => l.died === null) ?? store.at(0);
    store.speak(p.cell, spoken.index, p.arrival ?? spoken.event);
  }

  // 2. Each language's standard is the speech its lands share, weighted by their people;
  // its home is its most peopled land. A language whose lands all stand empty is gone.
  const speakers = store.speakers();
  for (const l of store.all()) {
    if (l.died !== null) continue;
    const lands = (speakers.get(l.index) ?? []).filter(peopled);
    if (!lands.length) {
      if (speakers.get(l.index)?.length) {
        l.died = year;
        world.events.emit({
          type: LANGUAGE_EVENTS.died.type,
          subjects: [l.ref],
          place: cellRef(0, l.home),
          causes: [{ ref: l.event, role: "enabler", weight: 1 }],
          data: { name: l.name, empty: true },
        });
      }
      continue;
    }
    let most = lands.includes(l.home) ? l.home : lands[0]!;
    for (const c of lands)
      if (ctx.provinces.get(c)!.total() > ctx.provinces.get(most)!.total()) most = c;
    l.home = most;
    l.standard = commonTongue(
      lands.map((c) => culture.get(c)!.tongue),
      lands.map((c) => ctx.provinces.get(c)!.total()),
      l.standard.seed,
    );
  }

  // 3. Planned from the year's opening speech, then made in land order: a land whose
  // speech is more like a neighbouring language's than its own goes over to it; one
  // drifted too far from its own has a language of its own; one ruled from a seat that
  // speaks another takes up its rulers' speech in time.
  type Plan =
    | { cell: number; kind: "shift"; to: number; via: number }
    | { cell: number; kind: "split"; like: number }
    | { cell: number; kind: "rule"; to: number; realm: Polity };
  const plans: Plan[] = [];
  for (const p of provinces) {
    if (!p.total()) continue;
    const mine = store.of(p.cell),
      tongue = culture.get(p.cell)?.tongue;
    if (!mine || mine.died !== null || !tongue) continue;
    const own = tongueLikeness(tongue, mine.standard);
    let best: { to: number; via: number; like: number } | null = null;
    // Who speaks what around them: a land goes over only to the speech most of its
    // neighbours speak.
    const around = new Map<number, number>();
    let near = 0;
    const consider = (n: number) => {
      const l = store.of(n);
      if (!l || l.died !== null || !peopled(n)) return;
      near++;
      around.set(l.index, (around.get(l.index) ?? 0) + 1);
      if (l.index === mine.index) return;
      const v = tongueLikeness(tongue, l.standard);
      if (!best || v > best.like || (v === best.like && l.index < best.to))
        best = { to: l.index, via: n, like: v };
    };
    for (let k = g.grid.offsets[p.cell]!; k < g.grid.offsets[p.cell + 1]!; k++)
      consider(g.grid.neighbours[k]!);
    for (const n of markets.seaPartners(p.cell)) consider(n);
    const found = best as { to: number; via: number; like: number } | null,
      b = found && 2 * (around.get(found.to) ?? 0) >= near ? found : null,
      // A land that has lately gone over to a language keeps to it a while.
      lately = world.events.get(store.since(p.cell) ?? ("" as Ref)),
      settled =
        !lately || lately.type !== LANGUAGE_EVENTS.shifted.type || t - lately.t >= SETTLING * YEAR;
    if (b && settled && b.like > own + NEARER) {
      plans.push({ cell: p.cell, kind: "shift", to: b.to, via: b.via });
      continue;
    }
    if (own < SPLIT) {
      // Drifted from its own: to a neighbouring language nearer its speech, else to one of its own.
      if (found && settled && found.like > own)
        plans.push({ cell: p.cell, kind: "shift", to: found.to, via: found.via });
      else plans.push({ cell: p.cell, kind: "split", like: own });
      continue;
    }
    const realm = realms.of(p.cell),
      theirs = realm && realm.seat !== p.cell ? store.of(realm.seat) : undefined;
    if (!realm || !theirs || theirs === mine || theirs.died !== null) continue;
    // Roads carry the rulers' clerks and soldiers; writing is how they rule.
    const chance =
      TAKE_UP *
      (1 +
        (lore.get(realm.seat, "roads") ? 1 : 0) +
        (lore.effect(realm.seat, "writing") > 0 ? 1 : 0));
    if (world.rng.real(RULERS, p.cell, t) < chance)
      plans.push({ cell: p.cell, kind: "rule", to: theirs.index, realm });
  }
  const planned = new Set(plans.map((x) => x.cell));
  for (const plan of plans) {
    const p = ctx.provinces.get(plan.cell)!,
      was = store.of(plan.cell)!;
    if (plan.kind === "shift" || plan.kind === "rule") {
      const to = store.at(plan.to),
        causes: CauseRef[] = [];
      let data: Record<string, unknown> = { name: to.name, from: was.name };
      if (plan.kind === "shift") {
        const road = markets.route(plan.cell, plan.via),
          realm = realms.of(plan.cell);
        causes.push(
          road
            ? { ref: road, role: "trigger", weight: 0.6 }
            : { ref: cellRef(0, plan.via), role: "trigger", weight: 0.6 },
        );
        // Ruled together with those who speak it, a land goes over to their speech the sooner.
        if (realm && realm === realms.of(plan.via))
          causes.push({ ref: realm.ref, role: "enabler", weight: 0.4 });
      } else {
        const roads = lore.get(plan.realm.seat, "roads"),
          writing = lore.get(plan.realm.seat, "writing");
        causes.push({ ref: plan.realm.ref, role: "trigger", weight: 0.6 });
        if (roads) causes.push({ ref: roads.event, role: "enabler", weight: 0.2 });
        if (writing) causes.push({ ref: writing.event, role: "enabler", weight: 0.2 });
        data = { ...data, realm: realmName(plan.realm) };
        // They speak their rulers' tongue, with a few of their old sounds kept.
        const w = culture.get(plan.cell)!;
        let spoken = to.standard;
        for (let i = 0; i < KEPT_SOUNDS; i++)
          spoken = borrowSound(spoken, w.tongue, world.rng.real(RULERS, plan.cell, t, 1, i));
        w.tongue = spoken;
      }
      const event = world.events.emit({
        type: LANGUAGE_EVENTS.shifted.type,
        subjects: [to.ref, was.ref],
        place: p.ref,
        causes,
        data,
      });
      store.speak(plan.cell, to.index, event);
      forgotten(ctx, store, was, event, year);
      continue;
    }
    // A land's speech has drifted from its language's until it is one of its own.
    const tongue = culture.get(plan.cell)!.tongue,
      km = kmBetween(g, plan.cell, was.home),
      kin = (speakers.get(was.index) ?? []).filter((c) => c !== plan.cell && peopled(c)),
      road = kin.map((c) => markets.route(plan.cell, c)).find((r) => r !== undefined) ?? null,
      apart = realms.of(plan.cell) !== realms.of(was.home) ? realms.of(plan.cell) : undefined;
    const factors: Factor[] = [
      {
        name: `speech kept of ${was.name}`,
        value: plan.like,
        contribution: 1 - plan.like,
        source: { ref: was.ref, role: "enabler", weight: 1 },
      },
      {
        name: "the distance from its home",
        value: Math.round(km),
        contribution: Math.min(1, km / 3000),
        source: { ref: cellRef(0, was.home), role: "constraint", weight: 1 },
      },
    ];
    if (road)
      factors.push({
        name: "a road to their kin",
        value: 1,
        contribution: -0.2,
        source: { ref: road, role: "constraint", weight: 1 },
      });
    if (apart)
      factors.push({
        name: "ruled apart from its home",
        value: 1,
        contribution: 0.3,
        source: { ref: apart.ref, role: "pressure", weight: 1 },
      });
    const decision = world.decisions.record({
        rule: "language.arise",
        subject: p.ref,
        outcome: { from: was.ref },
        score: 1 - plan.like,
        threshold: 1 - APART,
        factors,
      }),
      index = store.all().length,
      name = freshName(store, tongue, plan.cell ^ (year << 12)),
      event = world.events.emit({
        type: LANGUAGE_EVENTS.arose.type,
        subjects: [was.ref],
        place: p.ref,
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
        data: { name, from: was.name, kept: Math.round(100 * plan.like), year },
      });
    store.add({
      ref: world.minter.mint(LANGUAGE),
      index,
      name,
      parent: was.index,
      // Families are what the ages before the chronicle made: a daughter stays in its mother's.
      family: was.family,
      born: year,
      event,
      home: plan.cell,
      standard: tongue,
      died: null,
    });
    store.speak(plan.cell, index, event);
    // Neighbours of the old speech whose own is nearer the new go with it.
    for (let k = g.grid.offsets[plan.cell]!; k < g.grid.offsets[plan.cell + 1]!; k++) {
      const n = g.grid.neighbours[k]!,
        theirs = culture.get(n)?.tongue;
      if (store.of(n) !== was || !peopled(n) || !theirs || planned.has(n)) continue;
      if (tongueLikeness(theirs, tongue) > tongueLikeness(theirs, was.standard))
        store.speak(n, index, event);
    }
    forgotten(ctx, store, was, event, year);
  }

  // 4. Families meeting for the first time, down this year's roads (by land or by sea).
  for (const f of markets.flows) {
    const a = store.of(f.from),
      b = store.of(f.to);
    if (!a || !b || store.haveMet(a.family, b.family)) continue;
    const road = markets.route(f.from, f.to);
    if (!road) continue;
    store.meet(a.family, b.family);
    world.events.emit({
      type: LANGUAGE_EVENTS.contact.type,
      subjects: [store.at(a.family).ref, store.at(b.family).ref],
      place: ctx.provinces.get(f.from)!.ref,
      causes: [{ ref: road, role: "trigger", weight: 1 }],
      data: { a: store.familyName(a), b: store.familyName(b), sea: markets.bySea(f.from, f.to) },
    });
  }
}

/** A language no land speaks any longer is gone: history says when, and what took its last land. */
function forgotten(
  ctx: PopulationContext,
  store: LanguageStore,
  l: Language,
  cause: Ref,
  year: number,
): void {
  if (l.died !== null || store.speakers().get(l.index)?.length) return;
  l.died = year;
  ctx.world.events.emit({
    type: LANGUAGE_EVENTS.died.type,
    subjects: [l.ref],
    place: cellRef(0, l.home),
    causes: [{ ref: cause, role: "trigger", weight: 1 }],
    data: { name: l.name },
  });
}

/** Teach a peopled world its languages. */
export function installLanguages(world: World, ctx: () => PopulationContext): LanguageStore {
  const store = world.register(new LanguageStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "162.culture.languages", every: YEAR, run: (t) => languagesYear(ctx(), t) });
  return store;
}
