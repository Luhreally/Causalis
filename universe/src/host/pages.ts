// The observatory's pages (docs/architecture §I.7, milestones 67, 68 and 70): a wild
// lineage, a realm, a deposit, a plate and the world's deep ages — what each is, where
// it is, what it is to the people, and the refs whose whys the page opens. Pure reads of
// the world as it stands; asking never moves it.
import { AGES, BIOME_NAMES, ageRef, isProvinceWorld, lives, offworldSite } from "../gen/index.ts";
import {
  designsOf,
  diplomacyOf,
  homePlanet,
  loreOf,
  politiesOf,
  populationContext,
  realmName,
  relationRef,
  warsOf,
  wildsOf,
} from "../sim/index.ts";
import { governmentWords, principleName, standingWords, why } from "../causal/index.ts";
import { yearOfMoment, type Ref, type World } from "../kernel/index.ts";
import type { DepositPage, PlatePage, RealmPage, SpeciesPage } from "../bridge/index.ts";

/** How many lands a world has of its own (the offworld sites come after them). */
function landsOf(world: World): number {
  return homePlanet(world).generated.offworld.base;
}

const NICHE_WORDS: Readonly<Record<string, string>> = {
  "seed grass": "a grass of the open land",
  grazer: "a grazer of the open land",
  browser: "a browser of the forests",
  "great beast": "a great beast",
  hunter: "a hunter of other beasts",
  "upright ape": "the people",
};

/** A lineage: what it is, the age it arose in, where it lives, and what it is to the people. */
export function speciesPage(world: World, ref: string): SpeciesPage {
  const g = homePlanet(world).generated,
    s = g.life.species.find((x) => x.ref === ref);
  if (!s) throw new Error(`no lineage ${ref}`);
  const ctx = populationContext(world),
    n = landsOf(world);
  let lands = 0,
    peopled = 0,
    sown = 0,
    herded = 0,
    lost = 0;
  const origin = isProvinceWorld(g) ? g.provinceOf[s.origin]! : s.origin;
  // Its place among the living: the hunters and the game it shares lands with.
  const hunter = s.niche === "hunter",
    game = s.niche === "grazer" || s.niche === "browser" || s.niche === "great beast",
    others = g.life.species.filter(
      (o) =>
        o.died === null &&
        (hunter
          ? o.niche === "grazer" || o.niche === "browser" || o.niche === "great beast"
          : game && o.niche === "hunter"),
    ),
    shared = new Map<number, number>();
  let raids = 0;
  for (let c = 0; c < n; c++) {
    if (s.died !== null || !lives(g.life, c, s.index)) continue;
    const w = wildsOf(ctx, c);
    if (w.lost.includes(s.index)) {
      lost++;
      continue;
    }
    for (const o of others)
      if (lives(g.life, c, o.index) && !w.lost.includes(o.index))
        shared.set(o.index, (shared.get(o.index) ?? 0) + 1);
    if (hunter && w.hunter === s.index && w.flocksTaken) raids++;
    lands++;
    const p = ctx.provinces.get(c);
    if (!p || !p.total()) continue;
    peopled++;
    if (s.niche === "seed grass" && p.knowsCultivation && g.life.seedGrass[c] === s.index) sown++;
    if (p.herding && g.life.herdBeast[c] === s.index) herded++;
  }
  const a = g.deep.ages[s.arose],
    kin = [...shared]
      .sort((x, y) => y[1] - x[1] || x[0] - y[0])
      .slice(0, 5)
      .map(([i, k]) => ({ name: g.life.species[i]!.name, ref: g.life.species[i]!.ref, lands: k }));
  return {
    ref: s.ref,
    name: s.name,
    hunts: hunter ? kin : [],
    huntedBy: game ? kin : [],
    raids,
    niche: s.niche,
    what: NICHE_WORDS[s.niche] ?? s.niche,
    size: s.niche === "seed grass" ? null : s.size,
    tame: s.tame,
    wool: s.wool,
    herd: s.herd,
    seed: s.niche === "seed grass" ? s.seed : null,
    warm: s.warm,
    tolerance: s.tolerance,
    rain: [s.rainMin, s.rainMax],
    arose: { index: s.arose, ref: ageRef(0, s.arose), from: a?.from ?? 0, to: a?.to ?? 0 },
    died: s.died,
    origin: { cell: origin, biome: BIOME_NAMES[g.climate.biome[origin]!] ?? "" },
    lands,
    peopled,
    sown,
    herded,
    lost,
  };
}

/** A realm: its lands and people, how it is ruled and by whom, its rulers before, wars, pacts and what it knows. */
export function realmPage(world: World, ref: string): RealmPage {
  const realms = politiesOf(world),
    p = realms.get(ref as Ref);
  if (!p) throw new Error(`no realm ${ref}`);
  const ctx = populationContext(world),
    g = homePlanet(world).generated,
    people = p.members.reduce((s, c) => s + (ctx.provinces.get(c)?.total() ?? 0), 0);
  // The rulers the history still holds, newest first: each coming to rule is an event.
  const rulers: { year: number; event: string; claim: string }[] = [],
    events = world.events.all();
  for (let i = events.length - 1; i >= 0 && rulers.length < 6; i--) {
    const e = events[i]!;
    if (e.type === "polity.succession" && e.subjects[0] === p.ref)
      rulers.push({ year: yearOfMoment(e.t), event: e.id, claim: why(world, e.id).claim });
  }
  const wars = warsOf(world)
    .all()
    .filter((w) => w.attacker === p.ref || w.defender === p.ref)
    .reverse()
    .slice(0, 8)
    .map((w) => {
      const other = realms.get(w.attacker === p.ref ? w.defender : w.attacker);
      return {
        ref: w.ref,
        name: other ? realmName(other) : "a realm now gone",
        since: w.declared,
        ended: w.ended,
        attacking: w.attacker === p.ref,
        battles: w.battles.length,
        peace: w.peace,
        embargo: w.embargo ?? null,
      };
    });
  const pacts = diplomacyOf(world)
    .of(p.ref)
    .map((r) => {
      const other = realms.get(r.a === p.ref ? r.b : r.a);
      return {
        ref: relationRef(r.a, r.b),
        name: other ? realmName(other) : "a realm now gone",
        standing: standingWords(r.opinion, !!r.pact),
        pact: !!r.pact,
        opinion: r.opinion,
      };
    })
    .sort((x, y) => y.opinion - x.opinion);
  // What its seat knows, in the order it came to know it.
  const known = loreOf(world)
    .of(p.seat)
    .map(([id, k]) => ({ name: principleName(id), year: k.year, event: k.event }))
    .sort((a, b) => a.year - b.year || (a.name < b.name ? -1 : 1));
  const host = designsOf(world).of(p.ref);
  return {
    ref: p.ref,
    name: realmName(p),
    town: p.town,
    founded: p.founded,
    event: p.event,
    ended: p.ended,
    seat: p.seat,
    lands: p.members.length,
    offworld: p.members.filter((c) => offworldSite(g, c)).length,
    people,
    government: governmentWords(p),
    ruler: { name: p.ruler.name, since: p.ruler.since, event: p.ruler.event },
    rulers,
    tithe: Math.round(p.tribute * 100),
    host: host ? { ref: host.ref } : null,
    wars,
    pacts,
    known,
  };
}

/** A deposit: what it is, how much, what laid it down and when, and the plate it lies on. */
export function depositPage(world: World, ref: string): DepositPage {
  const g = homePlanet(world).generated,
    fine = isProvinceWorld(g) ? g.fine : g,
    d = fine.deposits.find((x) => x.ref === ref);
  if (!d) throw new Error(`no deposit ${ref}`);
  const [own, other] = d.plates,
    age = typeof d.detail.age === "number" && d.detail.age < 255 ? d.detail.age : null,
    land = isProvinceWorld(g) ? g.provinceOf[d.cell]! : d.cell,
    plate = (i: number | undefined) => {
      const pl = i === undefined ? undefined : fine.tectonics.plates[i];
      return pl ? { ref: pl.ref, continental: pl.continental } : null;
    };
  return {
    ref: d.ref,
    kind: d.kind,
    richness: d.richness,
    process: d.process,
    cell: d.cell,
    land,
    people: populationContext(world).provinces.get(land)?.total() ?? 0,
    plate: plate(own),
    across: plate(other),
    age: age === null ? null : { index: age, ref: ageRef(0, age) },
  };
}

/** A plate: its crust, its share of the world, its drift, and what lies on it. */
export function platePage(world: World, ref: string): PlatePage {
  const g = homePlanet(world).generated,
    fine = isProvinceWorld(g) ? g.fine : g,
    t = fine.tectonics,
    plate = t.plates.find((x) => x.ref === ref);
  if (!plate) throw new Error(`no plate ${ref}`);
  const ctx = populationContext(world),
    across = new Map<number, number>(),
    lands = new Set<number>();
  let land = 0,
    cells = 0;
  for (let c = 0; c < fine.grid.count; c++) {
    if (t.plate[c] !== plate.index) continue;
    cells++;
    if (t.elevation[c]! >= 0) land++;
    const o = t.across[c]!;
    if (o >= 0 && t.boundary[c]) across.set(o, t.boundary[c]!);
    lands.add(isProvinceWorld(g) ? g.provinceOf[c]! : c);
  }
  let people = 0;
  for (const l of lands) people += ctx.provinces.get(l)?.total() ?? 0;
  const deposits = new Map<string, number>();
  for (const d of fine.deposits)
    if (d.plates[0] === plate.index) deposits.set(d.kind, (deposits.get(d.kind) ?? 0) + 1);
  return {
    ref: plate.ref,
    continental: plate.continental,
    share: plate.area / (4 * Math.PI),
    speed: plate.speed,
    dry: cells ? land / cells : 0,
    people,
    neighbours: [...across.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([i, b]) => ({ ref: t.plates[i]!.ref, boundary: b })),
    deposits: [...deposits.entries()]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .map(([kind, count]) => ({ kind, count })),
  };
}

/** The ages of the world's deep past, oldest first, each with its ref and what it was. */
export function deepAges(world: World): { ref: string; claim: string }[] {
  const out: { ref: string; claim: string }[] = [];
  for (let i = 0; i < AGES; i++) {
    const r = ageRef(0, i);
    out.push({ ref: r, claim: why(world, r).claim });
  }
  return out;
}

export const PAGE_QUERIES = {
  "species.page": (world: World, args: unknown) =>
    speciesPage(world, (args as { ref: string }).ref),
  "realm.page": (world: World, args: unknown) => realmPage(world, (args as { ref: string }).ref),
  "deposit.page": (world: World, args: unknown) =>
    depositPage(world, (args as { ref: string }).ref),
  "plate.page": (world: World, args: unknown) => platePage(world, (args as { ref: string }).ref),
  "deep.ages": (world: World) => deepAges(world),
};
