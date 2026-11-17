// A realm's Underworld tab, a crime group's and a street federation's pages, and a town's line on its justice page (the underworld,
// sim/order/underworld.ts): what feeds it (the want of protection, the idle men who sell it, the rents of what is forbidden and
// taxed), its groups by power with their bosses, lands, rackets and men, the wars between them, its street's gangs and federations,
// and what the state does (its crackdown and its cost, its officers bought, a crew of its own enforcers). Who, what, cost and effect:
// never how any crime is done. Phone first: a few facts, one set of bars, one table that fits.
import type { Ref, World } from "../../kernel/index.ts";
import type { Block, Item, PageModel, Row, Stat } from "../../bridge/index.ts";
import {
  RACKETS,
  UNDER,
  bulkSlip,
  dosePrice,
  potencyHarm,
  type GroupKind,
} from "../../rules/index.ts";
import {
  BAR,
  BAR_STORE,
  GANG_ROW,
  POT_ROW,
  bestMeans,
  touchesSea,
  gangsStore,
  loreOf,
  moneyStore,
  populationContext,
  potencyOf,
  potencyStore,
  groupsIn,
  kindOfGroup,
  politiesOf,
  underworldOf,
  type CrimeGroup,
  type Federation,
  type Polity,
  type RealmUnderworld,
  type Settlement,
  contrabandOf,
} from "../../sim/index.ts";
import { grainSum, groupWords } from "../../causal/index.ts";
import { contraWords } from "./tastes.ts";
import { realmColor } from "../colors.ts";
import { fedNews, fedOf, fedRef, groupNews, groupOf, groupRef } from "../underworld.ts";
import { claimOf, count, item, link, many, part, share, stat, yearAt, yearNow } from "./words.ts";
import { landLink, landTitle, realmLink } from "./names.ts";

const th = (n: number) => share(n / 1000),
  grain = (n: number) => `${grainSum(Math.max(0, Math.round(n)))} grain's worth`,
  cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** What each kind of group is. */
const KIND_WORDS: Readonly<Record<GroupKind, string>> = {
  protection: "a protection family",
  cartel: "a smuggling cartel",
  badge: "a crew of the realm's own enforcers",
};
/** What each racket is, in a few words: who pays, and what for. */
const RACKET_WORDS: Readonly<Record<(typeof RACKETS)[number], string>> = {
  protection: "protection sold to shops and farms",
  smuggling: "carrying what is forbidden or taxed",
  extortion: "extortion",
  kidnapping: "kidnapping for ransom",
  theft: "petty theft",
  shakedown: "keeping what it seizes",
  killing: "killing those it hunts, outside the law",
};
const racketsOf = (bits: number): string[] =>
  RACKETS.filter((_, i) => bits & (1 << i)).map((r) => RACKET_WORDS[r]);

const kindLine = (g: CrimeGroup): string =>
  g.squad ? "a death squad of the realm's own enforcers" : KIND_WORDS[kindOfGroup(g)];

const groupLink = (r: Polity, g: { name: string; kind: number; event: Ref }) =>
  link(cap(groupWords(g.name, kindOfGroup(g))), groupRef(r.ref, g.event));
const fedLink = (r: Polity, f: Federation) =>
  link(`the ${f.name} federation`, fedRef(r.ref, f.event));

/** A crew's killing a year, said. */
const killed = (n: number) =>
  n >= 1 ? `${many(Math.round(n), "killed", "killed")} a year` : "few";

/** What has passed in it, newest first. */
function passedItems(world: World, news: (e: never) => boolean, since: number): Item[] {
  const all = world.events.all(),
    out: Item[] = [];
  for (let i = all.length - 1; i >= 0 && out.length < 12; i--) {
    const e = all[i]!;
    if (yearAt(e.t) < since) break;
    if (!(news as (x: typeof e) => boolean)(e)) continue;
    const y = yearAt(e.t);
    out.push(item([`Year ${y}: `, link(claimOf(world, e.id), e.id)], e.id, y));
  }
  return out;
}

// —— A realm's Underworld tab ————————————————————————————————————————————————————————————————————————————

/** A realm's Underworld tab: none where nothing is reckoned. */
export function realmUnderworldBlocks(world: World, r: Polity): Block[] {
  const v = underworldOf(world)?.of(r.ref);
  if (!v) return [];
  const blocks: Block[] = [];
  const groups = [...v.groups].sort((a, b) => b.power - a.power || a.id - b.id);
  if (groups.length) {
    blocks.push({
      type: "bars",
      title: "Its groups, by power",
      bars: groups.map((g) => ({
        label: [groupLink(r, g)],
        ref: groupRef(r.ref, g.event),
        value: g.power / 1000,
        ...(kindOfGroup(g) === "badge" ? { color: realmColor(r.ref) } : {}),
      })),
      unit: "share",
      wrap: true,
    });
    const rows: Row[] = groups.map((g) => ({
      ref: groupRef(r.ref, g.event),
      cells: [
        [groupLink(r, g)],
        [g.boss.name],
        [count(g.members)],
        [kindOfGroup(g) === "badge" ? "its towns" : count(g.lands.length)],
        [`${g.since}`],
      ],
      keys: [g.name, g.boss.name, g.members, g.lands.length, g.since],
    }));
    blocks.push({
      type: "table",
      title: "Each group",
      columns: ["Group", "Boss", "Men", "Lands", "Since"],
      rows,
      few: UNDER.most,
      fit: true,
    });
    blocks.push({
      type: "facts",
      title: "What each lives on",
      rows: groups.map((g) =>
        stat(
          cap(groupWords(g.name, kindOfGroup(g))),
          `${kindLine(g)}: ${racketsOf(g.rackets).join(", ")}`,
          {
            why: g.event,
            parts: [
              part("takes in a year", grain(g.income)),
              ...(kindOfGroup(g) !== "badge" ? [part("of its road's rent", th(g.share))] : []),
              part("the killing it does and suffers", killed(g.violence)),
              ...(g.bribes
                ? [part("paid to officers and judges", `${grain(g.bribes)} a year`)]
                : []),
              ...(g.house ? [part("sheltered by", `the house of ${g.house}`)] : []),
            ],
          },
        ),
      ),
    });
  } else
    blocks.push({
      type: "text",
      lines: [
        [
          "No group holds any part of its trade or its borders now: what it forbids and what its holders fear are not worth the men it would take.",
        ],
      ],
    });
  // The wars between them.
  if (v.wars.length) {
    const items: Item[] = [...v.wars]
      .reverse()
      .map((w) =>
        item(
          [
            `Year ${w.since}${w.ended !== null ? `–${w.ended}` : ", still fought"}: `,
            link(
              `${cap(groupWords(w.names[0], kindOfGroup(w)))} against ${groupWords(w.names[1], kindOfGroup(w))}`,
              w.event,
            ),
            w.fallen >= 1 ? `, some ${count(Math.round(w.fallen))} dead` : "",
          ],
          w.event,
          w.since,
        ),
      );
    blocks.push({ type: "list", title: "Wars between them", items });
  }
  blocks.push(feedsBlock(v));
  const street = streetBlock(world, r, v);
  if (street) blocks.push(street);
  blocks.push(stateBlock(v));
  if (v.gone.length)
    blocks.push({
      type: "list",
      title: "How their holds ended",
      items: [...v.gone]
        .reverse()
        .map((g) =>
          item(
            [
              `Year ${g.year}: `,
              link(cap(groupWords(g.name, kindOfGroup(g))), groupRef(r.ref, g.rose)),
              ` (since ${g.since}), ${HOW[g.how] ?? g.how}${g.into ? ` ${groupWords(g.into, kindOfGroup(g))}` : ""}`,
            ],
            g.event,
            g.year,
          ),
        ),
    });
  return blocks;
}

const HOW: Readonly<Record<string, string>> = {
  crushed: "broken by the crackdown",
  withered: "withered with its rent",
  absorbed: "taken into",
  split: "split among its lieutenants",
  exposed: "found out, purged and reformed",
};

/** What feeds the underworld: who wants protection and who sells it, and the rents of what is forbidden and taxed. */
function feedsBlock(v: Readonly<RealmUnderworld>): Block {
  return {
    type: "facts",
    title: "What feeds it",
    rows: [
      stat("The want of private protection", th(v.want), {
        parts: [part("what its trade would pay for it", `${grain(v.protectRent)} a year`)],
      }),
      stat("Men skilled in violence and idle", many(v.pool, "man", "men"), {
        parts: [
          part("how ready they are to be hired", th(v.supply)),
          ...(v.veterans ? [part("come home from its last war", count(v.veterans))] : []),
        ],
      }),
      stat(
        "The rent of what it forbids and taxes",
        `${grain(v.banRent + v.tariffRent + v.borderRent + (v.wareRent ?? 0))} a year`,
        {
          parts: [
            part("of its ban", grain(v.banRent)),
            part("of its tariffs and sanctions", grain(v.tariffRent)),
            ...(v.borderRent ? [part("of a banning neighbour's market", grain(v.borderRent))] : []),
            ...(v.wareRent
              ? [
                  part(
                    "of trade its wars forbid, its licences hold or its bar on arms",
                    grain(v.wareRent),
                  ),
                ]
              : []),
            part("the share outside hands take", th(v.captured)),
          ],
        },
      ),
    ],
  };
}

/** What the state does: its crackdown, its officers bought, a crew of its own. */
function stateBlock(v: Readonly<RealmUnderworld>): Block {
  const rows: Stat[] = [
    stat(
      "Its crackdown",
      v.crackdown >= 50 ? `${th(v.crackdown)}, biting ${th(v.bites)}` : "none to speak of",
      {
        ...(v.crackEvent ? { why: v.crackEvent } : {}),
        parts: [
          part("what it costs its treasury", `${grain(v.cost)} a year`),
          part("what it seizes", `${grain(v.seized)} a year`),
        ],
      },
    ),
    stat("Officers and judges bought", th(v.collusion), {
      ...(v.pactEvent ? { why: v.pactEvent } : {}),
      parts: [
        part(
          "what the groups pay them",
          `${grain(v.groups.reduce((s, g) => s + g.bribes, 0))} a year`,
        ),
      ],
    }),
    stat("The killing in its lands", killed(v.killings + v.street + v.badge), {
      parts: [
        part("of its groups' wars", killed(v.killings)),
        part("of its street gangs", killed(v.street)),
        ...(v.badge ? [part("of its own enforcers", killed(v.badge))] : []),
        part("of its trade extorted", th(v.extortion)),
      ],
    }),
  ];
  if (v.badgePull >= 50 || v.scandal)
    rows.push(
      stat(
        "Its enforcers' pull to a crew of their own",
        th(v.badgePull),
        v.scandal
          ? { why: v.scandal.event, parts: [part("a crew found out", `year ${v.scandal.year}`)] }
          : {},
      ),
    );
  return { type: "facts", title: "What the state does", rows };
}

/** Its street: the towns whose quarters hold gangs, and the federations they have made. */
function streetBlock(world: World, r: Polity, v: Readonly<RealmUnderworld>): Block | null {
  const rows = gangsStore(world),
    towns = r.members
      .map((c) => [c, rows?.get(c)] as const)
      .filter(([, x]) => x && x[GANG_ROW.gangs]! > 0)
      .sort((a, b) => b[1]![GANG_ROW.gangs]! - a[1]![GANG_ROW.gangs]! || a[0] - b[0]);
  if (!towns.length && !v.feds.length) return null;
  const out: Stat[] = towns.slice(0, 6).map(([c, x]) =>
    stat(
      landTitle(world, c),
      [many(x![GANG_ROW.gangs]!, "small gang", "small gangs"), " in ", landLink(world, c)],
      {
        parts: [
          part("their pull on its young men", th(x![GANG_ROW.street]!)),
          part(
            "killed a year, in a hundred thousand",
            count(Math.round(x![GANG_ROW.killings]! / 10)),
          ),
          ...(x![GANG_ROW.jailed]!
            ? [part("of them jailed a year", count(x![GANG_ROW.jailed]!))]
            : []),
        ],
      },
    ),
  );
  for (const f of v.feds) {
    const rival = f.rival !== undefined ? v.feds.find((x) => x.id === f.rival) : undefined,
      supplier = f.supplier !== undefined ? v.groups.find((g) => g.id === f.supplier) : undefined;
    out.push(
      stat(
        "A federation",
        [
          fedLink(r, f),
          `: ${many(f.gangs, "gang", "gangs")} in ${many(f.towns.length, "town", "towns")}`,
        ],
        {
          why: f.event,
          parts: [
            part("its young men", count(f.members)),
            ...(rival ? [part([fedLink(r, rival)], "its rival")] : []),
            ...(supplier ? [part([groupLink(r, supplier)], "supplies it")] : []),
          ],
        },
      ),
    );
  }
  return { type: "facts", title: "Its street", rows: out };
}

// —— A group's page, a federation's ——————————————————————————————————————————————————————————————————————

/** A crime group's page (`mob:<realm>:<event>`). */
export function crimeGroupPage(world: World, ref: string): PageModel {
  const g = groupOf(world, ref);
  if (!g) throw new Error(`no group ${ref}`);
  const year = yearNow(world),
    r = g.realm,
    rec = g.record,
    v = underworldOf(world)?.of(r.ref),
    since = rec?.since ?? g.gone?.since ?? yearAt(world.events.get(g.event)?.t ?? world.now),
    of = rec?.of !== undefined ? v?.groups.find((x) => x.id === rec.of) : undefined,
    facts: Stat[] = [
      stat("Realm", [realmLink(world, r.ref)]),
      stat("What it is", rec ? kindLine(rec) : KIND_WORDS[g.kind], { why: g.event }),
      stat("Since", `year ${since}`, { why: g.event }),
    ];
  if (of) facts.push(stat("Split from", [groupLink(r, of)]));
  if (rec) {
    facts.push(
      stat(
        "Boss",
        `${rec.boss.name}, born year ${rec.boss.born}, boss since year ${rec.boss.since}`,
        {
          parts: [part("its bosses so far", count(rec.bosses))],
        },
      ),
      stat(
        "Its lands",
        rec.lands.length
          ? rec.lands.flatMap((c, i) => (i ? [", ", landLink(world, c)] : [landLink(world, c)]))
          : "the towns where its realm's crackdown is sent",
      ),
      stat("What it lives on", racketsOf(rec.rackets).join(", ")),
    );
    if (rec.house) facts.push(stat("Sheltered by", `the house of ${rec.house}`));
  }
  if (g.gone)
    facts.push(
      stat(
        "Its hold ended",
        [`in year ${g.gone.year}, `, link(HOW[g.gone.how] ?? g.gone.how, g.gone.event)],
        {
          why: g.gone.event,
        },
      ),
    );
  const blocks: Block[] = [{ type: "facts", rows: facts }];
  if (rec) {
    const wars = (v?.wars ?? []).filter((w) => w.a === rec.id || w.b === rec.id);
    blocks.push({
      type: "facts",
      title: "What it holds, and what it costs",
      rows: [
        stat("Men", count(rec.members)),
        stat("Wealth", grain(rec.wealth), { parts: [part("taken in a year", grain(rec.income))] }),
        ...(kindOfGroup(rec) !== "badge" ? [stat("Of its road's rent", th(rec.share))] : []),
        stat("Power among its realm's groups", th(rec.power)),
        stat("The killing it does and suffers", killed(rec.violence)),
        ...(rec.bribes ? [stat("Paid to officers and judges", `${grain(rec.bribes)} a year`)] : []),
        ...wars.map((w) =>
          stat(
            w.ended === null ? "At war with" : "Was at war with",
            [
              link(
                cap(groupWords(w.a === rec.id ? w.names[1] : w.names[0], kindOfGroup(w))),
                w.event,
              ),
            ],
            {
              parts: [
                part("since", `year ${w.since}`),
                part("the dead", count(Math.round(w.fallen))),
              ],
            },
          ),
        ),
      ],
    });
    blocks.push({
      type: "text",
      lines: [
        [
          kindOfGroup(rec) === "protection"
            ? "Where a holding is not safe and a deal is not held to, those who trade pay for someone who will hold them. It takes its cut of what it guards, settles the quarrels the courts do not, and holds others to their word; it gains its payers a little where there are no courts, and costs them everywhere."
            : kindOfGroup(rec) === "cartel"
              ? "What a realm forbids or taxes is dearer than it would be: the difference times what is bought is a rent, and it goes to whoever carries it past the law. It is taken where the realm's reach is weak and its officers can be bought, and fought over where no one group holds it all."
              : "A crackdown given licence because results are wanted, watched by no voice, no free word and no court of its own, with what it seizes in reach: its enforcers keep for themselves what they take and sell the trade protection from their own crackdown.",
        ],
      ],
    });
  }
  // (What it carries, and its means: arms, armour, hidden carriage, guarded word.)
  if (rec) blocks.push(...gearBlocks(world, r, rec));
  const passed = passedItems(world, groupNews(g) as (e: never) => boolean, since);
  blocks.push(
    passed.length
      ? { type: "list", title: "What has passed in it", items: passed }
      : {
          type: "text",
          title: "What has passed in it",
          lines: [["Nothing yet that history tells."]],
        },
  );
  return {
    ref: g.ref,
    kind: "family",
    icon: g.kind === "badge" ? "🛡️" : g.kind === "cartel" ? "📦" : "🕶️",
    title: cap(groupWords(g.name, g.kind)),
    subtitle: [
      rec ? `${cap(rec ? kindLine(rec) : KIND_WORDS[g.kind])} of ` : "Once a group of ",
      realmLink(world, r.ref),
    ],
    color: realmColor(r.ref),
    place: rec?.lands[0] !== undefined ? { scale: "region", cell: rec.lands[0] } : null,
    stats: [
      ...(rec ? [stat("Boss", rec.boss.name), stat("Men", count(rec.members))] : []),
      stat("Since", `year ${since}`),
    ],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year,
  };
}

/** A street federation's page (`gfed:<realm>:<event>`). */
export function federationPage(world: World, ref: string): PageModel {
  const f = fedOf(world, ref);
  if (!f) throw new Error(`no federation ${ref}`);
  const year = yearNow(world),
    r = f.realm,
    rec = f.record,
    v = underworldOf(world)?.of(r.ref),
    since = rec?.since ?? yearAt(world.events.get(f.event)?.t ?? world.now),
    rival = rec?.rival !== undefined ? v?.feds.find((x) => x.id === rec.rival) : undefined,
    supplier =
      rec?.supplier !== undefined ? v?.groups.find((g) => g.id === rec.supplier) : undefined,
    facts: Stat[] = [
      stat("Realm", [realmLink(world, r.ref)]),
      stat("Since", `year ${since}`, { why: f.event }),
    ];
  if (rec) {
    facts.push(
      stat(
        "Its towns",
        rec.towns.flatMap((c, i) => (i ? [", ", landLink(world, c)] : [landLink(world, c)])),
      ),
      stat("Its gangs", `${count(rec.gangs)}, some ${count(rec.members)} young men`, {
        parts: [
          part("how hard they hold together", th(rec.strength)),
          ...(rec.jailed
            ? [part("of them jailed a year, and bound the closer for it", count(rec.jailed))]
            : []),
        ],
      }),
      stat("What they live on", "the street's sale of what is forbidden, and petty theft"),
    );
    if (rival) facts.push(stat("Against", [fedLink(r, rival)]));
    if (supplier) facts.push(stat("Supplied by", [groupLink(r, supplier)]));
  } else facts.push(stat("Now", "its gangs no longer hold together"));
  const blocks: Block[] = [
    { type: "facts", rows: facts },
    {
      type: "text",
      lines: [
        [
          "Small gangs of a town's young men, tied to their streets: where there are many young men and little work, kin and temple hold little, the police reach little and quarters are set apart. Allied across towns against a rival bloc, mostly by who their people are, they fight for respect and in answer to each other.",
        ],
      ],
    },
  ];
  const passed = passedItems(world, fedNews(f) as (e: never) => boolean, since);
  if (passed.length) blocks.push({ type: "list", title: "What has passed in it", items: passed });
  return {
    ref: f.ref,
    kind: "family",
    icon: "🧢",
    title: `The ${f.name} federation`,
    subtitle: ["Street gangs allied in ", realmLink(world, r.ref)],
    color: realmColor(r.ref),
    place: rec?.towns[0] !== undefined ? { scale: "region", cell: rec.towns[0] } : null,
    stats: rec
      ? [stat("Gangs", count(rec.gangs)), stat("Towns", count(rec.towns.length))]
      : [stat("Since", `year ${since}`)],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year,
  };
}

// —— A town's line ———————————————————————————————————————————————————————————————————————————————————————

/** What a town's justice page says of its underworld: who holds its land, its gangs, a crew of enforcers (none: nothing kept). */
export function townUnderworldBlocks(world: World, s: Settlement): Block[] {
  const read = groupsIn(world, s.cell);
  if (!read) return [];
  const r = politiesOf(world).of(s.cell),
    rec = r ? underworldOf(world)?.of(r.ref) : undefined,
    rows: Stat[] = [];
  if (r && rec && read.group !== null) {
    const g = rec.groups.find((x) => x.id === read.group);
    if (g)
      rows.push(
        stat("Held by", [groupLink(r, g)], {
          parts: [
            part("its hold here", share(read.control)),
            part("of the trade under its protection", share(read.protection)),
          ],
        }),
      );
  }
  if (read.gangs > 0) {
    const fa = gangsStore(world)?.at(s.cell, GANG_ROW.fedA) ?? 0,
      fb = gangsStore(world)?.at(s.cell, GANG_ROW.fedB) ?? 0,
      feds = [fa, fb]
        .filter((x) => x > 0)
        .map((x) => rec?.feds.find((f) => f.id === x - 1))
        .filter((f): f is Federation => !!f);
    rows.push(
      stat("Its street", many(read.gangs, "small gang", "small gangs"), {
        parts: [
          part("their pull on its young men", share(read.street)),
          ...(r ? feds.map((f) => part([fedLink(r, f)], "a federation here")) : []),
        ],
      }),
    );
  }
  if (read.badge > 0 && r && rec) {
    const crew = rec.groups.find((x) => kindOfGroup(x) === "badge");
    if (crew)
      rows.push(
        stat("Its enforcers", [
          groupLink(r, crew),
          crew.squad ? ", who kill outside the law" : ", who keep what they seize",
        ]),
      );
  }
  rows.push(
    stat("The killing", `${count(Math.round(read.violence))} a year in a hundred thousand`),
  );
  return [{ type: "facts", title: "Its underworld", rows }];
}

// —— What a group carries, and its means ——————————————————————————————————————————————————————————————————

/** How strong a realm's forbidden trade has grown, in words, with why (null: it has not, or nothing is kept). */
export function potencyWords(
  world: World,
  realm: string,
): { strength: string; why: string; potency: number; made: number } | null {
  const row = potencyStore(world)?.get(realm);
  if (!row) return null;
  const { potency, made } = potencyOf(world, realm),
    barred = (moneyStore(world, BAR_STORE)?.at(realm, BAR.barred) ?? 0) / 1000,
    premium = row[POT_ROW.premium]! / 1000;
  if (potency < 1.05 && made < 0.01) return null;
  const why =
    barred < 0.25
      ? "allowed again: its sellers sell by the dose and the taste, and it weakens over a generation"
      : premium >= 0.5
        ? "forbidden and hunted: the trade carries the strongest it can make"
        : "forbidden, though little hunted: the trade carries a stronger form than it would";
  return {
    strength: `${potency.toFixed(1)} times as strong as the grown form${made >= 0.01 ? `, ${share(made)} of it made, not grown` : ""}`,
    why,
    potency,
    made,
  };
}

/** The "How strong" line of a realm's section on what calms, wakes and eases (null: nothing to say). */
export function potencyStat(world: World, realm: string): Stat | null {
  const w = potencyWords(world, realm);
  if (!w) return null;
  const row = potencyStore(world)!.get(realm)!,
    harm = potencyHarm(w.potency, w.made);
  return stat("How strong", `${w.strength}: ${w.why}`, {
    parts: [
      part(
        "the strongest its people's craft could make it",
        `${(row[POT_ROW.most]! / 100).toFixed(1)} times`,
      ),
      part("a dose costs, against the grown form's", share(dosePrice(w.potency))),
      part("more of what is forbidden slips past for its little bulk", share(bulkSlip(w.potency))),
      part("more of its takers come to need it", share(harm.binds - 1)),
      part("more of them die of it", share(harm.deaths - 1)),
    ],
  });
}

/** What a cartel carries and what each group has of arms, armour, hidden carriage and guarded word. */
function gearBlocks(world: World, r: Polity, g: CrimeGroup): Block[] {
  const out: Block[] = [];
  if (kindOfGroup(g) === "cartel") {
    const w = potencyWords(world, r.ref),
      v = underworldOf(world)?.of(r.ref);
    out.push({
      type: "facts",
      title: "What it carries",
      rows: [
        stat(
          "What",
          w
            ? `what calms, wakes and eases, forbidden: ${w.strength}`
            : contrabandOf(world, r.ref).length
              ? contrabandOf(world, r.ref)
                  .slice(0, 3)
                  .map((x) => contraWords(x))
                  .join("; ")
              : "what its realm forbids or taxes",
          {
            parts: [
              part("the rent it takes a year", grain(g.income)),
              ...(v ? [part("the realm's whole rent of what it forbids", grain(v.banRent))] : []),
              ...(w
                ? [
                    part(
                      "what a load of it is worth against a load of the grown form",
                      `${(w.potency * dosePrice(w.potency)).toFixed(1)} times`,
                    ),
                  ]
                : []),
            ],
          },
        ),
        ...(w ? [stat("Why so strong", w.why)] : []),
      ],
    });
  }
  const m = g.means;
  if (!m || m.arms + m.armour + m.hidden + m.word <= 0) return out;
  const ctx = populationContext(world),
    best = bestMeans(ctx, r, g.home),
    sum = Math.max(1, m.arms + m.armour + m.hidden + m.word),
    costOf = (x: number) => `${grain((m.cost * x) / sum)} a year`,
    rows: Stat[] = [];
  if (m.arms > 0) {
    const a = m.arms / 1000,
      said =
        a > best.arms + 0.02
          ? "arms better than the realm's soldiers', bought abroad"
          : a >= best.arms * 0.95
            ? "arms as good as the realm's soldiers"
            : a >= best.arms * 0.5
              ? "arms nearly as good as the realm's soldiers"
              : "light arms";
    rows.push(
      stat("Arms", said, {
        parts: [
          part("costs it", costOf(m.arms)),
          part("does", "the stronger in its wars and against the crackdown"),
        ],
      }),
    );
  }
  if (m.armour > 0)
    rows.push(
      stat("Armour", m.armour >= 300 ? "armoured carriers" : "some armour", {
        parts: [
          part("costs it", costOf(m.armour)),
          part("does", "fewer of its men taken, the crackdown the dearer"),
        ],
      }),
    );
  if (m.hidden > 0) {
    const sea =
        r.members.some((c) => touchesSea(ctx, c)) && !!loreOf(world).get(r.seat, "shipbuilding"),
      under = best.hidden > (sea ? 0.25 : 0) + 0.01;
    rows.push(
      stat(
        "Hidden carriage",
        sea && under
          ? "hidden boats, and tunnels under the border"
          : sea
            ? "hidden boats"
            : "tunnels under the border",
        {
          parts: [
            part("costs it", costOf(m.hidden)),
            part("does", "more slips past the border and blockades"),
          ],
        },
      ),
    );
  }
  if (m.word > 0)
    rows.push(
      stat("Word", "guarded word", {
        parts: [
          part("costs it", costOf(m.word)),
          part("does", "its boss the harder to find and take"),
        ],
      }),
    );
  out.push({ type: "facts", title: "Its means", rows });
  return out;
}
