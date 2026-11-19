// Everyone the world keeps by name, read one way. The sim keeps persons in several places, each for what they do there: a
// realm's ruler (sim/polity), those who stand near its seat (sim/court), the heads of its groups under the law and outside it
// (sim/order groups and underworld), its envoys of the last few years (sim/war/ties), and those its people know for what they did
// (sim/notable). Nothing is copied: this reads each where it is kept and gives them one shape, so a page, a search or a rule that
// wants "the persons of this realm" asks once. One the notables keep who is also of a court (their `as`) is given once, as the
// notable, with the court's ref beside.
import type { Ref, World } from "../kernel/index.ts";
import { DOMAINS, NOTE } from "../rules/index.ts";
import {
  courtOf,
  firstField,
  notablesOf,
  orgsOf,
  politiesOf,
  realmName,
  tiesOf,
  underworldOf,
  type Polity,
} from "../sim/index.ts";
import { notableTitle } from "../causal/index.ts";
import { namedRef } from "./inspect/notables.ts";
import { landTitle } from "./inspect/names.ts";
import { yearNow } from "./inspect/words.ts";

export type PersonOfNote = {
  /** Their page. */
  readonly ref: string;
  /** Where the world keeps them. */
  readonly kept: "ruler" | "court" | "head" | "boss" | "envoy" | "named";
  readonly name: string;
  readonly title: string;
  readonly born: number | null;
  readonly realm: Ref | null;
  /** Their land (null: the world keeps none for them). */
  readonly cell: number | null;
  /** What they are known for, where the world reads it off a deed (rules DOMAINS). */
  readonly domain?: string;
  /** Their standing in lines (1: what it takes to be known by name), where the world keeps one. */
  readonly standing?: number;
  /** Another place the world keeps the same one (a notable who is of a court). */
  readonly also?: string;
};

/** A realm's persons: its ruler, its court, the heads of its groups, its envoys abroad, and those its lands know by name. */
export function personsOfRealm(world: World, r: Polity): PersonOfNote[] {
  const out: PersonOfNote[] = [],
    name = realmName(r),
    year = yearNow(world),
    kept = notablesOf(world),
    named = kept ? r.members.flatMap((c) => [...kept.in(c)]) : [],
    commander = kept?.holder("command", r.ref);
  if (commander && !named.includes(commander)) named.push(commander);
  const asCourt = new Set(named.map((n) => n.as).filter((a): a is string => !!a)),
    // (One of name who took the seat is its ruler: given once, as the ruler, their own page beside.)
    seated = named.find((n) => n.as === "rule" && n.name === r.ruler.name);
  out.push({
    ref: `rule:${r.ref}`,
    kept: "ruler",
    name: r.ruler.name,
    title: `ruler of ${name}`,
    born: r.ruler.born,
    realm: r.ref,
    cell: r.seat,
    ...(seated ? { also: namedRef(seated.id) } : {}),
  });
  for (const f of courtOf(world)?.of(r.ref)?.figures ?? []) {
    if (asCourt.has(`court:${f.id}`)) continue;
    out.push({
      ref: `court:${r.ref}:${f.id}`,
      kept: "court",
      name: f.name,
      title: `of the court of ${name}, for ${f.seat === "house" ? "its house" : f.seat}`,
      born: f.born,
      realm: r.ref,
      cell: r.seat,
    });
  }
  for (const g of orgsOf(world)?.of(r.ref)?.orgs ?? [])
    out.push({
      ref: `boss:${r.ref}:${g.event}`,
      kept: "head",
      name: g.leader.name,
      title: `head of the ${g.name}, of ${name}`,
      born: g.leader.born,
      realm: r.ref,
      cell: g.home,
    });
  for (const g of underworldOf(world)?.of(r.ref)?.groups ?? [])
    out.push({
      ref: `boss:${r.ref}:${g.event}`,
      kept: "boss",
      name: g.boss.name,
      title: `boss of the ${g.name}, of ${name}`,
      born: g.boss.born,
      realm: r.ref,
      cell: g.home,
    });
  if (world.hasStore("war.ties"))
    for (const e of tiesOf(world).envoys()) {
      if (e.from !== r.ref || e.year < year - 3) continue;
      const to = politiesOf(world).get(e.to);
      out.push({
        ref: e.event,
        kept: "envoy",
        name: e.name,
        title: `envoy of ${name}${to ? ` to ${realmName(to)}` : ""}`,
        born: null,
        realm: r.ref,
        cell: null,
      });
    }
  for (const n of named) {
    if (n === seated) continue;
    out.push({
      ref: namedRef(n.id),
      kept: "named",
      name: n.name,
      title: notableTitle(world, n, name, landTitle(world, n.home, true)),
      born: n.born,
      realm: r.ref,
      cell: n.home,
      domain: DOMAINS[firstField(n)]!,
      standing: n.standing / NOTE.line,
      ...(n.as?.startsWith("court:") ? { also: n.as.replace("court:", `court:${r.ref}:`) } : {}),
    });
  }
  return out;
}

/** Every person a world keeps by name: each living realm's, and those of name in lands no realm holds. */
export function personsOfNote(world: World): PersonOfNote[] {
  const out: PersonOfNote[] = [],
    realms = politiesOf(world);
  for (const r of realms.living()) out.push(...personsOfRealm(world, r));
  for (const n of notablesOf(world)?.all() ?? []) {
    if (realms.of(n.home) || n.post) continue;
    out.push({
      ref: namedRef(n.id),
      kept: "named",
      name: n.name,
      title: notableTitle(world, n, null, landTitle(world, n.home, true)),
      born: n.born,
      realm: null,
      cell: n.home,
      domain: DOMAINS[firstField(n)]!,
      standing: n.standing / NOTE.line,
    });
  }
  return out;
}
