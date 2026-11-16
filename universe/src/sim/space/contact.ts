// Contact (docs/architecture §26, Phase 6 M61–M62): the cluster's other civilizations,
// followed in aggregate (gen/civilizations.ts), and the hearing of them. A people's
// signals leave its world once it has electronics and travel at light's speed; when they
// reach home and a realm there can listen (its seat knows electronics), the home world
// hears another people — first contact, an event whose why reaches that people's world
// and the listeners' own art. What is heard is light-old: a people forty light-years out
// is heard as it was forty years before.
import {
  Rng,
  YEAR,
  defineEventType,
  yearOfMoment,
  type CauseRef,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { civilizationsOf, foreignPlanets, type Civilization } from "../../gen/index.ts";
import { politiesOf } from "../polity/polity.ts";
import { farOf, fireOf } from "../war/fire.ts";
import { knows, loreOf } from "../lore/lore.ts";
import type { PopulationContext } from "../population/systems.ts";
import { clusterOf } from "./voyages.ts";
import { skyOf } from "../../rules/index.ts";
import { homePlanet } from "../planet/store.ts";
import { lawlessSeed } from "./lanes.ts";
import { FarReadStore } from "./far-read.ts";
import type { GalaxyStar } from "../../gen/index.ts";

/**
 * The years a followed people's own world lets it come to (natives.ts followedRead, which gives itself here as it
 * loads: the peoples' reading is made of the followed list, so the list does not ask for it by name).
 */
type FollowedRead = (world: World, s: GalaxyStar, index: number) => Civilization | null;
/** (Held on the function, which stands before any module's own names do: natives.ts may load first.) */
const given = followedBy as { read?: FollowedRead };
export function followedBy(read: FollowedRead): void {
  (followedBy as { read?: FollowedRead }).read = read;
}
const followedRead: FollowedRead = (world, s, index) => given.read?.(world, s, index) ?? null;

/**
 * Whether a world's far peoples' bodies are read from their own worlds' life (B4): where its home world's life was
 * (every world but Earth's and those kept as they were made); null: as before. Else the key text they are read by.
 */
export function farBodies(world: World): string | null {
  // (A world with no home planet, a reading of its seed alone: as before.)
  if (!world.hasStore("planet.home")) return null;
  return homePlanet(world).generated.fine.physical ? lawlessSeed(world.seed.text) : null;
}

export const CONTACT_EVENTS = {
  heard: defineEventType("contact.heard", 6),
};

/** The civilizations of a world's cluster, kept while the world is the same. */
const CIVS = new Map<string, Civilization[]>();
/** Every people there ever was about these stars, those whose world is gone among them: what they were called outlives them. */
export function civilizationsEver(world: World): Civilization[] {
  const key = world.seed.text;
  let civs = CIVS.get(key);
  if (!civs) {
    if (CIVS.size > 8) CIVS.clear();
    const rng = new Rng(world.seed);
    CIVS.set(
      key,
      (civs = civilizationsOf(
        rng,
        clusterOf(world),
        (s) => foreignPlanets(rng, s),
        skyOf(world.seed.text)?.most,
        farBodies(world),
      )),
    );
  }
  return civs;
}
/** The followed peoples as history reads them: each with the years its own world lets it come to (natives.ts). */
const READ = new Map<string, Civilization[]>();
/** The first year a followed people comes to anything its own world might shut to it, as first read. */
const firstYear = (c: Civilization): number => Math.min(c.electronics, c.orbit, c.stars);
function readOne(world: World, stars: readonly GalaxyStar[], c: Civilization): Civilization {
  const s = stars.find((x) => c.star.endsWith(`:${x.sector}:${x.k}`));
  return (s && followedRead(world, s, c.planet)) || c;
}
function civilizationsRead(world: World): Civilization[] {
  const key = world.seed.text;
  let civs = READ.get(key);
  if (!civs) {
    if (READ.size > 8) READ.clear();
    const stars = clusterOf(world);
    civs = civilizationsEver(world).map((c) => readOne(world, stars, c));
    READ.set(key, civs);
  }
  return civs;
}
/**
 * The followed peoples as history reads them in a year: each that has come to its signals, its orbit or the stars as
 * first read, with the years its own world lets it come to; the rest as first read. All history asks of a people's
 * years in a year is whether that year has come to them, and a reading only ever puts a year later (to never), so
 * the two answer alike: no year waits on the making of a world it does not yet need (each some half a second), and
 * the list is the same whether or not a page or a spare moment has read them since.
 */
const BY = new Map<string, { year: number; civs: Civilization[] }>();
function civilizationsBy(world: World, year: number): Civilization[] {
  const key = world.seed.text,
    known = BY.get(key);
  if (known && known.year === year) return known.civs;
  const stars = clusterOf(world),
    civs = civilizationsEver(world).map((c) =>
      firstYear(c) > year ? c : readOne(world, stars, c),
    );
  if (BY.size > 8) BY.clear();
  BY.set(key, { year, civs });
  return civs;
}
/**
 * One more followed people's ceiling read, of those not yet read, the soonest needed first (false: all are). A
 * world's start does this in its spare moments (host: idle), so that no year of history or page waits on a far
 * world's making; a year that needs one not yet read reads it then.
 */
export function farReadNext(world: World): boolean {
  if (READ.has(world.seed.text)) return false;
  const stars = clusterOf(world);
  let at = (farReadNext as { at?: Map<string, number> }).at;
  if (!at) (farReadNext as { at?: Map<string, number> }).at = at = new Map();
  const civs = [...civilizationsEver(world)].sort((a, b) => firstYear(a) - firstYear(b)),
    i = at.get(world.seed.text) ?? 0;
  if (i >= civs.length) {
    civilizationsRead(world);
    return false;
  }
  readOne(world, stars, civs[i]!);
  at.set(world.seed.text, i + 1);
  return true;
}
/** Every followed people's ceiling read now. */
export function farReadAll(world: World): void {
  civilizationsRead(world);
}

/** One followed people by its ref, as its own world lets it come (null: none such, or its world unmade). Reads it alone. */
export function civilizationOf(world: World, ref: string): Civilization | null {
  const c = civilizationsEver(world).find((x) => x.ref === ref);
  if (!c || (farOf(world)?.falls.length && fireOf(world).unmade(c.star, c.planet))) return null;
  return readOne(world, clusterOf(world), c);
}

/**
 * The peoples followed about these stars, those whose world was unmade gone. `year`: as history reads them in that
 * year (civilizationsBy); left out, every one as its own world lets it come (a page's account of them).
 */
export function civilizationsNear(world: World, year?: number): Civilization[] {
  const civs = year === undefined ? civilizationsRead(world) : civilizationsBy(world, year);
  // (A people whose world was unmade is no more: W6. Exactly the list it always was, until one is.)
  return farOf(world)?.falls.length
    ? civs.filter((c) => !fireOf(world).unmade(c.star, c.planet))
    : civs;
}

export type Contact = {
  readonly civ: Ref;
  /** The event of the home world's first hearing them, the realm that heard, and the year. */
  readonly heard: Ref;
  readonly by: Ref;
  readonly year: number;
};

export class ContactStore implements StateStore {
  readonly name = "space.contact";
  private readonly heard = new Map<string, Contact>();

  of(civ: Ref): Contact | undefined {
    return this.heard.get(civ);
  }
  all(): Contact[] {
    return [...this.heard.values()].sort((a, b) => a.year - b.year || (a.civ < b.civ ? -1 : 1));
  }
  add(c: Contact): void {
    this.heard.set(c.civ, c);
  }
  pinned(): Ref[] {
    return this.all().map((c) => c.heard);
  }
  hashInto(h: Hasher): void {
    h.value(this.all());
  }
  save(): unknown {
    return this.all();
  }
  load(state: unknown): void {
    this.heard.clear();
    for (const c of state as Contact[]) this.heard.set(c.civ, { ...c });
  }
}

export function contactsOf(world: World): ContactStore {
  return world.store<ContactStore>("space.contact");
}

/** The year's listening: a people's signals, arriving now, heard by a realm that can. */
export function contactYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = contactsOf(world),
    year = yearOfMoment(t);
  // The listeners: the realms whose seats know electronics, the longest-knowing first.
  const lore = loreOf(world),
    listeners = politiesOf(world)
      .living()
      .filter((p) => knows(ctx, p.seat, "electronics"))
      .sort(
        (a, b) =>
          lore.get(a.seat, "electronics")!.year - lore.get(b.seat, "electronics")!.year ||
          (a.ref < b.ref ? -1 : 1),
      );
  if (!listeners.length) return;
  const by = listeners[0]!;
  for (const civ of civilizationsNear(world, year)) {
    if (store.of(civ.ref) || year < civ.electronics + Math.ceil(civ.distance)) continue;
    const art = lore.get(by.seat, "electronics")!,
      causes: CauseRef[] = [
        { ref: civ.ref, role: "trigger", weight: 1 },
        { ref: art.event, role: "enabler", weight: 0.8 },
        { ref: by.ref, role: "agent", weight: 0.5 },
      ];
    const heard = world.events.emit({
      type: CONTACT_EVENTS.heard.type,
      place: ctx.provinces.get(by.seat)?.ref ?? null,
      subjects: [by.ref, civ.ref],
      causes,
      data: {
        realm: by.town,
        distance: Math.round(civ.distance * 10) / 10,
        clade: civ.clade,
        sent: civ.electronics,
        year,
      },
    });
    store.add({ civ: civ.ref, heard, by: by.ref, year });
  }
}

export function installContact(world: World, ctx: () => PopulationContext): ContactStore {
  const store = world.register(new ContactStore());
  // (What each followed people's own world lets it come to, read once and kept beside the world: far-read.ts.)
  world.register(new FarReadStore(world.seed.text));
  world.addPinner(() => store.pinned());
  world.system({ key: "199.space.contact", every: YEAR, run: (t) => contactYear(ctx(), t) });
  return store;
}
