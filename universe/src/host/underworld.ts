// The underworld's groups and federations as the host knows them (sim/order/underworld.ts): each by a ref of its own, made of the
// event it rose by (`mob:<realm>:<event>` a crime group, `gfed:<realm>:<event>` a federation of street gangs), so one whose hold
// has ended is still found; what is news of it; and how it is followed and kept on the people bar, as a family is. Pure reads.
import type { HistoryEvent, Ref, World } from "../kernel/index.ts";
import {
  kindOfGroup,
  politiesOf,
  underworldOf,
  type CrimeGroup,
  type Federation,
  type GoneGroup,
  type Operation,
  type Polity,
} from "../sim/index.ts";
import { GROUP_KINDS, type GroupKind } from "../rules/index.ts";
import { defineWatchKind, groupWords } from "../causal/index.ts";

export const groupRef = (realm: string, event: string): string => `mob:${realm}:${event}`;
export const fedRef = (realm: string, event: string): string => `gfed:${realm}:${event}`;
export const opRef = (realm: string, event: string): string => `uop:${realm}:${event}`;
const REF = /^(mob|gfed|uop):(pol:\d+:\d+):(ev:\d+:\d+)$/;

/** A group's or a federation's ref's parts (null: not one). */
export function parseUnderRef(
  ref: string,
): { what: "mob" | "gfed" | "uop"; realm: Ref; event: Ref } | null {
  const m = REF.exec(ref);
  return m
    ? { what: m[1] as "mob" | "gfed" | "uop", realm: m[2] as Ref, event: m[3] as Ref }
    : null;
}
export const isUnderRef = (ref: string): boolean => REF.test(ref);

/** A crime group as history keeps it: its record while it holds, how its hold ended once it is gone. */
export type GroupRead = {
  readonly ref: string;
  readonly realm: Polity;
  readonly name: string;
  readonly kind: GroupKind;
  readonly event: Ref;
  readonly record: Readonly<CrimeGroup> | null;
  readonly gone: GoneGroup | null;
};

/** A federation as history keeps it: its record while it stands (null once its gangs no longer hold together). */
export type FedRead = {
  readonly ref: string;
  readonly realm: Polity;
  readonly name: string;
  readonly event: Ref;
  readonly record: Readonly<Federation> | null;
};

type Risen = { group?: string; kind?: string; federation?: string } | null | undefined;

export function groupOf(world: World, ref: string): GroupRead | null {
  const at = parseUnderRef(ref),
    r = at && at.what === "mob" ? politiesOf(world).get(at.realm) : undefined;
  if (!at || !r) return null;
  const v = underworldOf(world)?.of(r.ref),
    record = v?.groups.find((g) => g.event === at.event) ?? null,
    gone = record ? null : (v?.gone.find((g) => g.rose === at.event) ?? null),
    risen = world.events.get(at.event)?.data as Risen,
    name = record?.name ?? gone?.name ?? risen?.group ?? null;
  if (!name) return null;
  const kind = record
    ? kindOfGroup(record)
    : gone
      ? (GROUP_KINDS[gone.kind] ?? "protection")
      : ((risen?.kind as GroupKind | undefined) ?? "protection");
  return { ref: groupRef(r.ref, at.event), realm: r, name, kind, event: at.event, record, gone };
}

export function fedOf(world: World, ref: string): FedRead | null {
  const at = parseUnderRef(ref),
    r = at && at.what === "gfed" ? politiesOf(world).get(at.realm) : undefined;
  if (!at || !r) return null;
  const record =
      underworldOf(world)
        ?.of(r.ref)
        ?.feds.find((f) => f.event === at.event) ?? null,
    name = record?.name ?? (world.events.get(at.event)?.data as Risen)?.federation ?? null;
  return name ? { ref: fedRef(r.ref, at.event), realm: r, name, event: at.event, record } : null;
}

/** What a group or federation is called: "the Vorath family", "the Asha cartel", "the Kesh federation". */
export function underName(world: World, ref: string): string | null {
  if (ref.startsWith("uop:")) {
    const o = opOf(world, ref);
    return o ? `the soldiers sent against ${groupWords(o.op.name, GROUP_KINDS[o.op.kind])}` : null;
  }
  if (ref.startsWith("mob:")) {
    const g = groupOf(world, ref);
    return g ? groupWords(g.name, g.kind) : null;
  }
  const f = fedOf(world, ref);
  return f ? `the ${f.name} federation` : null;
}

/** Whether an event is news of a group: its own, or one that names it. */
export function groupNews(g: GroupRead): (e: HistoryEvent) => boolean {
  const realm = g.realm.ref,
    id = g.record?.id;
  return (e) => {
    if (!e.type.startsWith("underworld.") || !e.subjects.includes(realm)) return false;
    const d = e.data as {
      gids?: number[];
      group?: string;
      against?: string;
      of?: string;
      into?: string;
    } | null;
    if (!d) return false;
    if (id !== undefined && d.gids?.includes(id)) return true;
    return [d.group, d.against, d.of, d.into].includes(g.name);
  };
}

/** Whether an event is news of a federation. */
export function fedNews(f: FedRead): (e: HistoryEvent) => boolean {
  const realm = f.realm.ref,
    id = f.record?.id;
  return (e) => {
    if (!e.type.startsWith("underworld.") || !e.subjects.includes(realm)) return false;
    const d = e.data as { fids?: number[]; federation?: string; against?: string } | null;
    if (!d) return false;
    if (id !== undefined && d.fids?.includes(id)) return true;
    return d.federation === f.name || d.against === f.name;
  };
}

/** Soldiers sent against a group, by the event they were sent by (`uop:<realm>:<event>`; null: none such). */
export function opOf(world: World, ref: string): { realm: Polity; op: Readonly<Operation> } | null {
  const at = parseUnderRef(ref),
    r = at && at.what === "uop" ? politiesOf(world).get(at.realm) : undefined,
    op = r
      ? underworldOf(world)
          ?.of(r.ref)
          ?.ops?.find((o) => o.event === at!.event)
      : undefined;
  return r && op ? { realm: r, op } : null;
}

/** Whether an event is news of an operation: its own (sent, its clashes, a boss it took, how it ended). */
export function opNews(o: {
  realm: Polity;
  op: Readonly<Operation>;
}): (e: HistoryEvent) => boolean {
  const realm = o.realm.ref,
    id = o.op.id;
  return (e) =>
    e.type.startsWith("underworld.") &&
    e.subjects.includes(realm) &&
    !!(e.data as { oids?: number[] } | null)?.oids?.includes(id);
}

defineWatchKind({
  test: (ref) => isUnderRef(ref),
  label: (world, ref) => underName(world, ref),
  news: (world, w) => {
    if (w.ref.startsWith("uop:")) {
      const o = opOf(world, w.ref);
      return o ? opNews(o) : () => false;
    }
    if (w.ref.startsWith("mob:")) {
      const g = groupOf(world, w.ref);
      return g ? groupNews(g) : () => false;
    }
    const f = fedOf(world, w.ref);
    return f ? fedNews(f) : () => false;
  },
});
