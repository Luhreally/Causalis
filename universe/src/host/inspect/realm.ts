// The pages of power (Phase 10 M91): a realm — its lands and people, how it is ruled and by
// whom, its wars, its regard for others and what it knows — two realms' regard, a war with
// its battles and its two hosts, a battle, and a war between the stars.
import { cellRef, offworldSite } from "../../gen/index.ts";
import {
  designsOf,
  diplomacyOf,
  homePlanet,
  loreOf,
  politiesOf,
  populationContext,
  realmName,
  relationRef,
  starWarsOf,
  warsOf,
  WAR_EVENTS,
} from "../../sim/index.ts";
import { designWords } from "../../rules/index.ts";
import { governmentWords, principleName, standingWords } from "../../causal/index.ts";
import { type Ref, type World } from "../../kernel/index.ts";
import type { Block, Item, PageModel, Place, Row, Stat, Tab } from "../../bridge/index.ts";
import { realmColor } from "../colors.ts";
import { civilizationsNear } from "../../sim/index.ts";
import {
  claimOf,
  count,
  eventsAbout,
  item,
  link,
  many,
  part,
  share,
  stat,
  yearAt,
  yearNow,
} from "./words.ts";
import { landLink, landTitle, realmLink, spotOfLand, townLink } from "./names.ts";

/** Where a realm is to be seen: its seat, on the globe. */
export function realmPlace(world: World, ref: string): Place | null {
  const r = politiesOf(world).get(ref as Ref);
  if (!r) return null;
  const spot = spotOfLand(world, r.seat);
  return spot === null ? null : { scale: "globe", spot };
}

/** A realm's page. */
export function realmPageModel(world: World, ref: string): PageModel {
  const realms = politiesOf(world),
    r = realms.get(ref as Ref);
  if (!r) throw new Error(`no realm ${ref}`);
  const ctx = populationContext(world),
    g = homePlanet(world).generated,
    year = yearNow(world),
    peopleOf = (c: number) => ctx.provinces.get(c)?.total() ?? 0,
    people = r.members.reduce((s, c) => s + peopleOf(c), 0),
    offworld = r.members.filter((c) => offworldSite(g, c)).length,
    seatTown = ctx.settlements.inProvince(r.seat).find((t) => t.name === r.town),
    fighting = warsOf(world).fighting(r.ref),
    host = designsOf(world).of(r.ref);
  const stats: Stat[] = [
    stat("Lands", count(r.members.length), {
      parts: [
        part("on the world", count(r.members.length - offworld)),
        ...(offworld ? [part("beyond it", count(offworld))] : []),
      ],
    }),
    stat("People", count(people), { why: r.ref }),
    stat("Ruler", `${r.ruler.name}`, { why: r.ruler.event }),
    stat("At war", fighting.length ? many(fighting.length, "war", "wars") : "at peace"),
    stat("Tithe", `${Math.round(r.tribute * 100)}%`, { why: r.tithed ?? r.event }),
  ];
  const tabs: Tab[] = [];
  tabs.push({
    id: "overview",
    name: "Overview",
    blocks: [
      {
        type: "facts",
        rows: [
          stat(
            "Seat",
            seatTown
              ? [townLink(world, seatTown.ref), ", ", landLink(world, r.seat)]
              : [landLink(world, r.seat)],
          ),
          stat("Founded", `year ${r.founded}`, { why: r.event }),
          stat("Rule", governmentWords(r)),
          stat("Ruler", `${r.ruler.name}, since year ${r.ruler.since}`, { why: r.ruler.event }),
          stat("Tithe", `${Math.round(r.tribute * 100)}% of each land's grain to the seat`, {
            why: r.tithed ?? null,
          }),
          ...(host
            ? [stat("Its host", [link(designWords(host.parts), host.ref)], { why: host.ref })]
            : []),
          ...(r.ended !== null ? [stat("Fell", `year ${r.ended}`)] : []),
        ],
      },
      { type: "why", title: "How it came to be", ref: r.ref },
    ],
  });
  // Its lands, most peopled first.
  {
    const rows: Row[] = [...r.members]
      .sort((a, b) => peopleOf(b) - peopleOf(a) || a - b)
      .map((c) => {
        const d = realms.discontent(c);
        return {
          ref: cellRef(0, c),
          cells: [[landLink(world, c)], [count(peopleOf(c))], [share(Math.min(1, d.level))]],
          keys: [landTitle(world, c), peopleOf(c), d.level],
        };
      });
    tabs.push({
      id: "lands",
      name: "Lands",
      blocks: [{ type: "table", columns: ["Land", "People", "Grievance"], rows }],
    });
  }
  // Its rulers, newest first.
  {
    const items: Item[] = [],
      events = world.events.all();
    for (let i = events.length - 1; i >= 0 && items.length < 12; i--) {
      const e = events[i]!;
      if (e.type === "polity.succession" && e.subjects[0] === r.ref)
        items.push(
          item([`Year ${yearAt(e.t)}: `, link(claimOf(world, e.id), e.id)], e.id, yearAt(e.t)),
        );
    }
    tabs.push({
      id: "rulers",
      name: "Rulers",
      blocks: [{ type: "list", title: "Who ruled, newest first", items }],
    });
  }
  // Its wars.
  {
    const items: Item[] = warsOf(world)
      .all()
      .filter((w) => w.attacker === r.ref || w.defender === r.ref)
      .reverse()
      .map((w) => {
        const other = w.attacker === r.ref ? w.defender : w.attacker;
        return item(
          [
            link(`${w.attacker === r.ref ? "Against" : "Defending against"} `, w.ref),
            realmLink(world, other),
            ` — year ${w.declared}${w.ended !== null ? `–${w.ended}` : ", still fought"}, ${many(w.battles.length, "battle", "battles")}`,
          ],
          w.ref,
          w.declared,
        );
      });
    tabs.push({ id: "wars", name: "Wars", blocks: [{ type: "list", items }] });
  }
  // Its regard for others.
  {
    const rows: Row[] = diplomacyOf(world)
      .of(r.ref)
      .map((x) => {
        const other = x.a === r.ref ? x.b : x.a;
        return {
          ref: relationRef(x.a, x.b),
          cells: [
            [realmLink(world, other)],
            [link(standingWords(x.opinion, !!x.pact), relationRef(x.a, x.b))],
            [x.pact ? "sworn" : ""],
          ],
          keys: [realms.get(other) ? realmName(realms.get(other)!) : "", x.opinion, x.pact ? 1 : 0],
        };
      })
      .sort((a, b) => (b.keys![1] as number) - (a.keys![1] as number));
    tabs.push({
      id: "diplomacy",
      name: "Diplomacy",
      blocks: [
        {
          type: "table",
          title: "Their regard for others",
          columns: ["Realm", "Regard", "Pact"],
          rows,
        },
      ],
    });
  }
  // What its seat knows.
  {
    const items = loreOf(world)
      .of(r.seat)
      .map(([id, k]) => ({ id, k }))
      .sort((a, b) => b.k.year - a.k.year)
      .map(({ id, k }) =>
        item([link(principleName(id), k.event), ` — year ${k.year}`], k.event, k.year),
      );
    tabs.push({
      id: "lore",
      name: "Lore",
      blocks: [{ type: "list", title: "What its seat knows, newest first", items }],
    });
  }
  {
    const items = eventsAbout(world, [r.ref], 30, 3);
    if (items.length)
      tabs.push({ id: "history", name: "History", blocks: [{ type: "list", items }] });
  }
  return {
    ref: r.ref,
    kind: "realm",
    icon: "👑",
    title: sentenceRealm(realmName(r)),
    subtitle: [
      governmentWords(r),
      " · seat ",
      seatTown ? townLink(world, seatTown.ref) : landLink(world, r.seat),
    ],
    color: realmColor(r.ref),
    place: realmPlace(world, r.ref),
    stats,
    tabs,
    followable: true,
    year,
  };
}

function sentenceRealm(name: string): string {
  return name[0]!.toUpperCase() + name.slice(1);
}

/** Two realms' regard for one another (`rel:A:B`). */
export function relationPage(world: World, ref: string): PageModel {
  const [, a, b] = ref.split(":"),
    ra = `pol:0:${a}` as Ref,
    rb = `pol:0:${b}` as Ref,
    x = diplomacyOf(world).get(ra, rb);
  if (!x) throw new Error(`no regard ${ref}`);
  const year = yearNow(world),
    terms = diplomacyOf(world).remembered(ra, rb, year),
    both = world.events
      .all()
      .filter((e) => e.subjects.includes(ra) && e.subjects.includes(rb))
      .slice(-24)
      .reverse()
      .map((e) =>
        item([`Year ${yearAt(e.t)}: `, link(claimOf(world, e.id), e.id)], e.id, yearAt(e.t)),
      );
  return {
    ref,
    kind: "relation",
    icon: "🤝",
    title: "Two realms' regard",
    subtitle: [realmLink(world, ra), " and ", realmLink(world, rb)],
    color: null,
    place: realmPlace(world, ra),
    stats: [
      stat("Regard", standingWords(x.opinion, !!x.pact), {
        why: ref,
        parts: terms.map((t) =>
          part(
            [t.source ? link(t.name, t.source) : t.name],
            `${t.value > 0 ? "+" : ""}${t.value.toFixed(2)}`,
          ),
        ),
      }),
      stat("Pact", x.pact ? "sworn" : "none", { why: x.pact }),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "list",
            title: "What each remembers of the other",
            items: terms.map((t) =>
              item(
                [
                  t.source ? link(t.name, t.source) : t.name,
                  ` (${t.value > 0 ? "+" : ""}${t.value.toFixed(2)})`,
                ],
                t.source,
              ),
            ),
          },
          { type: "why", ref },
        ],
      },
      ...(both.length
        ? [{ id: "history", name: "History", blocks: [{ type: "list" as const, items: both }] }]
        : []),
    ],
    followable: false,
    year,
  };
}

/** Where a war is to be seen: its latest battle's land, or the land it is fought for. */
function warPlace(
  world: World,
  w: { prize: number; battles: readonly { land: number }[] },
): Place | null {
  const land = w.battles.at(-1)?.land ?? w.prize,
    spot = spotOfLand(world, land);
  return spot === null ? null : { scale: "globe", spot };
}

/** A war: its sides, what it is for, its battles and fallen, its two hosts and how it ended. */
export function warPage(world: World, ref: string, tab?: string): PageModel {
  const w = warsOf(world).get(ref as Ref);
  if (!w) throw new Error(`no war ${ref}`);
  const realms = politiesOf(world),
    a = realms.get(w.attacker),
    d = realms.get(w.defender),
    year = yearNow(world),
    name = (r: typeof a, fallback: string) => (r ? r.town : fallback),
    title = `The war of ${name(a, "the fallen")} upon ${name(d, "the fallen")}`;
  // The attacker's host sets out from its land nearest what it wants.
  const g = homePlanet(world).generated,
    grid = g.fine.grid,
    near = (x: number, y: number) => {
      const p = grid.positions,
        sx = spotOfLand(world, x),
        sy = spotOfLand(world, y);
      if (sx === null || sy === null) return -Infinity;
      return (
        p[sx * 3]! * p[sy * 3]! + p[sx * 3 + 1]! * p[sy * 3 + 1]! + p[sx * 3 + 2]! * p[sy * 3 + 2]!
      );
    };
  let from = -1,
    best = -Infinity;
  for (const m of a?.members ?? []) {
    if (m === w.prize) continue;
    const k = near(m, w.prize);
    if (k > best) {
      best = k;
      from = m;
    }
  }
  const won = w.battles.filter((b) => b.won).length,
    fallen = w.fallen[0] + w.fallen[1];
  const stats: Stat[] = [
    stat("Declared", `year ${w.declared}`, { why: w.event }),
    stat("For", [landLink(world, w.prize)]),
    stat("Battles", count(w.battles.length), {
      parts: [
        part([realmLink(world, w.attacker), " won"], count(won)),
        part([realmLink(world, w.defender), " held"], count(w.battles.length - won)),
      ],
    }),
    stat("Fallen", count(fallen), {
      parts: [
        part([realmLink(world, w.attacker)], count(w.fallen[0])),
        part([realmLink(world, w.defender)], count(w.fallen[1])),
      ],
    }),
    stat("Now", w.ended === null ? "still fought" : `ended in year ${w.ended}`, { why: w.peace }),
  ];
  const battleRows: Row[] = [...w.battles].reverse().map((b) => ({
    ref: b.event,
    cells: [
      [link(`year ${b.year}`, b.event)],
      [landLink(world, b.land)],
      [b.won ? name(a, "the attacker") : name(d, "the defender")],
      [count(b.fallen[0] + b.fallen[1])],
    ],
    keys: [b.year, landTitle(world, b.land), b.won ? 1 : 0, b.fallen[0] + b.fallen[1]],
  }));
  const hostOf = (side: "attacker" | "defender"): Block[] => {
    const realm = side === "attacker" ? w.attacker : w.defender,
      design = designsOf(world).of(realm),
      lost = side === "attacker" ? w.fallen[0] : w.fallen[1];
    return [
      {
        type: "facts",
        rows: [
          stat("Of", [realmLink(world, realm)], { why: realm }),
          ...(design
            ? [
                stat("Armed with", [link(designWords(design.parts), design.ref)], {
                  why: design.ref,
                }),
              ]
            : []),
          stat("Fallen", count(lost)),
          side === "attacker"
            ? stat(
                "Marches",
                from >= 0
                  ? ["from ", landLink(world, from), " for ", landLink(world, w.prize)]
                  : ["for ", landLink(world, w.prize)],
              )
            : stat("Stands", ["at ", landLink(world, w.prize)]),
        ],
      },
    ];
  };
  const tabs: Tab[] = [
    {
      id: "overview",
      name: "Overview",
      blocks: [
        {
          type: "facts",
          rows: [
            stat("Attacker", [realmLink(world, w.attacker)], { why: w.attacker }),
            stat("Defender", [realmLink(world, w.defender)], { why: w.defender }),
            stat("For", [landLink(world, w.prize)]),
            stat("Declared", `year ${w.declared}`, { why: w.event }),
            ...(w.peace
              ? [stat("Peace", [link(claimOf(world, w.peace), w.peace)], { why: w.peace })]
              : []),
            ...(w.embargo
              ? [stat("Embargo", [link("trade between them cut", w.embargo)], { why: w.embargo })]
              : []),
          ],
        },
        { type: "why", title: "Why it was fought", ref: w.ref },
      ],
    },
    {
      id: "battles",
      name: "Battles",
      blocks: [{ type: "table", columns: ["When", "Where", "Won by", "Fallen"], rows: battleRows }],
    },
    { id: "attacker", name: "Attacking host", blocks: hostOf("attacker") },
    { id: "defender", name: "Defending host", blocks: hostOf("defender") },
  ];
  {
    const items = eventsAbout(world, [w.ref], 30);
    if (items.length)
      tabs.push({ id: "history", name: "History", blocks: [{ type: "list", items }] });
  }
  return {
    ref: w.ref,
    kind: "war",
    icon: "⚔️",
    title,
    subtitle: [realmLink(world, w.attacker), " against ", realmLink(world, w.defender)],
    color: realmColor(w.attacker),
    place: warPlace(world, w),
    stats,
    tabs,
    ...(tab ? { tab } : {}),
    followable: false,
    year,
  };
}

/** A battle (an event of the war's): where, who won, the fallen, and the war it was of. */
export function battlePage(world: World, ref: string): PageModel {
  const e = world.events.get(ref as Ref);
  if (!e || e.type !== WAR_EVENTS.battle.type) throw new Error(`no battle ${ref}`);
  const warRef = e.subjects[0]!,
    w = warsOf(world).get(warRef),
    b = w?.battles.find((x) => x.event === ref),
    land = e.place ? Number(e.place.split(":")[2]) : (b?.land ?? -1),
    year = yearAt(e.t),
    now = yearNow(world),
    towns = land >= 0 ? populationContext(world).settlements.inProvince(land) : [];
  // A battle of this year or last is seen fought in its land's first town; older ones in its land.
  const place: Place | null =
    towns[0] && now - year <= 1
      ? { scale: "village", town: towns[0].ref }
      : land >= 0
        ? { scale: "region", cell: land }
        : null;
  return {
    ref,
    kind: "battle",
    icon: "💥",
    title: land >= 0 ? `The battle at ${landTitle(world, land)}` : "A battle",
    subtitle: [`Year ${year} · `, link("the war", warRef)],
    color: w ? realmColor(w.attacker) : null,
    place,
    stats: [
      stat("Won by", b ? [realmLink(world, b.won ? w!.attacker : w!.defender)] : ["—"]),
      stat("Fallen", b ? count(b.fallen[0] + b.fallen[1]) : "—", {
        parts:
          b && w
            ? [
                part([realmLink(world, w.attacker)], count(b.fallen[0])),
                part([realmLink(world, w.defender)], count(b.fallen[1])),
              ]
            : [],
      }),
      stat("Year", `${year}`),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "facts",
            rows: [
              stat(
                "War",
                [
                  link(
                    w
                      ? `the war of ${realms(world, w.attacker)} upon ${realms(world, w.defender)}`
                      : "a war",
                    warRef,
                  ),
                ],
                { why: warRef },
              ),
              ...(w
                ? [
                    stat("Attacker", [realmLink(world, w.attacker)]),
                    stat("Defender", [realmLink(world, w.defender)]),
                  ]
                : []),
              ...(land >= 0 ? [stat("Where", [landLink(world, land)])] : []),
              ...(towns.length
                ? [
                    stat("Towns there", [
                      ...towns
                        .slice(0, 6)
                        .flatMap((t, i) => [...(i ? [", "] : []), townLink(world, t.ref)]),
                      ...(towns.length > 6 ? [` and ${towns.length - 6} more`] : []),
                    ]),
                  ]
                : []),
            ],
          },
          { type: "why", ref },
        ],
      },
    ],
    followable: false,
    year: now,
  };
}

function realms(world: World, ref: Ref): string {
  const r = politiesOf(world).get(ref);
  return r ? r.town : "the fallen";
}

/** A war between the stars (`swar:`): its fleet, its enemy, and its battle. */
export function starWarPage(world: World, ref: string): PageModel {
  const w = starWarsOf(world)
    .all()
    .find((x) => x.ref === ref);
  if (!w) throw new Error(`no war among the stars ${ref}`);
  const civ = civilizationsNear(world).find((c) => c.ref === w.enemy),
    year = yearNow(world);
  const enemy = civ ? link(`the people of another star`, civ.ref) : realmLink(world, w.enemy);
  return {
    ref: w.ref,
    kind: "starwar",
    icon: "🚀",
    title: "A war among the stars",
    subtitle: [realmLink(world, w.realm), " against ", enemy],
    color: realmColor(w.realm),
    place: civ ? { scale: "cluster", star: civ.star } : realmPlace(world, w.realm),
    stats: [
      stat("Declared", `year ${w.declared}`, { why: w.event }),
      stat("Fleet", `strength ${count(w.strength)}`),
      stat("Sailed", `year ${w.sailed}`),
      stat("Arrives", `year ${w.arrives}`),
      stat("Won", w.won === null ? "not yet fought" : w.won ? "yes" : "no", { why: w.battle }),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "facts",
            rows: [
              stat("Of", [realmLink(world, w.realm)]),
              stat("Against", [enemy]),
              ...(w.battle
                ? [stat("Battle", [link(claimOf(world, w.battle), w.battle)], { why: w.battle })]
                : []),
              ...(w.ended ? [stat("Ended", [link(claimOf(world, w.ended), w.ended)])] : []),
            ],
          },
          { type: "why", ref: w.event },
        ],
      },
    ],
    followable: false,
    year,
  };
}

export { offworldSite };
