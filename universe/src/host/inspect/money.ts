// Money and the state on the pages (Round B, sim/money): a realm's Treasury tab (what serves it as money and what it buys, its taxes
// by base and why, what it spends, its reserve and deficit, its tariff and sanctions, what slips past its borders, its underwriters
// and pooled harvests) and Labour tab (whom its lands bind and why, its guilds and unions, how its lands' income is shared); a land's
// Wealth tab (what each good is worth there and on what it rests, what its makers can ask, its rent and its Lorenz curve, whom its
// holders would bind). Every number is a store's, read, never reckoned anew; the inequality lens reads a land's Gini.
import { potencyStat } from "./mobs.ts";
import {
  landTastesBlocks,
  realmContrabandBlocks,
  realmKindBlocks,
  realmTastesBlocks,
} from "./tastes.ts";
import type { World } from "../../kernel/index.ts";
import type { Block, Row, Stat } from "../../bridge/index.ts";
import { cellRef } from "../../gen/index.ts";
import {
  BASIS_WORDS,
  INTOX_KINDS,
  INTOX_WORDS,
  kindCost,
  GOODS,
  GOOD_USE,
  MONEY_FORMS,
  MONEY_WORDS,
  PRICE_BASES,
  TAX_BASES,
  TAX_WORDS,
  USE_WORDS,
  type MoneyForm,
} from "../../rules/index.ts";
import {
  BAR,
  BAR_STORE,
  INTOX,
  INTOX_STORE,
  BIND,
  BIND_STORE,
  COIN,
  COIN_STORE,
  COVER_STORE,
  DUTY,
  FISC,
  GOODS_STORE,
  GUILD,
  LABOUR_STORE,
  POOL,
  SHARE,
  SHARES_STORE,
  SMUGGLE,
  SMUGGLE_STORE,
  TARIFF_STORE,
  TREASURY_STORE,
  marketsOf,
  moneyStore,
  politiesOf,
  kindReach,
  populationContext,
  type Polity,
} from "../../sim/index.ts";
import { realmLink } from "./names.ts";
import { landName } from "./annals.ts";
import { count, link, part, stat } from "./words.ts";

const pc = (x: number) => `${Math.round(x * 100)}%`,
  per = (thousandths: number) => pc(thousandths / 1000),
  cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s),
  grain = (n: number) => `${count(Math.round(n))} grain's worth`;

/** The names of the five fifths, poorest first. */
const FIFTHS = [
  "the poorest fifth",
  "the next",
  "the middle fifth",
  "the next",
  "the richest fifth",
];

// —— A realm's Treasury ——————————————————————————————————————————————————————————————————————————————————————

export function realmTreasuryBlocks(world: World, r: Polity): Block[] {
  const coin = moneyStore(world, COIN_STORE)?.get(r.ref),
    fisc = moneyStore(world, TREASURY_STORE)?.get(r.ref),
    duty = moneyStore(world, TARIFF_STORE)?.get(r.ref),
    smuggle = moneyStore(world, SMUGGLE_STORE)?.get(r.ref),
    cover = moneyStore(world, COVER_STORE)?.get(r.ref),
    blocks: Block[] = [];
  if (!coin && !fisc) return [];
  // What serves as money.
  if (coin) {
    const form = MONEY_FORMS[coin[COIN.form]!] as MoneyForm,
      good = GOODS[coin[COIN.good]!],
      rows: Stat[] = [
        stat(
          "Its money",
          form === "metal" && good ? `coin struck of ${good.name}` : MONEY_WORDS[form],
          { parts: [part("since", `year ${coin[COIN.since]}`)] },
        ),
      ];
    if (form !== "barter") {
      const level = coin[COIN.level]! / 1e6;
      rows.push(
        stat(
          "A grain's worth costs",
          `${level >= 10 ? count(Math.round(level)) : level.toPrecision(3)} of its money`,
          {
            parts: [
              part("money in hand", count(Math.round(coin[COIN.stock]! / 1000))),
              part("times it changes hands a year", (coin[COIN.velocity]! / 100).toFixed(1)),
              part("passing through its markets a year", grain(coin[COIN.made]!)),
            ],
          },
        ),
        stat(
          "Prices last year",
          coin[COIN.inflation]! === 0
            ? "held"
            : `${coin[COIN.inflation]! > 0 ? "rose" : "fell"} ${pc(Math.abs(coin[COIN.inflation]!) / 10_000)}`,
        ),
      );
      if (form === "metal")
        rows.push(
          stat("Metal in its coin", `${pc(coin[COIN.fine]! / 1e6)} of what its first coin held`, {
            parts: [part("its treasury went short and did not borrow", grain(coin[COIN.unmet]!))],
          }),
        );
      if (coin[COIN.seigniorage]! > 0)
        rows.push(stat("Making money gave its treasury", grain(coin[COIN.seigniorage]!)));
    }
    blocks.push({ type: "facts", title: "Money", rows });
  }
  // Its taxes, base by base.
  if (fisc) {
    const rows: Row[] = TAX_BASES.map((b, k) => ({
      cells: [
        [cap(TAX_WORDS[b])],
        [grain(fisc[FISC.base + k]!)],
        [per(fisc[FISC.measured + k]!)],
        [per(fisc[FISC.resisted + k]!)],
        [`${(fisc[FISC.rate + k]! / 10).toFixed(1)}%`],
        [grain(fisc[FISC.take + k]!)],
      ],
      keys: [
        b,
        fisc[FISC.base + k]!,
        fisc[FISC.measured + k]!,
        fisc[FISC.resisted + k]!,
        fisc[FISC.rate + k]!,
        fisc[FISC.take + k]!,
      ],
    }));
    blocks.push({
      type: "table",
      title: "What it taxes",
      columns: ["Base", "Its size a year", "Measured", "Refused", "Rate", "It takes"],
      rows,
      fit: true,
    });
    const spent = fisc[FISC.arms]! + fisc[FISC.clerks]! + fisc[FISC.relief]! + fisc[FISC.interest]!,
      took =
        fisc[FISC.take]! +
        fisc[FISC.take + 1]! +
        fisc[FISC.take + 2]! +
        fisc[FISC.take + 3]! +
        fisc[FISC.tariffs]! +
        fisc[FISC.seigniorage]! +
        (fisc[FISC.excise] ?? 0);
    blocks.push({
      type: "facts",
      title: "Its treasury's year",
      rows: [
        stat("It took in", grain(took), {
          parts: [
            part(
              "taxes",
              grain(
                took - fisc[FISC.tariffs]! - fisc[FISC.seigniorage]! - (fisc[FISC.excise] ?? 0),
              ),
            ),
            part("tariffs", grain(fisc[FISC.tariffs]!)),
            part("making money", grain(fisc[FISC.seigniorage]!)),
            part("intoxicants", grain(fisc[FISC.excise] ?? 0)),
          ],
        }),
        stat("It spent", grain(spent), {
          parts: [
            part("its men under arms", grain(fisc[FISC.arms]!)),
            part("its clerks and court", grain(fisc[FISC.clerks]!)),
            part("relief", grain(fisc[FISC.relief]!)),
            part("interest", grain(fisc[FISC.interest]!)),
          ],
        }),
        stat("Kept by it", grain(fisc[FISC.reserve]!)),
        ...(fisc[FISC.deficit]! > 0
          ? [
              stat("Went short", grain(fisc[FISC.deficit]!), {
                parts: [part("borrowed against it", grain(fisc[FISC.borrowed]!))],
              }),
            ]
          : []),
        stat("Its taxes beyond the tithe", `${per(fisc[FISC.burden]!)} of what its people make`),
      ],
    });
  }
  // What it lays on goods from abroad, and whom it shuts out.
  if (duty) {
    const realms = politiesOf(world),
      rows: Stat[] = [
        stat("On goods from abroad", `${per(duty[DUTY.rate]!)} of their worth`, {
          parts: [
            part(
              "crafters undersold",
              `${duty[DUTY.parts]! >= 0 ? "+" : ""}${(duty[DUTY.parts]! / 10).toFixed(1)}`,
            ),
            part("traders who cross its borders", (duty[DUTY.parts + 1]! / 10).toFixed(1)),
            part("the many who buy", (duty[DUTY.parts + 2]! / 10).toFixed(1)),
            part("a treasury going short", `+${(duty[DUTY.parts + 3]! / 10).toFixed(1)}`),
            part("sellers who bear part", `+${(duty[DUTY.parts + 4]! / 10).toFixed(1)}`),
          ],
        }),
        stat("Goods from abroad a year", grain(duty[DUTY.imports]!), {
          parts: [part("its tariff took", grain(duty[DUTY.revenue]!))],
        }),
      ];
    for (let k = 0; k < 3; k++) {
      const serial = duty[DUTY.sanctions + 2 * k]!,
        shut = duty[DUTY.sanctions + 2 * k + 1]!;
      if (!serial || shut < 20) continue;
      const other = realms.all().find((q) => Number(q.ref.split(":").at(-1)) === serial - 1);
      rows.push(
        stat("Shut by its fear", [
          realmLink(world, other?.ref),
          `: ${per(shut)} of the trade between them`,
        ]),
      );
    }
    if (smuggle && smuggle[SMUGGLE.share]! > 0)
      rows.push(
        stat("Slips past its borders", `${per(smuggle[SMUGGLE.share]!)} of what it bars or taxes`, {
          parts: [
            part("the wedge", per(smuggle[SMUGGLE.wedge]!)),
            part("worth smuggled a year", grain(smuggle[SMUGGLE.worth]!)),
            part("tariff lost", grain(smuggle[SMUGGLE.lost]!)),
          ],
        }),
      );
    blocks.push({ type: "facts", title: "Its borders", rows });
  }
  // What crosses its borders unseen, ware by ware, and why (sim/money/contraband.ts).
  blocks.push(...realmContrabandBlocks(world, r));
  // What calms, wakes, brings visions and eases pain: its law on them, its trade in them, who carries them where they are forbidden.
  blocks.push(...realmIntoxBlocks(world, r));
  // What its people love beyond the world's middle, and what it comes to there.
  blocks.push(...realmTastesBlocks(world, r));
  // Its underwriters and its pooled harvests.
  if (cover && (cover[POOL.insured]! > 0 || cover[POOL.pooled]! > 0))
    blocks.push({
      type: "facts",
      title: "Risk pooled",
      rows: [
        ...(cover[POOL.insured]! > 0
          ? [
              stat("Cargoes insured at sea", per(cover[POOL.insured]!), {
                parts: [
                  part("lost on a voyage", `${(cover[POOL.loss]! / 100).toFixed(1)}%`),
                  part("its sea trade a year", grain(cover[POOL.seaTrade]!)),
                ],
              }),
            ]
          : []),
        ...(cover[POOL.pooled]! > 0
          ? [
              stat("Harvests pooled", per(cover[POOL.pooled]!), {
                parts: [
                  part("how far they swing", per(cover[POOL.swing]!)),
                  part("in the pool", `${count(cover[POOL.reserve]!)} grain`),
                  part("paid in this year", `${count(cover[POOL.premiums]!)} grain`),
                ],
              }),
            ]
          : []),
      ],
    });
  return blocks;
}

// —— A realm's Labour ————————————————————————————————————————————————————————————————————————————————————————

export function realmLabourBlocks(world: World, r: Polity): Block[] {
  const binds = moneyStore(world, BIND_STORE),
    guilds = moneyStore(world, LABOUR_STORE),
    shares = moneyStore(world, SHARES_STORE),
    ctx = populationContext(world),
    blocks: Block[] = [];
  if (!binds && !guilds && !shares) return [];
  const lands = r.members
    .map((c) => ({ c, people: ctx.provinces.get(c)?.total() ?? 0 }))
    .filter((l) => l.people > 0)
    .sort((a, b) => b.people - a.people || a.c - b.c);
  // Whom its lands' holders would bind, and why.
  const bound: Row[] = [];
  for (const { c } of lands) {
    const b = binds?.get(c);
    if (!b || b[BIND.share]! < 5) continue;
    bound.push({
      ref: cellRef(0, c),
      cells: [
        [link(landName(world, c), cellRef(0, c))],
        [per(b[BIND.share]!)],
        [per(b[BIND.gain]!)],
        [per(b[BIND.hold]!)],
        [(b[BIND.open]! / 1000).toFixed(2)],
      ],
      keys: [c, b[BIND.share]!, b[BIND.gain]!, b[BIND.hold]!, b[BIND.open]!],
    });
  }
  if (bound.length)
    blocks.push({
      type: "table",
      title: "Whom its holders would bind",
      columns: ["Land", "Of its people", "Kept by binding", "Held by arms", "Open land a head"],
      rows: bound,
      few: 8,
      fit: true,
    });
  // Its guilds and unions.
  let guild = 0,
    union = 0;
  for (const { c } of lands) {
    const g = guilds?.get(c);
    if (!g) continue;
    if (g[GUILD.guild]! >= 300) guild++;
    if (g[GUILD.union]! >= 300) union++;
  }
  if (guild || union)
    blocks.push({
      type: "facts",
      title: "Those who work, bound together",
      rows: [
        ...(guild ? [stat("Lands whose crafters keep a guild", count(guild))] : []),
        ...(union ? [stat("Lands whose works' hands keep a union", count(union))] : []),
      ],
    });
  // How income is shared in its seat, and its least and most equal lands.
  const seat = shares?.get(r.seat);
  if (seat) blocks.push(...lorenzBlocks(seat, "How its seat's income is shared"));
  const ranked = lands
    .map(({ c, people }) => ({ c, people, row: shares?.get(c) }))
    .filter((l) => l.row)
    .sort((a, b) => b.row![SHARE.gini]! - a.row![SHARE.gini]! || a.c - b.c);
  if (ranked.length > 1)
    blocks.push({
      type: "table",
      title: "Its lands, least equal first",
      columns: ["Land", "Gini", "Richest tenth", "Rent of its harvest"],
      rows: ranked.map((l) => ({
        ref: cellRef(0, l.c),
        cells: [
          [link(landName(world, l.c), cellRef(0, l.c))],
          [(l.row![SHARE.gini]! / 1000).toFixed(2)],
          [per(l.row![SHARE.top]!)],
          [per(l.row![SHARE.rentShare]!)],
        ],
        keys: [l.c, l.row![SHARE.gini]!, l.row![SHARE.top]!, l.row![SHARE.rentShare]!],
      })),
      few: 6,
      fit: true,
    });
  return blocks;
}

/** A land's Lorenz curve, drawn, and its five fifths as bars. */
function lorenzBlocks(row: readonly number[], title: string): Block[] {
  const points = [{ x: 0, y: 0 }];
  let sum = 0;
  for (let k = 0; k < 5; k++) {
    sum += row[SHARE.fifths + k]! / 1000;
    points.push({ x: (k + 1) / 5, y: Math.min(1, sum) });
  }
  return [
    {
      type: "chart",
      title: `${title}: the Lorenz curve (Gini ${(row[SHARE.gini]! / 1000).toFixed(2)})`,
      points,
      unit: "share",
    },
    {
      type: "bars",
      title: "What each fifth of its people earns of the whole",
      bars: FIFTHS.map((name, k) => ({ label: [cap(name)], value: row[SHARE.fifths + k]! / 1000 })),
      unit: "share",
    },
  ];
}

// —— A land's Wealth ——————————————————————————————————————————————————————————————————————————————————————————

export function landWealthBlocks(world: World, cell: number): Block[] {
  const goods = moneyStore(world, GOODS_STORE)?.get(cell),
    guild = moneyStore(world, LABOUR_STORE)?.get(cell),
    share = moneyStore(world, SHARES_STORE)?.get(cell),
    bind = moneyStore(world, BIND_STORE)?.get(cell),
    m = marketsOf(world).get(cell),
    blocks: Block[] = [];
  if (goods && m) {
    const basisOf = (g: number) => {
      let n = goods[14 + (g >= 7 ? 1 : 0)]!;
      for (let k = 0; k < g % 7; k++) n = Math.floor(n / 6);
      return PRICE_BASES[n % 6]!;
    };
    blocks.push({
      type: "table",
      title: "What its goods are worth, and why",
      columns: ["Good", "Fetches", "Worth", "Worth rests on", "What it does"],
      rows: GOODS.map((good, g) => {
        const b = basisOf(g);
        return {
          cells: [
            [cap(good.name)],
            [m.price[g]!.toFixed(2)],
            [(goods[g]! / 1000).toFixed(2)],
            [BASIS_WORDS[b]],
            [USE_WORDS[GOOD_USE[good.id]!]],
          ],
          keys: [good.name, m.price[g]!, goods[g]!, b, GOOD_USE[good.id]!],
        };
      }),
      few: 14,
      fit: true,
    });
  }
  if (guild) {
    const rows: Stat[] = [
      stat("What its makers ask above their cost", `${per(guild[GUILD.markup]!)} of the price`, {
        parts: [part("shops", count(guild[GUILD.shops]!))],
      }),
    ];
    if (guild[GUILD.guild]! > 0)
      rows.push(stat("Its crafters' guild", `${per(guild[GUILD.guild]!)} as one`));
    if (guild[GUILD.union]! > 0)
      rows.push(
        stat("Its works' union", `${per(guild[GUILD.union]!)} as one`, {
          parts: [part("their wage above what it would be", per(guild[GUILD.wage]!))],
        }),
      );
    blocks.push({ type: "facts", title: "Its market's makers", rows });
  }
  if (share) {
    blocks.push(...lorenzBlocks(share, "How its income is shared"));
    blocks.push({
      type: "facts",
      title: "Its land's rent",
      rows: [
        stat("Its fields' and herds' rent", grain(share[SHARE.rent]!), {
          parts: [
            part("of their yield", per(share[SHARE.rentShare]!)),
            part("of its people who hold its land", per(share[SHARE.holders]!)),
          ],
        }),
      ],
    });
  }
  blocks.push(...landIntoxBlocks(world, cell));
  blocks.push(...landTastesBlocks(world, cell));
  if (bind && bind[BIND.share]! > 0)
    blocks.push({
      type: "facts",
      title: "Whom its holders would bind",
      rows: [
        stat("Of its people", per(bind[BIND.share]!), {
          parts: [
            part("a tiller's wage above his living", per(bind[BIND.gain]!)),
            part("how far its realm's arms hold the bound", per(bind[BIND.hold]!)),
            part("open land a head to flee to", (bind[BIND.open]! / 1000).toFixed(2)),
            part("what its law allows", per(bind[BIND.law]!)),
          ],
        }),
      ],
    });
  return blocks;
}

// —— The inequality lens ——————————————————————————————————————————————————————————————————————————————————————

/** A land's Gini for the lens (0 … 1; -1 where none is kept). */
export function inequalityValue(world: World, cell: number): number {
  const row = moneyStore(world, SHARES_STORE)?.get(cell);
  return row ? row[SHARE.gini]! / 1000 : -1;
}

/** A land under the inequality lens, for the tooltip under the pointer. */
export function inequalityReading(
  world: World,
  cell: number,
): { line: string; stats: { label: string; value: string }[] } | null {
  const row = moneyStore(world, SHARES_STORE)?.get(cell);
  if (!row) return null;
  return {
    line: `Gini ${(row[SHARE.gini]! / 1000).toFixed(2)}`,
    stats: [
      { label: "The richest tenth earn", value: per(row[SHARE.top]!) },
      { label: "The poorest fifth earn", value: per(row[SHARE.fifths]!) },
      { label: "Rent of its harvest", value: per(row[SHARE.rentShare]!) },
    ],
  };
}

// —— Intoxicants ——————————————————————————————————————————————————————————————————————————————————————————————

/** The six who press for and against forbidding them, as a realm's row keeps their weights. */
const BAR_PARTS = [
  "the temple, whose rites do not use them",
  "the court, whose people's work they take",
  "a realm held hard",
  "traders who live by their trade",
  "what its treasury takes of them",
  "their takers, as far as they are heard",
  // (Kept from its 7th part on, BAR.more: those its harm falls on, and what a ban costs to keep.)
  "the kin of those who need them and of their dead, as far as they are heard",
  "masters and guilds who lose their days",
  "the temple, which cares for those they ruin",
  "healers who tend them",
  "what a ban costs: its crackdown, and its smugglers' rents that buy its officers",
];

/** A realm's law on intoxicants and their trade (what, who, cost and effect). */
export function realmIntoxBlocks(world: World, r: Polity): Block[] {
  const row = moneyStore(world, BAR_STORE)?.get(r.ref);
  if (!row || (row[BAR.demand]! <= 0 && row[BAR.barred]! <= 0)) return [];
  const barred = row[BAR.barred]!,
    rows: Stat[] = [
      stat(
        "Its law on them",
        barred >= 500
          ? `forbidden (${per(barred)})`
          : barred >= 100
            ? `frowned on (${per(barred)})`
            : "allowed",
        {
          parts: BAR_PARTS.map((name, k) => {
            const v = (row[k < 6 ? BAR.parts + k : BAR.more + k - 6] ?? 0) / 1000;
            return part(name, `${v >= 0 ? "+" : ""}${v.toFixed(2)}`);
          }).filter((x, k) => k < 6 || x.value !== "+0.00"),
        },
      ),
      stat("Its people's use a year", `${count(row[BAR.demand]!)} users' worth`, {
        parts: [
          part("its lands' own life could give", `${count(row[BAR.supply]!)} users' worth`),
          part("bought from abroad", `${count(row[BAR.imported]!)} users' worth`),
          part("a user's year costs", `${(row[BAR.price]! / 1000).toFixed(2)} grain's worth`),
        ],
      }),
      stat(
        row[BAR.monopoly] ? "Its treasury keeps the trade itself" : "Its excise on them",
        `${per(row[BAR.excise]!)} of their worth`,
        { parts: [part("it took this year", grain(row[BAR.revenue]!))] },
      ),
    ];
  if (row[BAR.drained]! > 0)
    rows.push(
      stat("Its money paid abroad for them", grain(row[BAR.drained]!), {
        parts: [
          part("of what passes through its markets", `${(row[BAR.drain]! / 10).toFixed(1)}%`),
        ],
      }),
    );
  if (row[BAR.cartel]! > 0)
    rows.push(stat("Those who carry them past its law, organised", per(row[BAR.cartel]!)));
  // (How strong the trade has grown under its law: the underworld, host/inspect/mobs.ts.)
  const strong = potencyStat(world, r.ref);
  if (strong) rows.push(strong);
  return [
    { type: "facts", title: "What calms, wakes and eases", rows },
    ...realmKindBlocks(world, r),
  ];
}

/** A land's intoxicants: what its life puts in reach, who takes it, what it gives and costs (never how it is made). */
export function landIntoxBlocks(world: World, cell: number): Block[] {
  const row = moneyStore(world, INTOX_STORE)?.get(cell);
  if (!row) return [];
  const realm = politiesOf(world).of(cell),
    rows: Row[] = INTOX_KINDS.map((k, i) => {
      const use = row[INTOX.use + i]! / 1000,
        abroad = realm && realm.ended === null ? kindReach(world, realm.ref, i) : 0,
        cost = kindCost(k, use);
      return {
        cells: [
          [cap(INTOX_WORDS[k].name)],
          [per(row[INTOX.have + i]!)],
          [abroad > 0.05 ? pc(abroad) : "—"],
          [per(row[INTOX.use + i]!)],
          [
            use > 0
              ? `${(cost.dependent * 1000).toFixed(1)}‰ need it, ${(cost.deaths * 1e5).toFixed(1)} die a year in 100,000`
              : "—",
          ],
          [INTOX_WORDS[k].does],
        ],
        keys: [k, row[INTOX.have + i]!, Math.round(abroad * 1000), row[INTOX.use + i]!, k, k],
      };
    });
  if (!rows.some((x) => (x.keys![1] as number) > 0 || (x.keys![3] as number) > 0)) return [];
  const lost = row[INTOX.lost]!;
  return [
    {
      type: "table",
      title: "What calms, wakes, brings visions and eases pain",
      columns: ["What", "Grows here", "From abroad", "Taken by", "What it costs", "What it does"],
      rows,
      fit: true,
    },
    {
      type: "facts",
      title: "What it gives and costs",
      rows: [
        stat("Who need it", `${per(row[INTOX.dependent]!)} of its people`),
        stat(
          lost >= 0 ? "Work lost to it" : "Work gained by what wakes",
          `${per(Math.abs(lost))} of its crafts'`,
        ),
        stat("Who die of it a year", `${(row[INTOX.deaths]! / 10_000).toFixed(2)}% of its people`),
        stat("Its rites that draw on it", per(row[INTOX.rites]!)),
        stat("Pain it eases", per(row[INTOX.eased]!)),
      ],
    },
  ];
}
