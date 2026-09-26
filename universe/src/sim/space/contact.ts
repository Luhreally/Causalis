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
import { knows, loreOf } from "../lore/lore.ts";
import type { PopulationContext } from "../population/systems.ts";
import { clusterOf } from "./voyages.ts";

export const CONTACT_EVENTS = {
  heard: defineEventType("contact.heard", 6),
};

/** The civilizations of a world's cluster, kept while the world is the same. */
const CIVS = new Map<string, Civilization[]>();
export function civilizationsNear(world: World): Civilization[] {
  const key = world.seed.text;
  let civs = CIVS.get(key);
  if (!civs) {
    if (CIVS.size > 8) CIVS.clear();
    const rng = new Rng(world.seed);
    CIVS.set(key, (civs = civilizationsOf(rng, clusterOf(world), (s) => foreignPlanets(rng, s))));
  }
  return civs;
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
    year = yearOfMoment(t),
    civs = civilizationsNear(world);
  if (!civs.length) return;
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
  for (const civ of civs) {
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
  world.addPinner(() => store.pinned());
  world.system({ key: "199.space.contact", every: YEAR, run: (t) => contactYear(ctx(), t) });
  return store;
}
