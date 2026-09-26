// A life, resolved to its depth (docs/architecture §14, D3–D4): the years a person
// lived, province by province along their recorded path; the history they lived
// through there — famines, dry years, the coming of farming, the founding of their
// village — and their own moves; the memories that formed them (the most striking
// of what they saw young); and a character shaped by it. Every life event cites the
// event it was. The observer keeps a copy of each remembered event, so history may
// forget it without the person forgetting it — and without looking changing what
// history keeps.
import {
  YEAR,
  defineStream,
  dmath,
  makeRef,
  yearOfMoment,
  type Ref,
  type World,
} from "../kernel/index.ts";
import { cellRef } from "../gen/index.ts";
import { HUMANLIKE, OCC } from "../rules/index.ts";
import { ECONOMY_EVENTS, POPULATION_EVENTS, marketsOf, populationContext } from "../sim/index.ts";
import { MEMORY, catchUp, observer, type LifeEvent, type Memory, type Person } from "./observer.ts";

const CHARACTER = defineStream("observe.character");

/** How strongly each kind of life event marks a young person. */
const SALIENCE: Readonly<Record<string, number>> = {
  moved: 5,
  famine: 4,
  cultivation: 3,
  "farming-came": 3,
  founded: 2,
  drought: 2,
  "took-up-farming": 2,
  "food-came": 4,
  "metal-came": 3,
  "market-town": 2,
  "road-opened": 2,
  "took-up-craft": 2.5,
  "took-up-trade": 2.5,
  "took-up-herding": 2,
  "kept-old-ways": 2,
  "chosen-to-lead": 3,
  plague: 4.5,
  "died-plague": 5,
  healing: 3,
  blight: 3.5,
  "good-years": 2,
  rains: 2,
  inspired: 3.5,
};

export const TRAITS = ["boldness", "warmth", "thrift", "curiosity", "patience"] as const;

/** Where a person lived in each year of their life (by their recorded moves). */
export function residence(person: Person, year: number): number {
  let cell = person.birthCell;
  for (const m of person.moves) if (m.year <= year) cell = m.to;
  return cell;
}

/** Resolve a person to their biography (D4). Idempotent: a life, once told, stays told. */
export function deepen(world: World, person: Person): Person {
  catchUp(world, person);
  if (person.depth >= 4 && person.life) return person;
  const ctx = populationContext(world),
    ledger = observer(world),
    now = Math.floor(world.now / YEAR),
    from = Math.max(0, person.birthYear),
    to = person.alive ? now : (person.diedYear ?? now);
  // Index the history by place, once.
  const byPlace = new Map<
    string,
    { id: Ref; t: number; type: string; importance: number; place: Ref | null; data: unknown }[]
  >();
  for (const e of world.events.all()) {
    if (!e.place) continue;
    const list = byPlace.get(e.place) ?? [];
    list.push(e);
    byPlace.set(e.place, list);
  }
  const remember = (id: Ref) => {
    if (ledger.remembered.has(id)) return;
    const e = world.events.get(id);
    if (e)
      ledger.remembered.set(id, {
        id,
        t: e.t,
        type: e.type,
        place: e.place,
        subjects: e.subjects,
        data: e.data,
      });
  };
  const life: LifeEvent[] = [];
  const add = (year: number, kind: string, event: Ref | null) => {
    life.push({ year, age: year - person.birthYear, kind, event });
    if (event) remember(event);
  };
  // Roads are part of the story at both of their ends.
  const roads = new Map<string, Ref[]>();
  for (const e of world.events.all())
    if (e.type === ECONOMY_EVENTS.route.type)
      for (const end of e.subjects) roads.set(end, [...(roads.get(end) ?? []), e.id]);
  for (let y = from; y <= to; y++) {
    const cell = residence(person, y),
      here = byPlace.get(cellRef(0, cell)) ?? [];
    for (const id of roads.get(cellRef(0, cell)) ?? [])
      if (yearOfMoment(world.events.get(id)!.t) === y) add(y, "road-opened", id);
    for (const e of here) {
      if (yearOfMoment(e.t) !== y) continue;
      if (e.type === POPULATION_EVENTS.famine.type) add(y, "famine", e.id);
      else if (e.type === POPULATION_EVENTS.drought.type) add(y, "drought", e.id);
      else if (e.type === POPULATION_EVENTS.cultivation.type) add(y, "cultivation", e.id);
      else if (e.type === POPULATION_EVENTS.cultivationSpread.type) add(y, "farming-came", e.id);
      else if (e.type === ECONOMY_EVENTS.relief.type) add(y, "food-came", e.id);
      else if (
        e.type === ECONOMY_EVENTS.metalworking.type ||
        e.type === ECONOMY_EVENTS.metalworkingSpread.type
      )
        add(y, "metal-came", e.id);
      else if (e.type === POPULATION_EVENTS.market.type) add(y, "market-town", e.id);
      else if (e.type.startsWith("act.")) {
        // The god's acts, as the people lived them.
        const sign = (e.data as { sign?: number } | null)?.sign ?? 1,
          kind = e.type.slice(4);
        const lived =
          kind === "plague"
            ? sign < 0
              ? person.diedYear !== null && person.diedYear - y <= 1
                ? "died-plague"
                : "plague"
              : "healing"
            : kind === "harvest"
              ? sign < 0
                ? "blight"
                : "good-years"
              : kind === "rain" && sign > 0
                ? "rains"
                : kind === "inspire"
                  ? "inspired"
                  : null;
        if (lived) add(y, lived, e.id);
      } else if (e.type === POPULATION_EVENTS.founded.type) {
        const village = (e.data as { name?: string } | null)?.name;
        const own = person.village && ctx.settlements.get(person.village)?.event === e.id;
        if (own) add(y, "founded", e.id);
        else if (
          village &&
          life.filter((l) => l.kind === "founded").length === 0 &&
          y === yearOfMoment(e.t)
        ) {
          // The first village of their province is part of their story too.
          if (ctx.settlements.inProvince(cell)[0]?.event === e.id) add(y, "founded", e.id);
        }
      }
    }
    for (const m of person.moves) if (m.year === y) add(y, "moved", m.event);
  }
  // The work they took up, and what drew them to it: a farmer who grew up before
  // farming came took it up when it did; everyone else took up their work as they
  // came of age — a craft for what the market wanted made, trading for the road
  // their goods went down, farming for the fields their people had learned to sow.
  const grownAt = person.birthYear + HUMANLIKE.adulthood,
    homeAt = residence(person, grownAt),
    province = ctx.provinces.get(homeAt);
  if (person.occupation === OCC.farmer) {
    const came = life.find(
      (l) => (l.kind === "cultivation" || l.kind === "farming-came") && l.age >= 15,
    );
    if (came) add(came.year, "took-up-farming", came.event);
    else if (grownAt >= 0 && grownAt <= to && province?.cultivation)
      add(grownAt, "took-up-farming", province.cultivation);
  } else if (
    (person.occupation === OCC.crafter || person.occupation === OCC.trader) &&
    grownAt >= 0 &&
    grownAt <= to
  ) {
    // Crafts and trade are learned at the market town, if there was one by then;
    // else a craft follows the metal worked there, and trade the first road out.
    const town = ctx.settlements
        .inProvince(homeAt)
        .find(
          (s) => s.market && yearOfMoment(world.events.get(s.market)?.t ?? Infinity) <= grownAt,
        ),
      road = (roads.get(cellRef(0, homeAt)) ?? [])
        .map((id) => world.events.get(id)!)
        .filter((e) => yearOfMoment(e.t) <= grownAt)[0],
      learned = marketsOf(world).get(homeAt)?.metalworking ?? null,
      metal =
        learned && yearOfMoment(world.events.get(learned)?.t ?? Infinity) <= grownAt
          ? learned
          : null,
      crafter = person.occupation === OCC.crafter;
    add(
      grownAt,
      crafter ? "took-up-craft" : "took-up-trade",
      town?.ref ?? (crafter ? metal : (road?.id ?? null)) ?? cellRef(0, homeAt),
    );
  } else if (person.occupation === OCC.herder && grownAt >= 0 && grownAt <= to)
    add(grownAt, "took-up-herding", cellRef(0, homeAt));
  else if (
    person.occupation === OCC.forager &&
    grownAt >= 0 &&
    grownAt <= to &&
    province?.cultivation
  )
    add(grownAt, "kept-old-ways", province.cultivation);
  else if (person.occupation === OCC.leader && person.village) {
    // Leaders are chosen from those who have lived a while among their people.
    const chosenAt = person.birthYear + 30;
    if (chosenAt >= 0 && chosenAt <= to) add(chosenAt, "chosen-to-lead", person.village);
  }
  life.sort((a, b) => a.year - b.year || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
  // Memories: the most striking of what they lived through — what they saw young
  // marks them most, a move is remembered at any age, a mild dry year no one went
  // hungry in is soon forgotten, and a second memory of the same kind counts for less.
  const severity = (l: LifeEvent) => {
    if (l.kind !== "drought") return 1;
    const rain = (ledger.remembered.get(l.event!)?.data as { rain?: number } | null)?.rain ?? 1000;
    return rain < 550 ? 1.25 : 0.5;
  };
  const pool = life
    .filter((l) => l.event && l.age >= 3)
    .map((l, i) => ({
      l,
      base: (SALIENCE[l.kind] ?? 1) * severity(l) * (l.kind === "moved" || l.age <= 20 ? 1 : 0.7),
      jitter: world.rng.real(CHARACTER, person.seq, l.year, 1, i) * 0.5,
    }))
    .filter((c) => c.base >= 1.2);
  const chosen: typeof pool = [];
  while (chosen.length < 3 && pool.length) {
    const score = (c: (typeof pool)[number]) =>
      c.base * dmath.pow2(-chosen.filter((x) => x.l.kind === c.l.kind).length) + c.jitter;
    let best = 0;
    for (let k = 1; k < pool.length; k++) if (score(pool[k]!) > score(pool[best]!)) best = k;
    chosen.push(pool.splice(best, 1)[0]!);
  }
  const candidates = chosen.sort((a, b) => a.l.year - b.l.year);
  const memories: Memory[] = candidates.map(({ l }, k) => ({
    ref: makeRef(MEMORY, person.seq, k),
    year: l.year,
    age: l.age,
    kind: l.kind,
    event: l.event!,
  }));
  // Character: a keyed temperament, marked by what they lived through.
  const traits: Record<string, number> = {};
  TRAITS.forEach(
    (t, i) => (traits[t] = 0.2 + 0.6 * world.rng.real(CHARACTER, person.seq, 0, 0, i)),
  );
  const young = (kind: string) => life.some((l) => l.kind === kind && l.age <= 15);
  if (young("famine")) traits.thrift = Math.min(1, traits.thrift! + 0.2);
  if (life.some((l) => l.kind === "moved")) traits.boldness = Math.min(1, traits.boldness! + 0.15);
  if (life.some((l) => l.kind === "cultivation" || l.kind === "farming-came"))
    traits.curiosity = Math.min(1, traits.curiosity! + 0.1);
  person.life = life;
  person.memories = memories;
  person.traits = traits;
  person.depth = 4;
  return person;
}

/** A person by reference, followed to now (and to their biography when depth ≥ 3). */
export function resolvePerson(world: World, ref: Ref, depth = 2): Person {
  const person = observer(world).person(ref);
  if (!person) throw new Error(`no one met is ${ref}`);
  catchUp(world, person);
  return depth >= 3 ? deepen(world, person) : person;
}
