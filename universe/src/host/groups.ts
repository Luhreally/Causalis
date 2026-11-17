// The groups as the host knows them (sim/order/groups.ts): each by a ref of its own, made of the event it rose by
// (`org:<realm>:<event>` a group, `ofed:<realm>:<event>` a federation of them), so one whose hold has ended is still found; what is
// news of it; and how it is followed and kept on the people bar, as a family is. Pure reads.
import type { HistoryEvent, Ref, World } from "../kernel/index.ts";
import {
  kindName,
  orgsOf,
  politiesOf,
  type GoneOrg,
  type Org,
  type OrgFed,
  type Polity,
} from "../sim/index.ts";
import { ORG_KINDS, type OrgKind } from "../rules/index.ts";
import { defineWatchKind, orgWords } from "../causal/index.ts";

export const orgRef = (realm: string, event: string): string => `org:${realm}:${event}`;
export const orgFedRef = (realm: string, event: string): string => `ofed:${realm}:${event}`;
const REF = /^(org|ofed):(pol:\d+:\d+):(ev:\d+:\d+)$/;

/** A group's or a federation's ref's parts (null: not one). */
export function parseOrgRef(ref: string): { what: "org" | "ofed"; realm: Ref; event: Ref } | null {
  const m = REF.exec(ref);
  return m ? { what: m[1] as "org" | "ofed", realm: m[2] as Ref, event: m[3] as Ref } : null;
}
export const isOrgRef = (ref: string): boolean => REF.test(ref);

/** A group as history keeps it: its record while it holds, how its hold ended once it is gone. */
export type OrgRead = {
  readonly ref: string;
  readonly realm: Polity;
  readonly name: string;
  readonly kind: OrgKind;
  readonly event: Ref;
  readonly record: Readonly<Org> | null;
  readonly gone: GoneOrg | null;
};

export type OrgFedRead = {
  readonly ref: string;
  readonly realm: Polity;
  readonly name: string;
  readonly event: Ref;
  readonly record: Readonly<OrgFed> | null;
};

type Risen = { group?: string; kind?: string; federation?: string } | null | undefined;

export function orgOf(world: World, ref: string): OrgRead | null {
  const at = parseOrgRef(ref),
    r = at && at.what === "org" ? politiesOf(world).get(at.realm) : undefined;
  if (!at || !r) return null;
  const v = orgsOf(world)?.of(r.ref),
    record = v?.orgs.find((g) => g.event === at.event) ?? null,
    gone = record ? null : (v?.gone.find((g) => g.rose === at.event) ?? null),
    risen = world.events.get(at.event)?.data as Risen,
    name = record?.name ?? gone?.name ?? risen?.group ?? null;
  if (!name) return null;
  const kind = record
    ? kindName(record)
    : gone
      ? (ORG_KINDS[gone.kind] ?? "brotherhood")
      : ((risen?.kind as OrgKind | undefined) ?? "brotherhood");
  return { ref: orgRef(r.ref, at.event), realm: r, name, kind, event: at.event, record, gone };
}

export function orgFedOf(world: World, ref: string): OrgFedRead | null {
  const at = parseOrgRef(ref),
    r = at && at.what === "ofed" ? politiesOf(world).get(at.realm) : undefined;
  if (!at || !r) return null;
  const record =
      orgsOf(world)
        ?.of(r.ref)
        ?.feds.find((f) => f.event === at.event) ?? null,
    name = record?.name ?? (world.events.get(at.event)?.data as Risen)?.federation ?? null;
  return name ? { ref: orgFedRef(r.ref, at.event), realm: r, name, event: at.event, record } : null;
}

/** What a group or federation is called: "the Vorath pirates", "the Kesh federation". */
export function orgName(world: World, ref: string): string | null {
  if (ref.startsWith("org:")) {
    const g = orgOf(world, ref);
    return g ? orgWords(g.name, g.kind) : null;
  }
  const f = orgFedOf(world, ref);
  return f ? `the ${f.name} federation` : null;
}

/** Whether an event is news of a group: its own, or one that names it. */
export function orgNews(g: OrgRead): (e: HistoryEvent) => boolean {
  const realm = g.realm.ref,
    id = g.record?.id;
  return (e) => {
    if (!e.type.startsWith("groups.") || !e.subjects.includes(realm)) return false;
    const d = e.data as { gids?: number[]; group?: string; into?: string } | null;
    if (!d) return false;
    if (id !== undefined && d.gids?.includes(id)) return true;
    return d.group === g.name || d.into === g.name;
  };
}

/** Whether an event is news of a federation. */
export function orgFedNews(f: OrgFedRead): (e: HistoryEvent) => boolean {
  const realm = f.realm.ref,
    id = f.record?.id;
  return (e) => {
    if (!e.type.startsWith("groups.") || !e.subjects.includes(realm)) return false;
    const d = e.data as { fids?: number[]; federation?: string } | null;
    if (!d) return false;
    if (id !== undefined && d.fids?.includes(id)) return true;
    return d.federation === f.name;
  };
}

defineWatchKind({
  test: (ref) => isOrgRef(ref),
  label: (world, ref) => orgName(world, ref),
  news: (world, w) => {
    if (w.ref.startsWith("org:")) {
      const g = orgOf(world, w.ref);
      return g ? orgNews(g) : () => false;
    }
    const f = orgFedOf(world, w.ref);
    return f ? orgFedNews(f) : () => false;
  },
});
