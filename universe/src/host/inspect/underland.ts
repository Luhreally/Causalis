// A land's underworld, in one place (asked 2026-11-16: "the land tab should also have a underworld tab just so its quicker to find
// the town but whatever else is relevant to know and land view too of underworld"): its towns first, each a press from its law page,
// with its cases this year and what weighs on its peace; who holds it, crime group by group, with their bosses, killing, protection,
// means and what they carry; the realm's own enforcers working it; the other groups in it (brigands on its roads, pirates off its
// coast, militias, sects, maroons…) with their hold, aim and effect; its numbers (what slips past, how organised the carriers, who
// needs what they take and how strong it has grown, who has no roof) and what its realm does about it; and what has passed here
// lately. And what the land view draws of it: the turf of its towns in its holder's colour, its killing and its enforcers marked,
// brigands on its roads and pirates off its coast. It reads, it never touches: every number is a store's.
import { carryBlocks } from "./carriers.ts";
import type { Ref, World } from "../../kernel/index.ts";
import type { Block, Item, LandUnderworld, Stat } from "../../bridge/index.ts";
import { GROUP_KINDS, ORG_AIMS, ORG_STANDING, type OrgAim } from "../../rules/index.ts";
import {
  BAR,
  BAR_STORE,
  GANG_ROW,
  INTOX,
  INTOX_STORE,
  ORG_ROW,
  ROOFLESS_STORE,
  ROOF_ROW,
  SMUGGLE,
  SMUGGLE_STORE,
  gangsStore,
  groupsIn,
  kindName,
  kindOfGroup,
  moneyStore,
  orgAimOf,
  orgLandsStore,
  organisedIn,
  orgsOf,
  politiesOf,
  populationContext,
  societyStore,
  soldiersIn,
  underworldOf,
  type CrimeGroup,
  type Operation,
  type Org,
  type Polity,
} from "../../sim/index.ts";
import { groupWords, orgWords } from "../../causal/index.ts";
import { holderColor } from "../colors.ts";
import { isFightEvent, lastFights, streetFightOf, watchFightTool } from "./streetfight.ts";
import { fedRef, groupRef, opRef } from "../underworld.ts";
import { orgRef } from "../groups.ts";
import { AIM_WORDS } from "./groups.ts";
import { kindLine, potencyWords, racketsOf } from "./mobs.ts";
import { townWrong } from "./justice.ts";
import { realmLink } from "./names.ts";
import { claimOf, count, item, link, many, part, stat, yearAt, yearNow } from "./words.ts";

/** A share, a small one to a tenth of one in a hundred. */
const pc = (x: number) =>
    x > 0 && x < 0.001
      ? "under 0.1%"
      : x < 0.1
        ? `${+(x * 100).toFixed(1)}%`
        : `${Math.round(x * 100)}%`,
  th = (n: number) => pc(n / 1000),
  cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s),
  per100k = (v: number) => `${+v.toFixed(1)} a year in 100,000`;

/** The most of a land's towns told one by one (the rest counted); the most events walked back, and told. */
export const TOWNS_TOLD = 12;
const EVENTS_WALKED = 4000,
  EVENTS_TOLD = 8,
  /** The fights of those told shown each with its button. */
  FIGHTS_SHOWN = 3;

/** The events of the underworld and the groups, and of what feeds them. */
const UNDER_EVENTS = /^(underworld|groups)\.|^money\.(cartel|smuggling|stronger|made-forms)$/;

/** Every realm's crime groups holding any part of a land (a badge crew works its realm's towns, so any land of its realm). */
function crimeGroupsIn(world: World, cell: number): { r: Polity; g: CrimeGroup }[] {
  const store = underworldOf(world);
  if (!store) return [];
  const realms = politiesOf(world),
    own = realms.of(cell),
    out: { r: Polity; g: CrimeGroup }[] = [];
  for (const ref of store.realmsKept()) {
    const r = realms.get(ref as Ref);
    if (!r) continue;
    for (const g of store.of(ref)!.groups)
      if (g.lands.includes(cell) || (kindOfGroup(g) === "badge" && own?.ref === ref))
        out.push({ r, g });
  }
  return out.sort((a, b) => b.g.power - a.g.power || a.g.id - b.g.id);
}

/** A realm's operations under way in a land, the greatest first. */
function operationsIn(world: World, r: Polity, cell: number): Operation[] {
  return [...(underworldOf(world)?.of(r.ref)?.ops ?? [])]
    .filter((o) => o.ended === null && o.lands.includes(cell))
    .sort((a, b) => b.soldiers - a.soldiers || a.id - b.id);
}

/** Every realm's groups holding any part of a land, or at home there. */
function orgsIn(world: World, cell: number): { r: Polity; g: Org }[] {
  const store = orgsOf(world);
  if (!store) return [];
  const realms = politiesOf(world),
    out: { r: Polity; g: Org }[] = [];
  for (const ref of store.realmsKept()) {
    const r = realms.get(ref as Ref);
    if (!r) continue;
    for (const g of store.of(ref)!.orgs)
      if (g.home === cell || g.lands.includes(cell)) out.push({ r, g });
  }
  return out.sort((a, b) => b.g.power - a.g.power || a.g.id - b.g.id);
}

/** What a group's first aim does to a land, as its row keeps it (null: nothing kept of it). */
function aimHere(world: World, cell: number, aim: OrgAim): string | null {
  const row = orgLandsStore(world)?.get(cell);
  if (!row) return null;
  const v = (k: number) => row[k]!;
  switch (aim) {
    case "prey":
      return v(ORG_ROW.prey) || v(ORG_ROW.seaPrey)
        ? [
            v(ORG_ROW.prey) ? `${th(v(ORG_ROW.prey))} of its road trade taken a year` : "",
            v(ORG_ROW.seaPrey) ? `${th(v(ORG_ROW.seaPrey))} of its sea trade` : "",
          ]
            .filter(Boolean)
            .join(", ")
        : null;
    case "guard":
      return v(ORG_ROW.guard) ? `its roads ${th(v(ORG_ROW.guard))} guarded by its own` : null;
    case "enforce":
    case "rule":
    case "lend":
      return v(ORG_ROW.fills) ? `${th(v(ORG_ROW.fills))} of what its courts leave undone` : null;
    case "aid":
      return v(ORG_ROW.spared) || v(ORG_ROW.sheltered)
        ? `${th(v(ORG_ROW.spared))} of its deaths spared, ${th(v(ORG_ROW.sheltered))} of its roofless taken in`
        : null;
    case "worship":
      return v(ORG_ROW.sect) ? `a pull of ${th(v(ORG_ROW.sect))} from its seat's faith` : null;
    case "rebel":
      return v(ORG_ROW.rising) ? `its rising ${th(v(ORG_ROW.rising))} organised` : null;
    case "conspire":
      return v(ORG_ROW.plot) ? `its plotters ${th(v(ORG_ROW.plot))} organised` : null;
    case "refuge":
      return v(ORG_ROW.refuge) ? `held ${th(v(ORG_ROW.refuge))} apart as a refuge` : null;
    case "inquire":
      return v(ORG_ROW.inquire) ? `its learned ${th(v(ORG_ROW.inquire))} bound by letters` : null;
    default:
      return v(ORG_ROW.thins) ? `its seat's reach thinned by ${th(v(ORG_ROW.thins))}` : null;
  }
}

/** What a crime group holds to its work: its means, in a few words. */
function meansWords(g: CrimeGroup): string | null {
  const m = g.means;
  if (!m) return null;
  const out = [
    m.arms > 0 ? "arms" : "",
    m.armour > 0 ? "armour" : "",
    m.hidden > 0 ? "hidden carriage" : "",
    m.word > 0 ? "guarded word" : "",
  ].filter(Boolean);
  return out.length ? out.join(", ") : null;
}

/** A land's Underworld tab (one honest line where nothing is kept). */
export function landUnderworldBlocks(world: World, cell: number): Block[] {
  const ctx = populationContext(world),
    prov = ctx.provinces.get(cell);
  if (!prov) return [];
  const year = yearNow(world),
    realm = politiesOf(world).of(cell),
    living = realm && realm.ended === null ? realm : undefined,
    gangs = groupsIn(world, cell),
    orgRow = organisedIn(world, cell),
    under = living ? underworldOf(world)?.of(living.ref) : undefined,
    blocks: Block[] = [];

  // Its towns first, each a press from its law page.
  const towns = ctx.settlements
    .inProvince(cell)
    .filter((t) => t.population > 0)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1));
  if (towns.length) {
    const rows: Stat[] = towns.slice(0, TOWNS_TOLD).map((t) => {
      if (t.founded >= year)
        return stat(t.name, [link("new this year: no court sits yet", `${t.ref}#law`)]);
      const w = townWrong(world, t, year),
        most = [...w.pressing].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0];
      return stat(t.name, [link(many(w.due, "case", "cases"), `${t.ref}#law`), " this year"], {
        parts: [
          part("what weighs on its peace", `${w.weigh.toFixed(2)} (0.50 a quiet year)`),
          ...(most ? [part("most of it", most[0])] : []),
          part("its people", count(t.population)),
        ],
      });
    });
    if (towns.length > TOWNS_TOLD)
      rows.push(stat("Smaller towns", `${count(towns.length - TOWNS_TOLD)} more`));
    // (Its street's gangs and their federations are the land's, as the underworld keeps them.)
    if (gangs && gangs.gangs > 0) {
      const feds = [GANG_ROW.fedA, GANG_ROW.fedB]
        .map((i) => gangsStore(world)?.at(cell, i) ?? 0)
        .filter((x) => x > 0)
        .flatMap((x) => {
          const f = under?.feds.find((y) => y.id === x - 1);
          return f && living ? [f] : [];
        });
      rows.push(
        stat("Its street", many(gangs.gangs, "small gang", "small gangs"), {
          parts: [
            part("their pull on its young men", pc(gangs.street)),
            ...feds.map((f) =>
              part([link(`the ${f.name} federation`, fedRef(living!.ref, f.event))], "allies them"),
            ),
          ],
        }),
      );
    }
    blocks.push({ type: "facts", title: "Its towns, and the law in each", rows });
  }

  // Who holds it: every crime group with any part of it.
  const crime = crimeGroupsIn(world, cell),
    holders = crime.filter(({ g }) => kindOfGroup(g) !== "badge"),
    badges = crime.filter(({ g }) => kindOfGroup(g) === "badge");
  if (holders.length) {
    blocks.push({
      type: "facts",
      title: "Who holds it",
      rows: holders.map(({ r, g }) => {
        const strongest = gangs?.group === g.id && politiesOf(world).of(cell)?.ref === r.ref,
          means = meansWords(g),
          carries = kindOfGroup(g) === "cartel" ? potencyWords(world, r.ref)?.strength : undefined;
        return stat(
          cap(groupWords(g.name, kindOfGroup(g))),
          [link(cap(kindLine(g)), groupRef(r.ref, g.event))],
          {
            why: g.event,
            parts: [
              part("its hold here", strongest && gangs ? pc(gangs.control) : "a part"),
              part("its boss", `${g.boss.name}, since year ${g.boss.since}`),
              ...(strongest && gangs
                ? [
                    part("killed here", per100k(gangs.violence)),
                    part("of the trade under its protection", pc(gangs.protection)),
                  ]
                : [
                    part(
                      "the killing it does and suffers",
                      `${count(Math.round(g.violence))} a year`,
                    ),
                  ]),
              ...(means ? [part("its means", means)] : []),
              part("what it lives on", racketsOf(g.rackets).join(", ") || "little yet"),
              ...(carries ? [part("what it carries", `what is forbidden, ${carries}`)] : []),
            ],
          },
        );
      }),
    });
  }
  // Who carries each ware its realm's borders let through unseen, here (carriers.ts).
  if (living) blocks.push(...carryBlocks(world, living, cell));
  // The soldiers its realm has sent against the groups here (the underworld's operations).
  const ops = living ? operationsIn(world, living, cell) : [];
  if (ops.length)
    blocks.push({
      type: "facts",
      title: "Soldiers sent against them",
      rows: [
        stat("Here now", many(soldiersIn(world, living!.ref, cell), "soldier", "soldiers")),
        ...ops.map((o) =>
          stat(
            `Since year ${o.since}`,
            [
              link(
                `against ${groupWords(o.name, GROUP_KINDS[o.kind])}`,
                opRef(living!.ref, o.event),
              ),
            ],
            {
              why: o.event,
              parts: [
                part("its soldiers, across its lands", count(o.soldiers)),
                part("the group's men taken or killed", count(Math.round(o.taken))),
                part("others killed", count(Math.round(o.bystanders))),
                part("driven from their homes", count(Math.round(o.displaced))),
              ],
            },
          ),
        ),
      ],
    });
  // The realm's own enforcers, where a crew of them works it.
  if (gangs && gangs.badge > 0 && badges.length)
    blocks.push({
      type: "facts",
      title: "The realm's own enforcers",
      rows: badges.map(({ r, g }) =>
        stat(cap(groupWords(g.name, "badge")), [link(cap(kindLine(g)), groupRef(r.ref, g.event))], {
          why: g.event,
          parts: [
            part("how far it works this land", pc(gangs.badge)),
            part("what it lives on", racketsOf(g.rackets).join(", ") || "its pay"),
            part("the killing it does and suffers", `${count(Math.round(g.violence))} a year`),
          ],
        }),
      ),
    });

  // The other groups in it: brigands, pirates, militias, sects, maroons and the rest.
  const orgs = orgsIn(world, cell);
  if (orgs.length)
    blocks.push({
      type: "facts",
      title: "Other groups in it",
      rows: orgs.map(({ r, g }) => {
        const aim = orgAimOf(g),
          here = aimHere(world, cell, aim),
          strongest = orgRow?.group === g.id && politiesOf(world).of(cell)?.ref === r.ref;
        return stat(
          cap(orgWords(g.name, kindName(g))),
          [link(cap(AIM_WORDS[aim] ?? ORG_AIMS[g.aim] ?? "its own"), orgRef(r.ref, g.event))],
          {
            why: g.event,
            parts: [
              part(
                "its hold here",
                strongest && orgRow ? pc(orgRow.hold) : g.home === cell ? "its home" : "a part",
              ),
              part("its realm holds it", ORG_STANDING[g.standing] ?? "let be"),
              ...(here ? [part("what it does here", here)] : []),
              ...(g.violence >= 1
                ? [
                    part(
                      "the killing it does and suffers",
                      `${count(Math.round(g.violence))} a year`,
                    ),
                  ]
                : []),
            ],
          },
        );
      }),
    });

  // Its numbers, and what its realm does about it.
  const numbers: Stat[] = [];
  if (living) {
    const sm = moneyStore(world, SMUGGLE_STORE)?.get(living.ref),
      bar = moneyStore(world, BAR_STORE)?.get(living.ref),
      strong = potencyWords(world, living.ref);
    if (sm && sm[SMUGGLE.share]! > 0)
      numbers.push(
        stat(
          "Slips past its realm's borders",
          [link(`${th(sm[SMUGGLE.share]!)} of what it bars or taxes`, `${living.ref}#treasury`)],
          {
            parts: [
              part("the wedge", th(sm[SMUGGLE.wedge]!)),
              part("smuggled a year", `${count(sm[SMUGGLE.worth]!)} grain's worth`),
            ],
          },
        ),
      );
    if (bar && bar[BAR.cartel]! > 0)
      numbers.push(
        stat("Those who carry what it forbids, organised", th(bar[BAR.cartel]!), {
          parts: [part("how far it forbids them", th(bar[BAR.barred]!))],
        }),
      );
    if (strong)
      numbers.push(
        stat("How strong what is carried", strong.strength, { parts: [part("why", strong.why)] }),
      );
  }
  const ix = moneyStore(world, INTOX_STORE)?.get(cell);
  if (ix && ix[INTOX.dependent]! > 0)
    numbers.push(
      stat(
        "Who need what they take",
        [link(`${th(ix[INTOX.dependent]!)} of its people`, `cell:0:${cell}#wealth`)],
        {
          parts: [
            part(
              "who die of it a year",
              `${+(ix[INTOX.deaths]! / 10_000).toFixed(2)}% of its people`,
            ),
          ],
        },
      ),
    );
  const rf = societyStore(world, ROOFLESS_STORE)?.get(cell);
  if (rf && rf[ROOF_ROW.street]! > 0) {
    const why = (
      [
        ["whose earnings can't meet the least rent", rf[ROOF_ROW.rent]!],
        ["beyond the homes raised", rf[ROOF_ROW.beyond]!],
        ["turned out by war, fire or flood", rf[ROOF_ROW.displaced]!],
        ["who need what they take", rf[ROOF_ROW.addicted]!],
        ["frail, kept by no one", rf[ROOF_ROW.old]!],
      ] as const
    )
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    numbers.push(
      stat(
        "On the street",
        [link(`${th(rf[ROOF_ROW.street]!)} of its towns' people`, `cell:0:${cell}#lives`)],
        {
          parts: why.map(([w, v]) => part(w, th(v))),
        },
      ),
    );
  }
  if (living && under)
    numbers.push(
      stat(
        "What its realm does",
        [
          link(
            under.crackdown >= 50
              ? `a crackdown of ${th(under.crackdown)}, biting ${th(under.bites)}`
              : under.collusion >= 100
                ? `its officers ${th(under.collusion)} bought`
                : "little",
            `${living.ref}#underworld`,
          ),
          " in ",
          realmLink(world, living.ref),
        ],
        {
          parts: [
            part("officers and judges bought", th(under.collusion)),
            part(
              "the killing in its lands",
              `${count(under.killings + under.street + under.badge)} a year`,
            ),
          ],
        },
      ),
    );
  if (numbers.length) blocks.push({ type: "facts", title: "Its numbers", rows: numbers });

  // What has passed here lately: a short walk back through the record.
  const refs = new Set([
      `cell:0:${cell}`,
      prov.ref as string,
      ...towns.map((t) => t.ref as string),
    ]),
    all = world.events.all(),
    passed: Item[] = [],
    fights: string[] = [];
  for (
    let i = all.length - 1, n = 0;
    i >= 0 && n < EVENTS_WALKED && passed.length < EVENTS_TOLD;
    i--, n++
  ) {
    const e = all[i]!;
    if (!UNDER_EVENTS.test(e.type)) continue;
    if (!(e.place && refs.has(e.place)) && !e.subjects.some((s) => refs.has(s))) continue;
    const y = yearAt(e.t);
    passed.push(item([`Year ${y}: `, link(claimOf(world, e.id), e.id)], e.id, y));
    if (isFightEvent(e) && fights.length < FIGHTS_SHOWN) fights.push(e.id);
  }
  if (passed.length)
    blocks.push({
      type: "list",
      title: "What has passed here lately",
      items: [
        ...passed,
        item([link("Every year, in the Years", "world:chronicle#years")], "world:chronicle#years"),
      ],
    });
  // (Its fights, the latest few, each played in the streets of its town: 2026-11-16.)
  for (const ref of fights) {
    const f = streetFightOf(world, ref);
    if (f)
      blocks.push(
        watchFightTool(ref, `▶ Watch ${f.title.replace(/^The /, "the ")}, year ${f.year}`),
      );
  }

  // (Nothing kept but its towns' courts: one honest line.)
  const told =
    holders.length +
    orgs.length +
    numbers.length +
    passed.length +
    (gangs && (gangs.gangs > 0 || gangs.badge > 0) ? 1 : 0);
  if (!told)
    return [
      ...blocks,
      {
        type: "text",
        lines: [
          [
            towns.length
              ? "No group holds any part of it, no gangs are kept on its streets, and nothing forbidden is counted here: its towns' courts are all there is to tell."
              : "No one keeps a town here, and no group holds any part of it: there is no underworld to tell.",
          ],
        ],
      },
    ];
  return blocks;
}

/** A land's underworld as the land view draws it (null: not a land of the people). */
export function landUnderworld(world: World, cell: number): LandUnderworld | null {
  if (!populationContext(world).provinces.get(cell)) return null;
  const realm = politiesOf(world).of(cell),
    gangs = groupsIn(world, cell),
    orgRow = organisedIn(world, cell),
    crime = crimeGroupsIn(world, cell),
    top =
      gangs && gangs.group !== null && realm
        ? crime.find(({ r, g }) => r.ref === realm.ref && g.id === gangs.group)
        : undefined,
    orgs = orgsIn(world, cell),
    topOrg =
      orgRow && orgRow.group !== null && realm
        ? orgs.find(({ r, g }) => r.ref === realm.ref && g.id === orgRow.group)
        : undefined,
    badge = crime.find(({ g }) => kindOfGroup(g) === "badge"),
    living = realm && realm.ended === null ? realm : undefined,
    op = living ? operationsIn(world, living, cell)[0] : undefined,
    preying = (k: string) =>
      orgs.find(
        ({ g }) =>
          kindName(g) === k ||
          (k === "brigands" &&
            orgAimOf(g) === "prey" &&
            kindName(g) !== "pirates" &&
            kindName(g) !== "privateers"),
      ),
    brig = preying("brigands"),
    pir = orgs.find(({ g }) => kindName(g) === "pirates" || kindName(g) === "privateers");
  const holder = top
    ? {
        ref: groupRef(top.r.ref, top.g.event),
        name: cap(groupWords(top.g.name, kindOfGroup(top.g))),
        hold: gangs!.control,
      }
    : topOrg && orgRow && orgRow.hold > 0
      ? {
          ref: orgRef(topOrg.r.ref, topOrg.g.event),
          name: cap(orgWords(topOrg.g.name, kindName(topOrg.g))),
          hold: orgRow.hold,
        }
      : null;
  return {
    cell,
    holder: holder && holder.hold > 0 ? { ...holder, color: holderColor(holder.ref) } : null,
    killing: (gangs?.violence ?? 0) + (orgRow?.violence ?? 0),
    badge: gangs?.badge ?? 0,
    badgeRef: badge && (gangs?.badge ?? 0) > 0 ? groupRef(badge.r.ref, badge.g.event) : null,
    soldiers: living ? soldiersIn(world, living.ref, cell) : 0,
    soldiersRef: op && living ? opRef(living.ref, op.event) : null,
    ...lastFights(world, populationContext(world).provinces.get(cell)!.ref),
    prey: orgRow?.prey ?? 0,
    seaPrey: orgRow?.seaPrey ?? 0,
    brigands:
      brig && (orgRow?.prey ?? 0) > 0
        ? {
            ref: orgRef(brig.r.ref, brig.g.event),
            name: cap(orgWords(brig.g.name, kindName(brig.g))),
            watch: streetFightOf(world, orgRef(brig.r.ref, brig.g.event)) !== null,
          }
        : null,
    pirates:
      pir && (orgRow?.seaPrey ?? 0) > 0
        ? {
            ref: orgRef(pir.r.ref, pir.g.event),
            name: cap(orgWords(pir.g.name, kindName(pir.g))),
            watch: streetFightOf(world, orgRef(pir.r.ref, pir.g.event)) !== null,
          }
        : null,
  };
}
