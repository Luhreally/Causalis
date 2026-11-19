// A realm's Powers tab (round E, order): who holds which powers and the rule read off them, what each of its groups has
// come to want and from what, its choices put to its people, its spies and those it caught, the lands it holds by force and
// those that fight it there, and the bodies of realms it sits in. Each block reads the world's own stores; phone first: facts
// and short lists, no table wider than a phone.
import type { World } from "../../kernel/index.ts";
import type { Block, Stat } from "../../bridge/index.ts";
import {
  GENERAL,
  GROUPS,
  LAW,
  LEADERSHIP,
  SUCCESSION,
  holdsOf,
  interestsOf,
  populationContext,
  chooses,
  councilsOf,
  electionsOf,
  politiesOf,
  realmName,
  aimOf,
  farFromSeat,
  fieldedOf,
  warGroundOf,
  supplyOf,
  occupationOf,
  strengthOf,
  warCosts,
  spiesOf,
  termOf,
  wantsOf,
  type Polity,
  type War,
} from "../../sim/index.ts";
import { HOLDING, warReckoning } from "../../rules/index.ts";
import { item, part, share, stat } from "./words.ts";
import { landTitle } from "./names.ts";
import { cellRef } from "../../gen/index.ts";

/** Why a realm is ruled as it is: its numbers and whose sway is greatest, as formFromPowers reads them. */
export function powersBlocks(world: World, r: Polity): Block[] {
  const ctx = populationContext(world),
    [force, voice] = holdsOf(world, r.ref) as [number, number],
    interests = r.ended === null ? interestsOf(ctx, r, world.now) : [],
    sway = new Map(interests.map((i) => [i.group, i.sway])),
    temple = sway.get("the temple") ?? 0,
    others = Math.max(sway.get("the court") ?? 0, sway.get("the army") ?? 0),
    who =
      r.leadership === GENERAL
        ? "A general holds it: its host seized it, and holds it until it is restored."
        : voice >= 0.6
          ? `Its choices are carried by many (${share(voice)}): an assembly decides.`
          : voice >= HOLDING.voiceMid
            ? `Its choices are carried by a few (${share(voice)}): they decide in council.`
            : temple > others && temple > 0.1
              ? `Its choices are carried by one (${share(voice)}), and the temple outweighs the court and the arms: a priest-king.`
              : `Its choices are carried by one (${share(voice)}): a chief decides.`,
    passes =
      r.succession === 1
        ? "Rule passes by choice: many choose."
        : r.succession === 2
          ? `Rule passes by acclaim: the arms are in its people's hands (the seat keeps ${share(force)} of them).`
          : "Rule passes by birth: few choose, and the arms are the seat's.",
    rows: Stat[] = [
      stat("Who decides", who),
      stat("How rule passes", passes),
      stat(
        "Its law",
        r.law === 2
          ? "Sacred: the temple outweighs the court and the arms."
          : r.law === 1
            ? "Written: it writes, and its word is carried."
            : "Custom: what has always been done.",
      ),
      stat("Read as", `${LEADERSHIP[r.leadership]}, ${SUCCESSION[r.succession]}, ${LAW[r.law]}`),
    ];
  if (interests.length)
    rows.push(
      stat("Whose sway", "Shares of what its choices weigh", {
        parts: GROUPS.filter((g) => (sway.get(g) ?? 0) >= 0.005)
          .sort((a, b) => (sway.get(b) ?? 0) - (sway.get(a) ?? 0))
          .map((g) => part(g, share(sway.get(g) ?? 0))),
      }),
    );
  return [
    { type: "facts", title: "Who holds which powers", rows },
    ...electionBlocks(world, r),
    ...councilBlocks(world, r),
    ...spyBlocks(world, r),
    ...occupationBlocks(world, r),
    ...wantsBlocks(world, r),
  ];
}

/** What each of its groups has learned to want of how it is held, and how it fared when it last weighed. */
function wantsBlocks(world: World, r: Polity): Block[] {
  const kept = wantsOf(world)?.of(r.ref);
  if (!kept?.size) return [];
  const rows: Stat[] = [];
  for (const g of GROUPS) {
    const w = kept.get(g);
    if (!w) continue;
    const fared =
      w.fared > 0.15
        ? "fared well, and wants it held more as it was"
        : w.fared < -0.15
          ? "fared ill, and wants it held otherwise"
          : "fared much as before";
    rows.push(
      stat(
        g,
        w.year ? `${cap(fared)} (year ${w.year})` : "Wants it held as it is: not yet weighed",
        {
          parts: [
            part("the seat's share of the arms", share(w.want[0]! / 100)),
            part("how widely choices are carried", share(w.want[1]! / 100)),
            part("how freely word moves", share(w.want[2]! / 100)),
            part("how far it binds itself to others", share(w.want[3]! / 100)),
          ],
        },
      ),
    );
  }
  return [
    {
      type: "facts",
      title: "What its groups have learned to want",
      rows,
    },
  ];
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

/** Its choices put to its people, where its rule has them: who governs, when it next chooses, and its last few. */
function electionBlocks(world: World, r: Polity): Block[] {
  const v = electionsOf(world)?.of(r.ref);
  if (r.ended !== null || !chooses(world, r) || !v)
    return r.ended === null
      ? [
          {
            type: "text",
            lines: [
              [
                r.succession === 1
                  ? "Its choices are carried by too few for its people to be asked who governs."
                  : "Its rule does not pass by choice: its people are not asked who governs.",
              ],
            ],
          },
        ]
      : [];
  const term = termOf(populationContext(world)),
    rows: Stat[] = [
      stat(
        "Who governs",
        v.governing
          ? `The ${v.governing}${v.past.at(-1)?.who ? `, under ${v.past.at(-1)!.who}${v.past.at(-1)!.party ? ` of the ${v.past.at(-1)!.party} party` : ""}` : ""}, by its people's choice`
          : "None chosen yet",
        { why: v.past.at(-1)?.event ?? null },
      ),
      stat("Its people choose", `Every ${term} years; next in year ${v.next}`),
    ];
  const last = v.past.at(-1);
  if (last)
    rows.push(
      stat("At the last", `Year ${last.year}`, {
        parts: last.votes.map(([g, x]) => {
          const name = last.ran?.find(([k]) => k === g)?.[1];
          return part(name ? `${name}, of the ${g}` : `the ${g}' candidate`, share(x));
        }),
      }),
    );
  return [
    { type: "facts", title: "Choices put to its people", rows },
    {
      type: "list",
      title: "Its elections, newest first",
      items: [...v.past]
        .reverse()
        .map((e) =>
          item(
            `Year ${e.year}: the ${e.group} ${e.held ? "chosen again" : "chosen to govern"}${e.who ? `, under ${e.who}${e.party ? ` of the ${e.party} party` : ""}` : ""}, ${share(e.votes[0]?.[1] ?? 0)} of its sway`,
            e.event,
            e.year,
          ),
        ),
    },
  ];
}

/** The council of realms it sits in, those it is most bound to by treaty, and the councils it sat in. */
function councilBlocks(world: World, r: Polity): Block[] {
  const store = councilsOf(world);
  if (!store) return [];
  const realms = politiesOf(world),
    year = Math.floor(world.now / (365 * 86400)),
    c = store.councilOf(r.ref),
    bound = realms
      .living()
      .filter((q) => q.ref !== r.ref)
      .map((q) => ({ q, w: store.bondOf(r.ref, q.ref, year) }))
      .filter((x) => x.w >= 0.5)
      .sort((a, b) => b.w - a.w || (a.q.ref < b.q.ref ? -1 : 1))
      .slice(0, 6),
    rows: Stat[] = [
      stat(
        "Sits in",
        c
          ? `${c.name}, since year ${c.founded}, ${c.members.length} realms`
          : "No council of realms",
        { why: c?.event ?? null },
      ),
    ];
  if (bound.length)
    rows.push(
      stat("Bound by treaty to", `${bound.length} realms, by their pacts and peaces`, {
        parts: bound.map((x) => part(realmName(x.q), `${x.w.toFixed(1)} treaties' worth`)),
      }),
    );
  const blocks: Block[] = [{ type: "facts", title: "Councils of realms", rows }];
  if (c)
    blocks.push({
      type: "list",
      title: `Who sits in ${c.name}`,
      items: c.members.flatMap((m) => {
        const q = realms.get(m);
        return q ? [item(realmName(q), q.ref)] : [];
      }),
    });
  return blocks;
}

/** Those it keeps watching in other realms, and those other realms keep in it (as far as any page may know: all of them). */
function spyBlocks(world: World, r: Polity): Block[] {
  const store = spiesOf(world);
  if (!store) return [];
  const realms = politiesOf(world),
    abroad = store.of(r.ref).flatMap((s) => {
      const q = realms.get(s.in);
      return q
        ? [item(`In ${realmName(q)}, since year ${s.since}: its host read truly`, q.ref)]
        : [];
    }),
    within = store
      .realms()
      .flatMap((k) =>
        store.of(k).some((s) => s.in === r.ref) && realms.get(k)
          ? [item(`Of ${realmName(realms.get(k)!)}`, k)]
          : [],
      );
  if (!abroad.length && !within.length) return [];
  return [
    ...(abroad.length ? [{ type: "list" as const, title: "Its spies abroad", items: abroad }] : []),
    ...(within.length
      ? [{ type: "list" as const, title: "Spies in its lands, not yet caught", items: within }]
      : []),
  ];
}

/** The lands it holds by force and how far each fights it; and its own lands others hold so. */
function occupationBlocks(world: World, r: Polity): Block[] {
  const store = occupationOf(world);
  if (!store) return [];
  const realms = politiesOf(world),
    line = (c: number, words: string) => item(`${landTitle(world, c)}: ${words}`, cellRef(0, c)),
    held = store.heldBy(r.ref).map((c) => {
      const o = store.of(c)!;
      return line(
        c,
        `${o.rising ? "risen against it" : o.resistance > 0.1 ? "resisting" : "quiet"} (${share(o.resistance)}), taken from ${realms.get(o.from) ? realmName(realms.get(o.from)!) : "another"} in year ${o.since}`,
      );
    }),
    lost = store.cells().flatMap((c) => {
      const o = store.of(c)!;
      if (o.from !== r.ref) return [];
      const h = realms.get(o.holder);
      return [
        line(
          c,
          `held by ${h ? realmName(h) : "another"} since year ${o.since}, its people ${o.rising ? "risen" : "resisting"} (${share(o.resistance)})`,
        ),
      ];
    });
  return [
    ...(held.length
      ? [{ type: "list" as const, title: "Lands it holds by force", items: held }]
      : []),
    ...(lost.length
      ? [{ type: "list" as const, title: "Its lands others hold by force", items: lost }]
      : []),
  ];
}

/** A war's reckoning: what it has cost each side and what it is worth to them, and whether either is near its end of it. */
export function warReckoningBlocks(world: World, w: War): Block[] {
  const realms = politiesOf(world),
    a = realms.get(w.attacker),
    d = realms.get(w.defender);
  if (!a || !d || a.ended !== null || d.ended !== null) return [];
  const ctx = populationContext(world),
    year = Math.floor(world.now / (365 * 86400)),
    c = warCosts(ctx, w, a, d, aimOf(world, w)?.aim, w.ended ?? year),
    r = warReckoning({
      won: w.battles.filter((x) => x.won).length,
      fought: w.battles.length,
      ratio: strengthOf(ctx, a) / Math.max(1, strengthOf(ctx, d)),
      ...c,
    }),
    side = (p: Polity, k: 0 | 1, chance: number, end: boolean) =>
      stat(
        realmName(p),
        end
          ? k === 0
            ? "It has paid what winning is worth to it, by its chance"
            : "It has paid what losing would take from it"
          : `Cost ${share(c.costs[k])} of what it has, against ${share(c.stakes[k])} at stake`,
        {
          parts: [
            part("what a year of it costs", share(c.yearly[k])),
            part("what it has cost so far", share(c.costs[k])),
            part("what it is worth to it", share(c.stakes[k])),
            part(k === 0 ? "its chance of winning" : "its chance of holding", share(chance)),
          ],
        },
      );
  return [
    {
      type: "facts",
      title: "What it costs and what it is worth",
      rows: [side(a, 0, r.chance, r.quits), side(d, 1, 1 - r.chance, r.yields)],
    },
  ];
}

/** The ground its last battle was fought on, and how fed the attacker's host fought there. */
export function warGroundBlocks(world: World, w: War): Block[] {
  const last = w.battles.at(-1),
    a = politiesOf(world).get(w.attacker);
  if (!last || !a || a.ended !== null) return [];
  const ctx = populationContext(world),
    ground = warGroundOf(ctx, last.land),
    far = farFromSeat(ctx, a, last.land),
    fed = supplyOf(ctx, last.land, far, fieldedOf(ctx, a));
  return [
    {
      type: "facts",
      title: "The ground of its last battle",
      rows: [
        stat(
          "For those who held it",
          `${ground.factor.toFixed(2)} times their strength on open ground`,
          {
            parts: [
              part("its broken ground", `${Math.round(ground.relief)} m of spread in its heights`),
              part("its river", ground.river > 0 ? `adds ${share(ground.river)}` : "none"),
              part("its woods", ground.woods > 0 ? `adds ${share(ground.woods)}` : "bare"),
            ],
          },
        ),
        stat(
          `How fed ${realmName(a)}'s host fought`,
          `${share(fed)} of its strength fed, ${far.toFixed(1)} lands' steps from its seat`,
        ),
      ],
    },
  ];
}
