// Lives L5 as pages: a realm's Court tab (the ruler, the heir and why, the rival and why, the voices and what each wants,
// what has passed), and a page for each of its people (who they are in this drama, what they want and why, what they
// did). Pure reads of the world as it stands: asking moves nothing.
import type { Ref, World } from "../../kernel/index.ts";
import { FEMALE, OCC, mustCarry } from "../../rules/index.ts";
import { courtOf, politiesOf, realmName, type Polity } from "../../sim/index.ts";
import { governmentWords } from "../../causal/index.ts";
import {
  LEADER_ICON,
  type Block,
  type Item,
  type PageModel,
  type Stat,
} from "../../bridge/index.ts";
import { realmColor } from "../colors.ts";
import {
  courtFigure,
  courtLeader,
  courtLeaders,
  heirWhy,
  parseCourtRef,
  reasonsOf,
  roleOf,
  seatWords_,
  wantWords,
} from "../court.ts";
import { rulerLeader, seatTownOf } from "../leaders.ts";
import { landEra, peopleBody } from "../village.ts";
import { landLink, realmLink, townLink } from "./names.ts";
import { asRef, claimOf, item, link, stat, yearAt, yearNow } from "./words.ts";

const pct = (x: number) => Math.round(x * 100);

/** What has passed at a court, newest first. */
function toldItems(world: World, told: readonly Ref[], only?: number): Item[] {
  const out: Item[] = [];
  for (let i = told.length - 1; i >= 0; i--) {
    const e = world.events.get(told[i]!);
    if (!e) continue;
    if (only !== undefined && (e.data as { fig?: number } | null)?.fig !== only) continue;
    const y = yearAt(e.t);
    out.push(item([`Year ${y}: `, link(claimOf(world, e.id), e.id)], e.id, y));
  }
  return out;
}

/** A realm's Court tab. */
export function courtBlocks(world: World, r: Polity): Block[] {
  const c = courtOf(world)?.of(r.ref),
    carry = mustCarry(r.leadership, r.succession);
  if (r.ended !== null)
    return [{ type: "text", lines: [["Its court went with it: only what it did is kept."]] }];
  const blocks: Block[] = [
    {
      type: "text",
      lines: [
        [
          `${seatWords_(world, r)} ${carry > 0 ? `Its ruler must carry ${pct(carry)} in a hundred of its voices.` : "Its ruler rules alone."}`,
        ],
      ],
    },
  ];
  if (c?.plot)
    blocks.push({
      type: "text",
      lines: [
        ["🗡️ Afoot now: ", link(claimOf(world, c.plot.event), c.plot.event)],
        [
          `It comes to its end within the year: ${pct(c.plot.odds)} in a hundred it takes the seat.`,
        ],
      ],
    });
  blocks.push({ type: "tool", tool: "leader.card", args: { leader: rulerLeader(world, r) } });
  for (const l of courtLeaders(world, r))
    blocks.push({ type: "tool", tool: "leader.card", args: { leader: l } });
  if (!c?.figures.length)
    blocks.push({
      type: "text",
      lines: [["No one stands near the seat yet: a court fills as a seat changes hands."]],
    });
  const told = c ? toldItems(world, c.told) : [];
  if (told.length)
    blocks.push({ type: "list", title: "What has passed at this court", items: told });
  return blocks;
}

/** A page of one of a court. */
export function courtPage(world: World, ref: string): PageModel {
  const at = parseCourtRef(ref),
    r = at ? politiesOf(world).get(asRef(at.realm)) : undefined;
  if (!at || !r) throw new Error(`no one at court ${ref}`);
  const read = courtFigure(world, ref),
    year = yearNow(world),
    f = read?.f ?? null,
    gone = read?.gone ?? null,
    c = read?.c ?? null,
    who = f ?? gone,
    town = seatTownOf(world, r),
    body = peopleBody(world);
  // (Long gone from a court that keeps only a few: what history still says of them is all there is.)
  if (!who)
    return {
      ref,
      kind: "person",
      icon: "🕯️",
      title: "One gone from the court",
      subtitle: ["Once of the court of ", realmLink(world, r.ref)],
      color: realmColor(r.ref),
      place: null,
      stats: [],
      tabs: [
        {
          id: "overview",
          name: "Overview",
          blocks: [
            {
              type: "text",
              lines: [
                ["History keeps what they did and no more: it is in the chronicle of their realm."],
              ],
            },
          ],
        },
      ],
      followable: false,
      year,
    };
  const age = (gone ? gone.year : year) - who.born,
    role = f && c ? roleOf(c, f) : (["Once of the court of ", ""] as const),
    me = f && c ? courtLeader(world, r, c, f) : null,
    how = gone
      ? (
          {
            died: `Died in year ${gone.year}, at ${age}.`,
            seated: `Left the court for the seat itself, in year ${gone.year}.`,
            found: `Their move was found, in year ${gone.year}: gone from the court, and dead by now as far as history says.`,
            fled: `Fled the court in year ${gone.year}, and raised the far lands.`,
            "stood down": `Stood down in year ${gone.year}.`,
          } as const
        )[gone.how]
      : null,
    blocks: Block[] = [
      {
        type: "facts",
        rows: [
          stat("Born", `year ${who.born}`),
          stat("Who", `a ${who.sex === FEMALE ? "woman" : "man"} of ${r.town}`),
          ...(town
            ? [stat("Seat", [townLink(world, town.ref), ", ", landLink(world, r.seat, true)])]
            : []),
          ...(f ? [stat("At court since", `year ${f.since}`)] : []),
          ...(gone?.event
            ? [
                stat("How it ended", [link(claimOf(world, gone.event), gone.event)], {
                  why: gone.event,
                }),
              ]
            : []),
        ] as Stat[],
      },
    ];
  if (how) blocks.push({ type: "text", lines: [[how]] });
  if (me) blocks.push({ type: "tool", tool: "leader.card", args: { leader: me, short: true } });
  if (f && c) {
    const lines: string[] = [];
    if (f.id === c.heir) lines.push(`Heir to the seat. ${heirWhy(world, r, c, f)}`);
    if (f.id === c.regent) lines.push(`Holds the seat for ${r.ruler.name}, who is a child.`);
    if (f.id === c.rival) lines.push(`Wants the seat of ${realmName(r)}.`);
    if (f.id !== c.heir && f.id !== c.rival) lines.push(wantWords(world, r, c, f));
    blocks.push({ type: "text", title: "In this drama", lines: lines.map((l) => [l]) });
    if (f.id === c.rival) {
      const items = reasonsOf(world, r, c, f).map((x) =>
        item([x.why ? link(x.words, x.why) : x.words], x.why),
      );
      blocks.push({ type: "list", title: "Why they want it", items });
    }
    if (c.plot?.by === f.id)
      blocks.push({ type: "why", title: "Why they moved", ref: c.plot.event });
  }
  const told = c ? toldItems(world, c.told, at.id) : [];
  blocks.push(
    told.length
      ? { type: "list", title: "What they did", items: told }
      : { type: "text", title: "What they did", lines: [["Nothing yet that history tells."]] },
  );
  return {
    ref,
    kind: "person",
    icon:
      f && c ? LEADER_ICON[f.id === c.heir ? "heir" : f.id === c.rival ? "rival" : "voice"] : "🕯️",
    portrait: {
      kind: "person",
      ref,
      age,
      span: body?.span ?? 70,
      occupation: who.seat === "traders" ? OCC.trader : OCC.leader,
      child: age < 16,
      era: landEra(world, r.seat),
      body,
    },
    title: who.name,
    subtitle: [role[0], realmLink(world, r.ref), `${role[1]}, ${age}`],
    color: realmColor(r.ref),
    place: me?.town ? { scale: "village", town: me.town, person: ref } : null,
    stats: [
      stat("Age", `${age}`),
      ...(f ? [stat("Sway", `${pct(f.sway)} in a hundred`)] : []),
      stat("Rule", governmentWords(r)),
    ],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year,
  };
}
