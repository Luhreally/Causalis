// Families (asked 2026-11-16: "id also like to pin familes if possible too"): a realm's great house (round H, sim/order/houses.ts)
// and a town's line (host/kin.ts), each by a ref of its own, with who heads it now, who is of it, and what is news of it. A house
// is known by the event it rose by (`dyn:<realm>:<event>`), which its record keeps and the event its hold ended by names, so a
// house gone from the great is still found. A line is known by its town and number (`line:<town>:<line>`): whoever holds it now
// heads it. Pure reads: nothing is kept.
import type { HistoryEvent, Ref, World } from "../kernel/index.ts";
import {
  courtOf,
  housesOf,
  originOf,
  politiesOf,
  type CourtFigure,
  type GoneHouse,
  type HouseRecord,
  type Polity,
} from "../sim/index.ts";
import { courtRef } from "./court.ts";
import { isUnderRef, underName } from "./underworld.ts";
import { isOrgRef, orgName } from "./groups.ts";
import { townLine, type TownLine } from "./kin.ts";
import type { Holder } from "./roster.ts";

/** A realm's great house's ref, by the event it rose by. */
export const houseRef = (realm: string, event: string): string => `dyn:${realm}:${event}`;
/** A house's ref's parts (null: not one). */
export function parseHouseRef(ref: string): { realm: Ref; event: Ref } | null {
  const m = /^dyn:(pol:\d+:\d+):(ev:\d+:\d+)$/.exec(ref);
  return m ? { realm: m[1] as Ref, event: m[2] as Ref } : null;
}
/** A town's line's ref. */
export const lineRef = (town: string, line: number): string => `line:${town}:${line}`;
/** A line's ref's parts (null: not one). */
export function parseLineRef(ref: string): { town: string; line: number } | null {
  const m = /^line:(town:\d+:\d+):(\d+)$/.exec(ref);
  return m ? { town: m[1]!, line: Number(m[2]) } : null;
}
/** Whether a ref is a family's. */
export const isFamilyRef = (ref: string): boolean =>
  ref.startsWith("dyn:") || ref.startsWith("line:") || isUnderRef(ref) || isOrgRef(ref);

const surname = (name: string) => name.split(" ").slice(1).join(" ");

/** A great house as history keeps it: its record while it holds, how its hold ended once it is gone. */
export type HouseRead = {
  readonly ref: string;
  readonly realm: Polity;
  readonly name: string;
  readonly event: Ref;
  readonly record: Readonly<HouseRecord> | null;
  readonly gone: GoneHouse | null;
  /** The other houses of its realm now. */
  readonly houses: readonly Readonly<HouseRecord>[];
};

/** The event a house that is gone rose by: the one its end stood on. */
export function roseBy(world: World, g: GoneHouse): Ref | null {
  const end = world.events.get(g.event);
  for (const c of end?.causes ?? []) {
    if (c.role !== "enabler") continue;
    const e = world.events.get(c.ref);
    if (e && e.type.startsWith("houses.")) return c.ref;
  }
  return null;
}

/** A house by its ref (null: none such). */
export function houseOf(world: World, ref: string): HouseRead | null {
  const at = parseHouseRef(ref),
    r = at ? politiesOf(world).get(at.realm) : undefined;
  if (!at || !r) return null;
  const v = housesOf(world)?.of(r.ref),
    record = v?.houses.find((h) => h.event === at.event) ?? null,
    gone = record ? null : (v?.gone.find((g) => roseBy(world, g) === at.event) ?? null),
    risen = world.events.get(at.event)?.data as { house?: string } | null | undefined,
    name = record?.name ?? gone?.name ?? risen?.house ?? null;
  if (!name) return null;
  return {
    ref: houseRef(r.ref, at.event),
    realm: r,
    name,
    event: at.event,
    record,
    gone,
    houses: v?.houses ?? [],
  };
}

/** The house a realm's ruler or one of its court is of, where one of its great houses bears their name. */
export function houseOfName(world: World, realm: Ref, name: string): string | null {
  const v = housesOf(world)?.of(realm),
    family = surname(name);
  if (!v || !family) return null;
  const h =
    v.houses.find((x) => x.name === family && x.crown) ??
    v.houses.find((x) => x.name === family && originOf(x) !== "cadet") ??
    v.houses.find((x) => x.name === family);
  return h ? houseRef(realm, h.event) : null;
}

/** One of a family: their page, name, and what they are to it. */
export type FamilyMember = { readonly ref: string; readonly name: string; readonly role: string };

const seatOf = (f: CourtFigure) =>
  f.seat === "house" ? "of the ruler's house, at court" : `the voice of ${f.seat} at court`;

/** Who of a house history names, its head first: the ruler (where it holds the seat), then those at court who bear its name. */
export function houseMembers(world: World, h: HouseRead): FamilyMember[] {
  if (!h.record) return [];
  const r = h.realm,
    out: FamilyMember[] = [];
  if (h.record.crown && r.ended === null && surname(r.ruler.name) === h.name)
    out.push({ ref: `rule:${r.ref}`, name: r.ruler.name, role: `rules ${r.town}` });
  const c = courtOf(world)?.of(r.ref),
    origin = originOf(h.record),
    figures = (c?.figures ?? [])
      .filter((f) => surname(f.name) === h.name && (h.record!.crown || f.seat !== "house"))
      .sort(
        (a, b) =>
          Number(b.seat === origin) - Number(a.seat === origin) || a.born - b.born || a.id - b.id,
      );
  for (const f of figures) out.push({ ref: courtRef(r.ref, f.id), name: f.name, role: seatOf(f) });
  return out;
}

/** A town's line with its ref. */
export type LineRead = TownLine & { readonly ref: string };

/** A town's line by its ref (null: none such). */
export function lineOf(world: World, ref: string): LineRead | null {
  const at = parseLineRef(ref),
    t = at ? townLine(world, at.town, at.line) : null;
  return t ? { ...t, ref: lineRef(t.town, t.line) } : null;
}

/** Who of a line history names: its holder now, then those who held it before, the latest first. */
export function lineMembers(l: LineRead): FamilyMember[] {
  const one = (h: Holder, role: string): FamilyMember => ({
    ref: h.ref,
    name: l.nameOf(h),
    role,
  });
  return [
    ...(l.holder ? [one(l.holder, "holds the line now")] : []),
    ...l.before.map((h) => one(h, `held it ${h.from}–${h.end - 1}`)),
  ];
}

/** What a family is called: "the house of Vorath", "the Torrin line of Asha". */
export function familyName(world: World, ref: string): string | null {
  // (A crime group or a street federation: kept on the bar and followed as a family is, by its name.)
  if (isUnderRef(ref)) return underName(world, ref);
  // (A group of the general layer, or a federation of them: sim/order/groups.ts.)
  if (isOrgRef(ref)) return orgName(world, ref);
  const h = ref.startsWith("dyn:") ? houseOf(world, ref) : null;
  if (h) return `the house of ${h.name}`;
  const l = ref.startsWith("line:") ? lineOf(world, ref) : null;
  return l ? `the ${l.house} line of ${l.townName}` : null;
}

/** Who heads a family now (null: no one history names; a house gone from the great, a line standing empty). */
export function familyHead(world: World, ref: string): FamilyMember | null {
  // (A group's boss is a name and a birth year, not a person history keeps a page of.)
  if (isUnderRef(ref) || isOrgRef(ref)) return null;
  const h = ref.startsWith("dyn:") ? houseOf(world, ref) : null;
  if (h) return houseMembers(world, h)[0] ?? null;
  const l = ref.startsWith("line:") ? lineOf(world, ref) : null;
  return l ? (lineMembers(l)[0] ?? null) : null;
}

/** Whether an event is news of a house: its own (risen, wed, purged, faded…), or one that names one of it. */
export function houseNews(world: World, h: HouseRead): (e: HistoryEvent) => boolean {
  const r = h.realm.ref,
    figs = new Set(
      (courtOf(world)?.of(r)?.figures ?? [])
        .filter((f) => surname(f.name) === h.name)
        .map((f) => f.id),
    );
  return (e) => {
    if (!e.subjects.includes(r)) return false;
    const d = e.data as Record<string, unknown> | null;
    if (!d) return false;
    if (e.type.startsWith("houses."))
      return d.house === h.name || d.into === h.name || d.of === h.name;
    if (typeof d.fig === "number" && figs.has(d.fig)) return true;
    // (A ruler of it dead, a seat taken from it or by it: its name in the words of the event.)
    for (const k of ["old", "to", "who", "ruler"] as const) {
      const v = d[k];
      if (typeof v === "string" && surname(v) === h.name) return true;
    }
    return false;
  };
}

/** The events of a line's holders, now and before: their battles, the fires and quakes that struck them. */
export function lineEvents(l: LineRead): Set<string> {
  const out = new Set<string>();
  for (const h of [...(l.holder ? [l.holder] : []), ...l.before]) {
    for (const f of h.fates) out.add(f.event);
    for (const s of h.struck) out.add(s.event);
  }
  return out;
}
