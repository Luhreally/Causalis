// Lives L1, a realm's leaders as pages: a ruler's page (where they live, what their reign holds,
// how they came to rule), the realm's list of who holds power, the realm's headline stat, and the
// leaders a lender's house and a townsman's page show. Pure reads of the world as it stands:
// asking moves nothing. The leaders themselves are host/leaders.ts's.
import { YEAR, type World } from "../../kernel/index.ts";
import { FEMALE, OCC } from "../../rules/index.ts";
import { creditOf, handOf, politiesOf, type Polity } from "../../sim/index.ts";
import { governmentWords } from "../../causal/index.ts";
import {
  LEADER_ICON,
  parseSeatRef,
  worthWords,
  type Block,
  type Item,
  type PageModel,
  type Stat,
  type Tab,
} from "../../bridge/index.ts";
import { realmColor } from "../colors.ts";
import { houseLink } from "./credit.ts";
import { landLink, realmLink, spotOfLand, townLink } from "./names.ts";
import { landEra, peopleBody } from "../village.ts";
import { leadersOf, leadersOfTown, lenderLeader, rulerLeader, seatTownOf } from "../leaders.ts";
import { asRef, claimOf, count, item, link, stat, yearAt, yearNow } from "./words.ts";

/** A realm's headline stat: who rules it, and its leaders' page. */
export function rulerStat(realm: Polity): Stat {
  return stat(
    "Ruled by",
    [
      link(realm.ruler.name, `rule:${realm.ref}`),
      " · ",
      link("its leaders", `${realm.ref}#leaders`),
      " · ",
      link("its court", `${realm.ref}#court`),
    ],
    { why: realm.ruler.event },
  );
}

/** A realm's leaders for its page: what history keeps of who holds power, then each one's card. */
export function leaderBlocks(world: World, r: Polity): Block[] {
  const list = leadersOf(world, r.ref);
  if (!list) return [];
  return [
    {
      type: "text",
      lines: [
        [
          `Who holds power in ${list.realmName}, as history keeps them. Those who stand near its seat are on its Court tab, and in time history forgets who founded a realm.`,
        ],
      ],
    },
    ...list.leaders.map((l): Block => ({ type: "tool", tool: "leader.card", args: { leader: l } })),
  ];
}

/** A ruler's page: who they are, where they live, what their reign holds, and how they came to rule. */
export function rulerPage(world: World, ref: string): PageModel {
  const r = politiesOf(world).get(asRef(ref.slice("rule:".length)));
  if (!r) throw new Error(`no ruler ${ref}`);
  const year = yearNow(world),
    age = (r.ended ?? year) - r.ruler.born,
    me = rulerLeader(world, r),
    town = seatTownOf(world, r),
    body = peopleBody(world),
    spot = spotOfLand(world, r.seat),
    since = r.ruler.since * YEAR;
  // The events of their reign, newest first, most twelve (the year they came to rule has its own line).
  const all = world.events.all(),
    reign: Item[] = [];
  for (let i = all.length - 1; i >= 0 && reign.length < 12 && all[i]!.t >= since; i--) {
    const e = all[i]!;
    if (e.id === r.ruler.event || e.importance < 3 || !e.subjects.includes(r.ref)) continue;
    const y = yearAt(e.t);
    reign.push(item([`Year ${y}: `, link(claimOf(world, e.id), e.id)], e.id, y));
  }
  const home: Block | null = town
    ? {
        type: "text",
        lines: [
          [
            "History keeps where a realm is seated, not where its ruler sleeps. This home is chosen from the ruler's name among the homes nearest the town's square: the same one each time. It changes nothing.",
          ],
        ],
      }
    : null;
  const blocks: Block[] = [
    {
      type: "facts",
      rows: [
        stat("Born", `year ${r.ruler.born}`),
        stat("Who", `a ${r.ruler.sex === FEMALE ? "woman" : "man"} of ${r.town}`),
        stat("How they came to rule", [link(claimOf(world, r.ruler.event), r.ruler.event)], {
          why: r.ruler.event,
        }),
        stat(
          "Seat",
          town
            ? [townLink(world, town.ref), ", ", landLink(world, r.seat, true)]
            : [landLink(world, r.seat)],
        ),
      ],
    },
    { type: "tool", tool: "leader.card", args: { leader: me, short: true } },
    ...(home ? [home] : []),
    { type: "list", title: "In their reign", items: reign },
    { type: "why", title: "How they came to rule", ref: r.ruler.event },
  ];
  return {
    ref,
    kind: "person",
    icon: LEADER_ICON.ruler,
    portrait: {
      kind: "person",
      ref,
      age,
      span: body?.span ?? 70,
      occupation: OCC.leader,
      child: false,
      era: landEra(world, r.seat),
      body,
    },
    title: r.ruler.name,
    subtitle: [
      r.ended === null ? "Ruler of " : "Last ruler of ",
      realmLink(world, r.ref),
      `, ${age}`,
    ],
    color: realmColor(r.ref),
    place: me.town
      ? { scale: "village", town: me.town, person: ref }
      : spot === null
        ? null
        : { scale: "globe", spot },
    stats: [
      stat("Age", `${age}`),
      stat("Rules since", `year ${r.ruler.since}`, { why: r.ruler.event }),
      stat("Rule", governmentWords(r)),
      stat("Lands", count(r.members.length)),
    ],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year,
  };
}

/** A lender's page told of the house they head, and a townsman's page of the leader they are. */
export function withLeaderPage(world: World, ref: string, page: PageModel): PageModel {
  const seat = parseSeatRef(ref);
  if (seat?.trade === "lender") {
    const h = creditOf(world)?.houseIn(seat.town),
      l = h ? lenderLeader(world, h) : null;
    if (h && l)
      return {
        ...page,
        icon: LEADER_ICON.lender,
        subtitle: ["Head of ", houseLink(world, h.ref), " in ", townLink(world, seat.town)],
        place: { scale: "village", town: seat.town, person: ref },
        ...(page.portrait?.kind === "person"
          ? { portrait: { ...page.portrait, occupation: OCC.trader } }
          : {}),
        tabs: page.tabs.map((t): Tab =>
          t.id === "overview"
            ? {
                ...t,
                blocks: [
                  {
                    type: "facts",
                    rows: [
                      stat("House", [houseLink(world, h.ref)], { why: h.event }),
                      stat("It holds", `${worthWords(h.capital)} grain's worth`),
                    ],
                  },
                  { type: "tool", tool: "leader.card", args: { leader: l, short: true } },
                  ...t.blocks,
                ],
              }
            : t,
        ),
      };
  }
  if (ref.startsWith("agent:") && page.kind === "agent") {
    const w = handOf(world).resting,
      a = w?.agents.find((x) => x.id === Number(ref.slice(6)));
    if (w && a?.name) {
      const l = leadersOfTown(world, w.village).find((x) => x.name === a.name);
      if (l)
        return {
          ...page,
          tabs: page.tabs.map((t): Tab =>
            t.id === "overview"
              ? {
                  ...t,
                  blocks: [
                    { type: "facts", rows: [stat("Also", [link(l.title, l.ref)])] },
                    ...t.blocks,
                  ],
                }
              : t,
          ),
        };
    }
  }
  return page;
}
