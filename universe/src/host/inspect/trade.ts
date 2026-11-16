// Trade's last sweep on the pages (p87, sim/trade): in a realm's Treasury tab, its years of plenty and want (how much of its crafts
// stand idle and why), its exchange (what its listed works earn, what holders ask and hope, how far worth is bid past the long run,
// its last crash), its plan (what it shares by need, what that costs) and its price on smoke (who asks it, who refuses it, what is
// cut and at what cost); in a land's Wealth tab, its machines at the crafts' tasks and its town's heart and ground. Every number is
// a store's, read, never reckoned anew. Its cartels show on its Treasury tab and on a good's page; what a land's households buy on
// its Wealth tab. Pages say what, who, cost and effect.
import type { World } from "../../kernel/index.ts";
import type { Block, Span, Stat } from "../../bridge/index.ts";
import { GOODS, HOME_LEVELS } from "../../rules/index.ts";
import {
  CAP,
  CAPITAL_STORE,
  CARTEL_STORE,
  CT,
  DEMAND_STORE,
  DM,
  CY,
  CYCLE_STORE,
  EX,
  EXCHANGE_STORE,
  PL,
  PLAN_STORE,
  RENT_STORE,
  RT,
  SM,
  SMOKE_STORE,
  cartelKey,
  politiesOf,
  refNumber,
  tradeStore,
  type Polity,
} from "../../sim/index.ts";
import { realmLink } from "./names.ts";
import { count, part, stat } from "./words.ts";

const pc = (x: number) => `${Math.round(x * 100)}%`,
  per = (thousandths: number) => pc(thousandths / 1000),
  grain = (n: number) => `${count(Math.round(n))} grain's worth`,
  signed = (tenThousandths: number) =>
    `${tenThousandths >= 0 ? "" : "less "}${(Math.abs(tenThousandths) / 100).toFixed(1)}% a year`;

/** A realm's years of plenty and want, its exchange, its plan and its price on smoke. */
export function realmTradeBlocks(world: World, r: Polity): Block[] {
  const cy = tradeStore(world, CYCLE_STORE)?.get(r.ref),
    ex = tradeStore(world, EXCHANGE_STORE)?.get(r.ref),
    pl = tradeStore(world, PLAN_STORE)?.get(r.ref),
    sm = tradeStore(world, SMOKE_STORE)?.get(r.ref),
    blocks: Block[] = [];
  if (cy) {
    const idle = cy[CY.slack]!,
      rows: Stat[] = [
        stat(
          "Its crafts idle for want of buyers",
          idle > 0 ? per(idle) : "none: what is made is bought",
          {
            why:
              cy[CY.hoard]! > 0
                ? "Where money can be held, a fall in what some earn is a fall in what they spend on others' work, passed on hand to hand."
                : "Goods are bought with goods: a bad harvest is hunger, never idle hands.",
            parts: [
              part("what its people buy of others' work short of its usual", per(cy[CY.harvest]!)),
              part("debts called in as a house of lending failed", per(cy[CY.called]!)),
              part("its works' shares fallen", per(cy[CY.wealth]!)),
              part("passed on through so many hands", (cy[CY.k]! / 100).toFixed(2)),
              part("what its lands owe against a year's food", per(cy[CY.leverage]!)),
              part("how far its money can be held idle", per(cy[CY.hoard]!)),
              part("of what they earn, the many spend", per(cy[CY.spend]!)),
            ],
          },
        ),
        stat(
          "Its harvest this year",
          `${count(cy[CY.food]!)} of food, its usual ${count(cy[CY.usual]!)}`,
        ),
      ];
    if (cy[CY.usualSpent]! > 0)
      rows.push(
        stat(
          "What its people bought of others' work",
          `${grain(cy[CY.spent]!)}, its usual ${grain(cy[CY.usualSpent]!)}`,
        ),
      );
    if (cy[CY.told]! > 0) rows.push(stat("Its last slump told", `year ${cy[CY.told]}`));
    blocks.push({ type: "facts", title: "Years of plenty and want", rows });
  }
  if (ex) {
    const rows: Stat[] = [
      stat("Its listed works are worth", grain(ex[EX.worth]!), {
        parts: [
          part("years of what they earn", (ex[EX.years]! / 100).toFixed(1)),
          part("what they earn a year", grain(ex[EX.earnings]!)),
          part("what holders ask a year", `${(ex[EX.asked]! / 100).toFixed(1)}%`),
          part("the growth holders hope for", signed(ex[EX.hopes]!)),
          part("the growth the long run bears", signed(ex[EX.long]!)),
        ],
      }),
      stat(
        "Bid past what the long run bears",
        ex[EX.bubble]! > 100 ? `${ex[EX.bubble]! - 100}% past` : "not past it",
        {
          why: "Holders hope as the last years went; a run of good ones is bid past what the long run bears, and a falling year among such hopes is a crash.",
        },
      ),
    ];
    if (ex[EX.crash]! > 0)
      rows.push(stat("Its last crash", `year ${ex[EX.crash]}, ${grain(ex[EX.fell]!)} gone`));
    blocks.push({ type: "facts", title: "Its exchange", rows });
  }
  if (pl)
    blocks.push({
      type: "facts",
      title: "Its plan",
      rows: [
        stat("What it shares out by need, not by price", per(pl[PL.planned]!), {
          why: "What the realm holds for all, its plan gives out alike; what it costs is what the plan cannot know, and the effort of those whose share no longer follows their work.",
        }),
        stat("What the plan costs its crafts", per(pl[PL.loss]!), {
          parts: [
            part("made that none wanted, or wanted and not made", per(pl[PL.errs]!)),
            part("effort lost", per(pl[PL.shirk]!)),
            part("how well it knows what is wanted", per(pl[PL.knows]!)),
            part(
              "lands and goods it must know of",
              `${count(pl[PL.lands]!)} and ${count(pl[PL.goods]!)}`,
            ),
            part("its people live as one", per(pl[PL.social]!)),
          ],
        }),
      ],
    });
  if (sm)
    blocks.push({
      type: "facts",
      title: "Its works' smoke",
      rows: [
        stat(
          "Its price on smoke",
          sm[SM.price]! > 0
            ? `${per(sm[SM.price]!)} of the harm it does`
            : "none: it is no one's cost",
          {
            parts: [
              part("how foul its people's air would be", per(sm[SM.harm]!)),
              part("the say of those who breathe it", per(sm[SM.breathers]!)),
              part("the say of those who hold the works", per(sm[SM.holders]!)),
              part("how far it can measure it", per(sm[SM.measured]!)),
              part("knows smoke sickens", sm[SM.knows]! > 0 ? "yes" : "no"),
            ],
          },
        ),
        stat("What its works cut of their smoke", per(sm[SM.abated]!), {
          parts: [part("what cutting it costs their crafts", per(sm[SM.cost]!))],
        }),
      ],
    });
  // The goods it sells abroad as one with other realms.
  const sells = realmCartelRows(world, r);
  if (sells.length) blocks.push({ type: "facts", title: "Its cartels", rows: sells });
  return blocks;
}

/** The realms of a cartel row, as links. */
function membersOf(world: World, row: readonly number[]): Span[] {
  const by = new Map<number, string>(
      politiesOf(world)
        .living()
        .map((p) => [refNumber(p.ref) + 1, p.ref] as const),
    ),
    out: Span[] = [];
  for (let i = 0; i < 5; i++) {
    const ref = by.get(row[CT.members + i]!);
    if (!ref) continue;
    if (out.length) out.push(", ");
    out.push(realmLink(world, ref));
  }
  return out;
}

function cartelStat(world: World, g: number, row: readonly number[], label: string): Stat {
  return stat(label, [`${per(row[CT.markup]!)} above, by `, ...membersOf(world, row)], {
    why: "Where a few realms make most of a good, can see one another ship more than agreed, and outside makers are kept out, they sell it abroad as one, as dear as buyers who can go without it allow.",
    parts: [
      part("their share of the world's making", per(row[CT.share]!)),
      part("how well they hold together", per(row[CT.cohesion]!)),
      part("of the world's lands, those that make none", per(row[CT.barred]!)),
      part("since", `year ${row[CT.since]}`),
      part("the good", GOODS[g]!.name),
    ],
  });
}

/** The goods a realm sells abroad by a cartel. */
export function realmCartelRows(world: World, r: Polity): Stat[] {
  const store = tradeStore(world, CARTEL_STORE),
    n = refNumber(r.ref) + 1,
    rows: Stat[] = [];
  if (!store) return rows;
  for (let g = 0; g < GOODS.length; g++) {
    const row = store.get(cartelKey(g));
    if (!row) continue;
    let member = false;
    for (let i = 0; i < 5; i++) if (row[CT.members + i] === n) member = true;
    if (member) rows.push(cartelStat(world, g, row, `Its ${GOODS[g]!.name} sold abroad`));
  }
  return rows;
}

/** A good's cartel among realms, as the good's page shows it (none: no cartel holds it). */
export function goodCartelRows(world: World, good: number): Stat[] {
  const row = tradeStore(world, CARTEL_STORE)?.get(cartelKey(good));
  return row ? [cartelStat(world, good, row, "Sold abroad by a cartel")] : [];
}

/** A land's machines at the crafts' tasks, and its town's heart and ground. */
export function landTradeBlocks(world: World, cell: number): Block[] {
  const dm = tradeStore(world, DEMAND_STORE)?.get(cell),
    cap = tradeStore(world, CAPITAL_STORE)?.get(cell),
    rent = tradeStore(world, RENT_STORE)?.get(cell),
    blocks: Block[] = [];
  if (dm)
    blocks.push({
      type: "facts",
      title: "What its households buy",
      rows: [
        stat(
          "What the land makes, in years of its people's food",
          (dm[DM.income]! / 1000).toFixed(2),
          {
            why: "What households buy of their wares follows what they earn (wares the more as there is more, food little more once fed) and what the wares cost against their worth, within what is left past their food and what they can borrow.",
          },
        ),
        stat(
          "Of what they need, they buy",
          `tools ${per(dm[DM.tools]!)}, clothing ${per(dm[DM.clothing]!)}, pots ${per(dm[DM.pottery]!)}`,
          { parts: [part("what their means allow of what they would buy", per(dm[DM.scale]!))] },
        ),
      ],
    });
  if (cap)
    blocks.push({
      type: "facts",
      title: "Machines at the work",
      rows: [
        stat("Of its crafts' tasks, machines do", per(cap[CAP.share]!), {
          why: "A task goes to a machine where the land's machines are fine enough to do it, reckon well enough to judge it, have the power to turn, and cost less a year than the hand they stand in for.",
          parts: [
            part("the tasks its machines could do", per(cap[CAP.can]!)),
            part("a hand's year by machines costs", grain(cap[CAP.cost]! / 1000)),
            part("a crafter's year earns", grain(cap[CAP.wage]! / 1000)),
          ],
        }),
        stat("Hands they stand in for", count(cap[CAP.hands]!)),
        stat("What their holders take a year", grain(cap[CAP.income]!)),
      ],
    });
  if (rent)
    blocks.push({
      type: "facts",
      title: "Its town's ground",
      rows: [
        stat("Its heart is built to", HOME_LEVELS[rent[RT.level]!] ?? "huts", {
          why: "A household at the heart saves the walk the town's edge would cost it; the heart is built as tall as its people can raise where that saving pays for building so.",
          parts: [
            part("its greatest town's people", count(rent[RT.people]!)),
            part(
              "a household saves there a year",
              `${(rent[RT.heart]! / 100).toFixed(2)}% of a year's work`,
            ),
          ],
        }),
        stat("What its ground earns its holders a year", grain(rent[RT.rent]!), {
          parts: [part("what that ground is worth", grain(rent[RT.worth]!))],
        }),
      ],
    });
  return blocks;
}
