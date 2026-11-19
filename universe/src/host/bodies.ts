// The institutions as the host knows them (sim/order/institutions.ts): each by a ref of its own, made of the event it was
// founded by (`inst:<event>`), so one that has passed to another realm with its land, or whose hold has ended, is still found;
// what is news of it; and how it is followed and kept on the people bar, as a group is. Pure reads.
import type { HistoryEvent, Ref, World } from "../kernel/index.ts";
import {
  bodiesOf,
  bodyTitle,
  politiesOf,
  populationContext,
  type Body,
  type GoneBody,
  type Polity,
} from "../sim/index.ts";
import { bodyWords, defineWatchKind } from "../causal/index.ts";

export const bodyRef = (event: string): string => `inst:${event}`;
const REF = /^inst:(ev:\d+:\d+)$/;
export const isBodyRef = (ref: string): boolean => REF.test(ref);
/** The founding event a body's ref is made of (null: not one). */
export const bodyEventOf = (ref: string): Ref | null => (REF.exec(ref)?.[1] as Ref) ?? null;

/** A body as history keeps it: its record while it stands (in whichever realm holds its land now), how its hold ended once gone. */
export type BodyRead = {
  readonly ref: string;
  readonly realm: Polity | null;
  readonly name: string;
  readonly title: string;
  readonly event: Ref;
  readonly record: Readonly<Body> | null;
  readonly gone: GoneBody | null;
};

type Founded = { body?: string; title?: string; realm?: string } | null | undefined;

/** Every body that stands, with its realm: a world's whole list (a ledger's, a land's). */
export function bodiesAll(world: World): { r: Polity; g: Readonly<Body> }[] {
  const store = bodiesOf(world);
  if (!store) return [];
  const realms = politiesOf(world),
    out: { r: Polity; g: Readonly<Body> }[] = [];
  for (const ref of store.realmsKept()) {
    const r = realms.get(ref);
    if (!r) continue;
    for (const g of store.of(ref)!.bodies) out.push({ r, g });
  }
  return out;
}

/** The bodies that hold any part of a land, the greatest first. */
export function bodiesIn(world: World, cell: number): { r: Polity; g: Readonly<Body> }[] {
  const store = bodiesOf(world),
    realms = politiesOf(world),
    r = realms.of(cell);
  if (!store) return [];
  // (Those its realm keeps; and, where the land has just passed from a realm, those that realm still keeps until its next
  // reckoning sends them after their land: told as the land's realm's where it has one, which is whose they are now.)
  const out: { r: Polity; g: Readonly<Body> }[] = [];
  for (const at of store.realmsKept()) {
    const keeps = r ?? realms.get(at);
    if (!keeps) continue;
    for (const g of store.of(at)!.bodies)
      if (at === r?.ref ? g.home === cell || g.lands.includes(cell) : g.home === cell)
        out.push({ r: keeps, g });
  }
  return out.sort((a, b) => b.g.income - a.g.income || (a.g.event < b.g.event ? -1 : 1));
}

export function bodyOf(world: World, ref: string): BodyRead | null {
  const event = bodyEventOf(ref),
    store = bodiesOf(world);
  if (!event) return null;
  const realms = politiesOf(world),
    founded = world.events.get(event)?.data as Founded;
  if (store)
    for (const at of store.realmsKept()) {
      const v = store.of(at)!,
        record = v.bodies.find((g) => g.event === event);
      if (record)
        return {
          ref,
          realm: realms.get(at) ?? null,
          name: record.name,
          title: bodyTitle(populationContext(world), record as Body),
          event,
          record,
          gone: null,
        };
      const gone = v.gone.find((g) => g.rose === event);
      if (gone)
        return {
          ref,
          realm: realms.get(at) ?? null,
          name: gone.name,
          title: gone.title,
          event,
          record: null,
          gone,
        };
    }
  // (Neither standing nor among the ended a realm still remembers: what its founding told of it.)
  if (!founded?.body) return null;
  const subject = world.events.get(event)?.subjects[0];
  return {
    ref,
    realm: (subject && realms.get(subject)) || null,
    name: founded.body,
    title: founded.title ?? "body",
    event,
    record: null,
    gone: null,
  };
}

/** What a body is called: "the Vav watch", "the Golmere iron company". */
export function bodyName(world: World, ref: string): string | null {
  const g = bodyOf(world, ref);
  return g ? bodyWords(g.name, g.title) : null;
}

/** Whether an event is news of a body: one that names its number in the realm that keeps it, or its founding's own name. */
export function bodyNews(g: BodyRead): (e: HistoryEvent) => boolean {
  const realm = g.realm?.ref,
    id = g.record?.id;
  return (e) => {
    if (e.id === g.event) return true;
    if (!e.type.startsWith("bodies.") && e.type !== "act.body") return false;
    const d = e.data as { bids?: number[]; body?: string; into?: string; from?: string } | null;
    if (!d) return false;
    if (id !== undefined && realm && e.subjects.includes(realm) && d.bids?.includes(id))
      return d.body === g.name || d.into === g.name || d.from === g.name;
    return false;
  };
}

defineWatchKind({
  test: (ref) => isBodyRef(ref),
  label: (world, ref) => bodyName(world, ref),
  news: (world, w) => {
    const g = bodyOf(world, w.ref);
    return g ? bodyNews(g) : () => false;
  },
});
