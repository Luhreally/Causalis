// A fight of the underworld, read for watching (asked for 2026-11-16: "why cant I click to watch gang wars yet either? like they
// recorded but i cant watch?"): of an event that tells one — a war between two crime groups over a rent and its peace, a clash of
// the realm's soldiers with a group, soldiers sent in, a boss taken by them, two federations of street gangs standing against
// each other — who fought, how many of their men were in that land, what they carry, how many died and who came out holding it,
// from the event and the records kept of its groups. And the button that plays it, wherever such an event is told. Pure reads:
// nothing here is stored, and the scene drawn of it is the eye's.
import { parseRef, type HistoryEvent, type Ref, type World } from "../../kernel/index.ts";
import {
  STREET_FIGHT_TYPES,
  type Block,
  type StreetFight,
  type StreetFightSide,
} from "../../bridge/index.ts";
import { ESCALATE, GROUP_KINDS, type GroupKind } from "../../rules/index.ts";
import {
  bestMeans,
  kindOfGroup,
  politiesOf,
  populationContext,
  underworldOf,
  type CrimeGroup,
  type Federation,
  type GangWar,
  type Operation,
  type Polity,
  type RealmUnderworld,
  realmName,
} from "../../sim/index.ts";
import { groupWords } from "../../causal/index.ts";
import { holderColor, realmColor } from "../colors.ts";
import { hostKinds, realmArms } from "../arms.ts";
import { fedRef, groupRef, opRef } from "../underworld.ts";
import { orgOf, orgRef } from "../groups.ts";
import { peopleFigure } from "../folk.ts";
import { homePlanet } from "../../sim/index.ts";
import { organisedIn, orgsOf } from "../../sim/index.ts";
import { orgWords } from "../../causal/index.ts";
import { landTitle } from "./names.ts";
import { count, many, yearAt } from "./words.ts";
import { fightFallen } from "./townlife.ts";

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const TYPES = new Set(STREET_FIGHT_TYPES),
  ARMY = new Set(["underworld.clash", "underworld.operation", "underworld.army-took"]);
/** How far back a war's peace, or a land's latest fight, are looked for (events). */
const WALKED = 6000;

type Data = {
  group?: string;
  against?: string;
  federation?: string;
  gids?: number[];
  oids?: number[];
  fids?: number[];
  soldiers?: number;
  dead?: number;
  fallen?: number;
  boss?: string;
  successors?: number;
};

/** Whether an event is one a fight of the underworld is watched from (its type; streetFightOf says whether it can be). */
export const isFightEvent = (e: HistoryEvent | undefined): boolean => !!e && TYPES.has(e.type);

/** The button that plays a fight of the underworld from its event. */
export function watchFightTool(event: string, label = "▶ Watch it"): Block {
  return { type: "tool", tool: "watch.fight", args: { event, label } };
}

/** The land an event was told in (its realm's seat where it names none). */
const cellOf = (e: HistoryEvent, r: Polity): number => (e.place ? parseRef(e.place).b : r.seat);

/** A darker cast of a colour: a crew of the realm's own enforcers, in its colours but apart from its soldiers. */
const shade = (c: readonly number[]): [number, number, number] => [
  c[0]! * 0.55,
  c[1]! * 0.55,
  c[2]! * 0.55,
];

/** A group's men in one land: its men spread over the lands it holds (a crew of enforcers works its realm's towns whole). */
const menIn = (g: CrimeGroup): number =>
  kindOfGroup(g) === "badge" ? g.members : g.members / Math.max(1, g.lands.length);

/** A crime group as a side: its colour, its men in the land, what it carries (by its means, against its realm's soldiers'). */
function groupSide(
  world: World,
  r: Polity,
  v: Readonly<RealmUnderworld>,
  id: number | undefined,
  name: string,
  kind: GroupKind,
  fallen: number,
): StreetFightSide {
  const g = id !== undefined ? v.groups.find((x) => x.id === id) : undefined,
    gone = g ? undefined : v.gone.find((x) => x.name === name && GROUP_KINDS[x.kind] === kind),
    ref = g ? groupRef(r.ref, g.event) : gone ? groupRef(r.ref, gone.rose) : `${r.ref}#underworld`,
    badge = kind === "badge",
    realmHost = hostKinds(world, r.ref),
    m = g?.means,
    best = g ? bestMeans(populationContext(world), r, g.home) : null,
    a = m && best ? m.arms / 1000 / Math.max(0.01, best.arms) : 0,
    armoured = !!m && m.armour >= 300,
    gear = [
      ...(m && m.arms > 0
        ? [
            a > 1.02
              ? "arms better than the realm's soldiers'"
              : a >= 0.95
                ? "arms as good as the realm's soldiers"
                : a >= 0.5
                  ? "arms nearly as good as the realm's soldiers"
                  : "light arms",
          ]
        : badge
          ? ["the realm's own arms"]
          : ["what arms it could get"]),
      ...(m && m.armour > 0 ? [armoured ? "armoured carriers" : "some armour"] : []),
    ];
  return {
    ref,
    name: cap(groupWords(name, kind)),
    color: badge ? shade(realmColor(r.ref)) : holderColor(ref),
    as: badge ? "badge" : "gang",
    men: Math.round(g ? menIn(g) : 0),
    fallen: Math.round(fallen),
    arms: badge ? realmArms(world, r.ref) : null,
    // (On foot in the streets: no mounts. Its realm's arm where its arms come near the soldiers'; its guard where armoured.)
    host: {
      arm: badge || a >= 0.5 ? (realmHost?.arm ?? "club") : "club",
      guard: armoured ? (realmHost?.guard ?? "") : "",
      mount: "",
    },
    gear: gear.join(", "),
    ...(armoured ? { carriers: true } : {}),
  };
}

/** The realm's soldiers as a side: in its colours, with its arms, on foot. */
function soldierSide(world: World, r: Polity, o: Operation | undefined, fallen: number) {
  const host = hostKinds(world, r.ref);
  return {
    ref: o ? opRef(r.ref, o.event) : `${r.ref}#underworld`,
    name: cap(`${realmName(r)}'s soldiers`),
    color: realmColor(r.ref),
    as: "soldiers" as const,
    men: Math.round(o ? o.soldiers / Math.max(1, o.lands.length) : 0),
    fallen: Math.round(fallen),
    arms: realmArms(world, r.ref),
    host: host ? { ...host, mount: "" } : null,
    gear: "the realm's arms and colours",
  };
}

/** A federation's gangs as a side: their men in one of its towns' lands. */
function fedSide(r: Polity, f: Federation | undefined, name: string): StreetFightSide {
  const ref = f ? fedRef(r.ref, f.event) : `${r.ref}#underworld`;
  return {
    ref,
    name: `The ${name} federation`,
    color: holderColor(ref),
    as: "street",
    men: Math.round(f ? f.members / Math.max(1, f.towns.length) : 0),
    fallen: 0,
    arms: null,
    host: { arm: "club", guard: "", mount: "" },
    gear: "what its gangs carry",
  };
}

/** The latest event, walking back, that one with this test finds (null: none within the walk). */
export function lastEvent(world: World, test: (e: HistoryEvent) => boolean): HistoryEvent | null {
  const all = world.events.all();
  for (let i = all.length - 1, n = 0; i >= 0 && n < WALKED; i--, n++)
    if (test(all[i]!)) return all[i]!;
  return null;
}

/**
 * A fight of the underworld as history tells it, from its event (null: not one, or nothing kept to see it by — its realm or its
 * land gone with no town standing in it).
 */
export function streetFightOf(world: World, ref: string): StreetFight | null {
  const f = ref.startsWith("org:") ? preyingOf(world, ref) : readFight(world, ref);
  if (!f) return null;
  // (Two sides told apart at a glance: where their colours come near, the second's turned to the first's opposite.)
  const [a, b] = f.sides,
    near = Math.hypot(a.color[0] - b.color[0], a.color[1] - b.color[1], a.color[2] - b.color[2]),
    hi = Math.max(...a.color),
    lo = Math.min(...a.color),
    turned: [number, number, number] = [
      hi + lo - a.color[0],
      hi + lo - a.color[1],
      hi + lo - a.color[2],
    ];
  const figure = peopleFigure(homePlanet(world).generated);
  // (Against the realm's soldiers a group is always in their colour's opposite, and stronger: never mistaken for them.)
  const army = a.as === "soldiers",
    mid = (hi + lo) / 2,
    strong: [number, number, number] = [
      Math.max(0, Math.min(1, mid + (turned[0] - mid) * 1.8 - 0.06)),
      Math.max(0, Math.min(1, mid + (turned[1] - mid) * 1.8 - 0.06)),
      Math.max(0, Math.min(1, mid + (turned[2] - mid) * 1.8 - 0.06)),
    ];
  // (Those of the town's lines killed in it by name, where its roster has them: the same the fight's page lists.)
  const named = fightFallen(world, f),
    words = named.length
      ? {
          ...f.words,
          cost: `${f.words.cost.replace(/\.?$/, ".")} Of ${f.townName}'s own, by name: ${named
            .slice(0, 4)
            .map((m) => m.name)
            .join(", ")}${named.length > 4 ? `, and ${named.length - 4} more` : ""}.`,
        }
      : f.words;
  return {
    ...f,
    words,
    figure,
    ...(army
      ? { sides: [a, { ...b, color: strong }] as const }
      : near >= 0.4
        ? {}
        : { sides: [a, { ...b, color: turned }] as const }),
  };
}

function readFight(world: World, ref: string): StreetFight | null {
  const e = world.events.get(ref as Ref);
  if (!isFightEvent(e)) return null;
  const r = politiesOf(world).get(e!.subjects[0] as Ref),
    v = r ? underworldOf(world)?.of(r.ref) : undefined;
  if (!r || !v) return null;
  const cell = cellOf(e!, r),
    ctx = populationContext(world),
    town =
      [...ctx.settlements.inProvince(cell)]
        .filter((t) => t.population > 0)
        .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))[0] ?? null;
  if (!town) return null;
  const d = (e!.data ?? {}) as Data,
    year = yearAt(e!.t),
    base = {
      event: ref,
      year,
      cell,
      land: landTitle(world, cell),
      town: town.ref as string,
      townName: town.name,
    };

  // A war between two groups, from its start or its peace.
  if (e!.type === "underworld.war" || e!.type === "underworld.pax") {
    const start =
        e!.type === "underworld.war"
          ? e!
          : (e!.causes
              .map((c) => world.events.get(c.ref))
              .find((x) => x?.type === "underworld.war") ?? null),
      sd = (start?.data ?? d) as Data,
      w: GangWar | undefined = start ? v.wars.find((x) => x.event === start.id) : undefined,
      kind = (GROUP_KINDS[w?.kind ?? -1] ??
        (GROUP_KINDS as readonly string[]).find((k) => k === (sd as { kind?: string }).kind) ??
        "protection") as GroupKind,
      names = w?.names ?? [sd.group ?? "", sd.against ?? ""],
      [ia, ib] = sd.gids ?? [],
      peace =
        e!.type === "underworld.pax"
          ? e!
          : start && w?.ended != null
            ? lastEvent(
                world,
                (x) => x.type === "underworld.pax" && x.causes.some((c) => c.ref === start.id),
              )
            : null,
      dead = Math.round(w?.fallen ?? (peace?.data as Data | undefined)?.fallen ?? 0),
      holder = (peace?.data as Data | undefined)?.group,
      won = !peace ? null : holder === names[0] ? 0 : holder === names[1] ? 1 : null,
      a = groupSide(world, r, v, ia, names[0], kind, 0),
      b = groupSide(world, r, v, ib, names[1], kind, 0),
      // (History counts its dead together: each side's share as the other's men were to its own.)
      split = (a.men + b.men > 0 ? b.men / (a.men + b.men) : 0.5) * dead,
      sides = [
        { ...a, fallen: Math.round(split) },
        { ...b, fallen: dead - Math.round(split) },
      ] as const,
      open = !peace && w?.ended == null;
    return {
      ...base,
      page: start?.id ?? ref,
      kind: "turf",
      title: `${a.name} against ${b.name.replace(/^The /, "the ")}`,
      sides,
      others: 0,
      won,
      open,
      words: {
        what: `A war between two groups over the same rent, from year ${start ? yearAt(start.t) : year}${peace ? ` to year ${yearAt(peace.t)}` : ""}`,
        who: `${a.name}${a.men ? `, some ${count(a.men)} men in this land` : ""}; ${b.name.replace(/^The /, "the ")}${b.men ? `, some ${count(b.men)}` : ""}`,
        cost: dead >= 1 ? `Some ${count(dead)} dead, all told` : "Few dead",
        effect: open
          ? "Still fought as the world stands"
          : won !== null
            ? `${sides[won].name} came to hold the rent`
            : "It cooled with neither holding the rent alone",
      },
    };
  }

  // Soldiers and a group: sent, a clash, its boss taken.
  if (
    e!.type === "underworld.operation" ||
    e!.type === "underworld.clash" ||
    e!.type === "underworld.army-took"
  ) {
    const o = (v.ops ?? []).find((x) => x.id === d.oids?.[0]),
      kind = (GROUP_KINDS[o?.kind ?? -1] ?? "protection") as GroupKind,
      name = d.group ?? o?.name ?? "",
      gid = d.gids?.[0],
      dead = Math.round(d.dead ?? 0),
      lost = Math.min(dead, Math.round(d.soldiers ?? 0)),
      // (The rest: the group's men and those caught between, as the rule weighs them.)
      rest = e!.type === "underworld.clash" ? dead - lost : 0,
      others = Math.round((rest * ESCALATE.bystanders) / (1 + ESCALATE.bystanders)),
      soldiers = soldierSide(world, r, o, e!.type === "underworld.clash" ? lost : 0),
      g = groupSide(world, r, v, gid, name, kind, rest - others),
      sent = e!.type === "underworld.operation" ? Math.round(d.soldiers ?? 0) : 0;
    const men = sent ? Math.round(sent / Math.max(1, o?.lands.length ?? 1)) : soldiers.men;
    return {
      ...base,
      page: o ? opRef(r.ref, o.event) : ref,
      kind: "army",
      title: `${soldiers.name} against ${g.name.replace(/^The /, "the ")}`,
      sides: [{ ...soldiers, men }, g],
      others,
      won: e!.type === "underworld.army-took" ? 0 : null,
      open: !!o && o.ended === null,
      words: {
        what:
          e!.type === "underworld.operation"
            ? `${many(sent, "soldier", "soldiers")} sent into its quarters against ${g.name.replace(/^The /, "the ")}`
            : e!.type === "underworld.clash"
              ? `A year of clashes between the realm's soldiers and ${g.name.replace(/^The /, "the ")}`
              : `${g.name}'s boss, ${d.boss ?? "its head"}, taken by the soldiers`,
        who: `${soldiers.name}${men ? `, some ${count(men)} in this land` : ""}; ${g.name.replace(/^The /, "the ")}${g.men ? `, some ${count(g.men)} men` : ""}`,
        cost:
          e!.type === "underworld.clash"
            ? `${many(dead, "dead", "dead")}: ${count(lost)} of the soldiers, ${count(rest - others)} of the group's men, ${count(others)} caught between`
            : "No one's death is told of it",
        effect:
          e!.type === "underworld.army-took"
            ? `${many(d.successors ?? 0, "man", "men")} came forward to take his place`
            : o && o.ended !== null
              ? `The soldiers stayed until year ${o.ended}`
              : "The soldiers still hold their posts",
      },
    };
  }

  // A crew of the realm's own enforcers found out: its year's killing of those it hunted.
  if (e!.type === "underworld.exposed") {
    const killed = Math.round((e!.data as { killed?: number }).killed ?? 0),
      squad = !!(e!.data as { squad?: number }).squad,
      crewName = d.group ?? "",
      b = v.groups.find((x) => kindOfGroup(x) === "badge" && x.name === crewName),
      crew = groupSide(world, r, v, b?.id, crewName, "badge", 0),
      hunted: StreetFightSide = {
        ref: `${r.ref}#underworld`,
        name: "Those it hunted",
        color: [0.5, 0.46, 0.4],
        as: "street",
        men: killed,
        fallen: killed,
        arms: null,
        host: { arm: "club", guard: "", mount: "" },
        gear: "what they had to hand",
      };
    return {
      ...base,
      page: ref,
      kind: "badge",
      title: `${crew.name} and those it hunted`,
      sides: [{ ...crew, men: Math.max(crew.men, Math.ceil(killed / 4), 4) }, hunted],
      others: 0,
      won: null,
      open: false,
      words: {
        what: squad
          ? "A death squad of the realm's own enforcers, found out"
          : "A crew of the realm's own enforcers, found out",
        who: `${crew.name}, in the realm's colours and acting for itself; those it hunted, outside the law`,
        cost: killed >= 1 ? `${many(killed, "killed", "killed")} that year` : "Few killed",
        effect: "It was found out, purged and made again",
      },
    };
  }

  // Two federations of street gangs, set against each other.
  const [fa, fb] = d.fids ?? [],
    A = v.feds.find((x) => x.id === fa),
    B = v.feds.find((x) => x.id === fb),
    a = fedSide(r, A, d.federation ?? A?.name ?? ""),
    b = fedSide(r, B, d.against ?? B?.name ?? "");
  return {
    ...base,
    page: ref,
    kind: "street",
    title: `${a.name} against ${b.name.replace(/^The /, "the ")}`,
    sides: [a, b],
    others: 0,
    won: null,
    open: !!A && !!B && A.rival === B.id,
    words: {
      what: "Two federations of street gangs came to stand against each other in the same towns",
      who: `${a.name}${a.men ? `, some ${count(a.men)} of its young in this land` : ""}; ${b.name.replace(/^The /, "the ")}${b.men ? `, some ${count(b.men)}` : ""}`,
      cost: "History counts no one's death of it alone",
      effect:
        !!A && !!B && A.rival === B.id
          ? "They still stand against each other"
          : "They no longer stand against each other",
    },
  };
}

/** The latest fight of the underworld told in a land, of these kinds (null: none within the walk), for its marks in the land view. */
export function lastFightIn(
  world: World,
  provinceRef: string,
  kinds: readonly string[],
): string | null {
  return lastEvent(world, (x) => x.place === provinceRef && kinds.includes(x.type))?.id ?? null;
}

/**
 * A group's preying of the latest year (brigands on a road, pirates off a coast), from its page's ref: no event tells it, so it is
 * read off what is kept of the group — its men, those it kills and loses a year, what it takes — in the land of its lands where
 * the most is preyed on (null: not such a group, or none of its lands is preyed on, or no town stands there).
 */
function preyingOf(world: World, ref: string): StreetFight | null {
  const g = orgOf(world, ref),
    rec = g?.record;
  if (!g || !rec || (g.kind !== "brigands" && g.kind !== "pirates")) return null;
  const sea = g.kind === "pirates",
    ctx = populationContext(world),
    lands = rec.lands
      .map((c) => {
        const row = organisedIn(world, c);
        return { c, prey: (sea ? row?.seaPrey : row?.prey) ?? 0 };
      })
      .filter(
        (x) => x.prey >= 0.001 && ctx.settlements.inProvince(x.c).some((t) => t.population > 0),
      )
      .sort((a, b) => b.prey - a.prey || a.c - b.c),
    at = lands[0];
  if (!at) return null;
  const town = [...ctx.settlements.inProvince(at.c)]
      .filter((t) => t.population > 0)
      .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))[0]!,
    name = cap(orgWords(rec.name, g.kind)),
    men = Math.max(2, Math.round(rec.members / Math.max(1, rec.lands.length))),
    dead = Math.round(rec.violence / Math.max(1, rec.lands.length)),
    // (History keeps its killing and its losses as one number: halved between them here.)
    lost = Math.floor(dead / 2),
    raiders: StreetFightSide = {
      ref,
      name,
      color: holderColor(ref),
      as: "gang",
      men,
      fallen: lost,
      arms: null,
      host: { arm: hostKinds(world, g.realm.ref)?.arm ?? "club", guard: "", mount: "" },
      gear: "what arms it could get",
    },
    prey: StreetFightSide = {
      ref: `cell:0:${at.c}#underworld`,
      name: sea ? "Those who trade by its coast" : "Those who trade by its road",
      color: [0.52, 0.48, 0.38],
      as: "street",
      men: Math.max(4, men),
      fallen: dead - lost,
      arms: null,
      host: { arm: "club", guard: "", mount: "" },
      gear: "what they carried",
    },
    year = yearAt(world.now) - 1;
  return {
    event: ref,
    page: ref,
    kind: "raid",
    title: `${name} on ${sea ? "the coast" : "the road"} of ${landTitle(world, at.c)}`,
    year,
    cell: at.c,
    land: landTitle(world, at.c),
    town: town.ref as string,
    townName: town.name,
    sides: [raiders, prey],
    others: 0,
    won: null,
    open: true,
    words: {
      what: `A year of its preying on trade ${sea ? "off the coast" : "on the road"} here, as its record stands`,
      who: `${name}, some ${count(men)} in this land; those who trade here`,
      cost: `${at.prey >= 0.01 ? Math.round(at.prey * 100) : +(at.prey * 100).toFixed(1)}% of the ${sea ? "sea" : "road"} trade here taken a year${dead >= 1 ? `, some ${count(dead)} dead` : ""}`,
      effect: "The trade here shrinks, and holdings are the less safe",
    },
  };
}

/**
 * A land's latest fights of the underworld (one walk back; null: none in it): the killing (a war between groups, two
 * federations, a clash) and the soldiers' (a clash, their coming, a boss taken), for its marks in the land view.
 */
export function lastFights(
  world: World,
  province: string,
): { watchKill: string | null; watchArmy: string | null } {
  let watchKill: string | null = null,
    watchArmy: string | null = null;
  const all = world.events.all();
  for (let i = all.length - 1, n = 0; i >= 0 && n < WALKED && !(watchKill && watchArmy); i--, n++) {
    const e = all[i]!;
    if (e.place !== province || !TYPES.has(e.type)) continue;
    const army = ARMY.has(e.type);
    if (army) watchArmy ??= e.id;
    if (!army || e.type === "underworld.clash") watchKill ??= e.id;
  }
  return { watchKill, watchArmy };
}

/**
 * The latest fights of the underworld the record tells, of a kind (any, unasked), those with dead first where asked: for the look
 * tools and the gates to find one to watch. A walk back of so many events.
 */
export function latestFights(
  world: World,
  most: number,
  kind?: string,
  dead = false,
): { event: string; kind: string; town: string; dead: number }[] {
  const all = world.events.all(),
    out: { event: string; kind: string; town: string; dead: number }[] = [];
  // (A group's preying is told by no event: read off the groups that prey, the most men first.)
  if (kind === "raid") {
    for (const r of politiesOf(world).all()) {
      if (r.ended !== null) continue;
      for (const g of orgsOf(world)?.of(r.ref)?.orgs ?? []) {
        const f = streetFightOf(world, orgRef(r.ref, g.event));
        if (!f) continue;
        out.push({
          event: f.event,
          kind: f.kind,
          town: f.town,
          dead: f.sides[0].fallen + f.sides[1].fallen,
        });
      }
    }
    return out
      .filter((x) => !dead || x.dead > 0)
      .sort((a, b) => b.dead - a.dead || (a.event < b.event ? -1 : 1))
      .slice(0, most);
  }
  // (A kind asked for is looked for through the whole record: a look tool's question, asked once.)
  const far = kind ? all.length : 4 * WALKED;
  for (let i = all.length - 1, n = 0; i >= 0 && n < far && out.length < most; i--, n++) {
    const e = all[i]!;
    if (!TYPES.has(e.type)) continue;
    const f = streetFightOf(world, e.id);
    if (!f || (kind && f.kind !== kind)) continue;
    const d = f.sides[0].fallen + f.sides[1].fallen + f.others;
    if (dead && d <= 0) continue;
    out.push({ event: e.id, kind: f.kind, town: f.town, dead: d });
  }
  return out;
}

export const STREET_FIGHT_QUERIES = {
  "underworld.fight": (world: World, args: unknown) =>
    streetFightOf(world, (args as { event: string }).event),
  "underworld.fights": (world: World, args: unknown) => {
    const a = (args ?? {}) as { most?: number; kind?: string; dead?: boolean };
    return latestFights(world, Math.min(20, a.most ?? 5), a.kind, a.dead ?? false);
  },
};
