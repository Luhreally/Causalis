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
  termOf,
  wantsOf,
  type Polity,
} from "../../sim/index.ts";
import { HOLDING } from "../../rules/index.ts";
import { item, part, share, stat } from "./words.ts";

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
        v.governing ? `The ${v.governing}, by its people's choice` : "None chosen yet",
        { why: v.past.at(-1)?.event ?? null },
      ),
      stat("Its people choose", `Every ${term} years; next in year ${v.next}`),
    ];
  const last = v.past.at(-1);
  if (last)
    rows.push(
      stat("At the last", `Year ${last.year}`, {
        parts: last.votes.map(([g, x]) => part(`the ${g}' candidate`, share(x))),
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
            `Year ${e.year}: the ${e.group} ${e.held ? "chosen again" : "chosen to govern"}, ${share(e.votes[0]?.[1] ?? 0)} of its sway`,
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
