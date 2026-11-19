// One person's life, on their page (round G, the individual): what they want, what they are like, the work of their life, what they
// own and owe, how their kind pairs, and what could lead them wrong before their town's court. Read from their land and their own
// key (host/self.ts, rules/self.ts): nothing here is kept, and nothing flows back. Phone first: facts and short lists, a bar to a want.
import type { Ref, World } from "../../kernel/index.ts";
import { populationContext } from "../../sim/index.ts";
import {
  CAREER_WHY,
  GOODS,
  MIND_HOLDS,
  MIND_HOLD_WORDS,
  MIND_STATES,
  MIND_WEIGHTS,
  MIND_WEIGHT_WORDS,
  mindState,
  PAIRING_WORDS,
  SELF_TRAITS,
  SELF_TRAIT_WORDS,
  WANT_KINDS,
  WANT_WORDS,
  metWord,
  rankWord,
  topTenth,
  traitWord,
  type SelfTrait,
  type Want,
} from "../../rules/index.ts";
import type { Block, Item, Line, PageModel, Stat, Tab } from "../../bridge/index.ts";
import { landMind, selfOf, townSelves, type SelfRead } from "../self.ts";
import { coinWords } from "./living.ts";
import { item, link, many, share, stat, yearNow } from "./words.ts";
import { landLink } from "./names.ts";

/** The pages a person's life is told on: anyone the game names and keeps a page for. */
const SELF_PAGES = /^(folk:town:|seat:|heal:|prsn:|agent:|rule:|court:|boss:|note:)/;

const WORK_WORDS = ["a child", "forager", "farmer", "herder", "crafter", "trader", "leader"];
const workWord = (occupation: number, trade: string | null) =>
  trade ?? WORK_WORDS[occupation] ?? "worker";

// —— What they want ——————————————————————————————————————————————————————————————————————————————————————————————

/** Why a want stands as it does, in a few words read off what meets it. */
function wantWhy(p: SelfRead, w: Want): string {
  const l = p.land;
  switch (w.kind) {
    case "food":
      return l.fed < 0.97
        ? `their land ate ${Math.round(l.fed * 100)} in a hundred of what it needed at its leanest${p.left < 0 ? ", and their home's day leaves less than nothing" : ""}`
        : p.left < 0
          ? "their land eats, but their home's day leaves less than nothing"
          : "their land eats, and their home's day leaves something";
    case "safety":
      return l.danger > 0.3
        ? "war, raiding or fire has come to their land lately"
        : l.lawless > 0.4
          ? "the rule over their land is weak or none"
          : "their land has been quiet";
    case "standing":
      return p.who.rank > 0
        ? "they hold a seat"
        : p.standing >= 0.7
          ? "their household stands high in their land"
          : p.standing <= 0.3
            ? "their household stands low in their land"
            : "their household stands in the middle of their land";
    case "kin":
      return l.nature.hive
        ? "the hive is all about them"
        : p.child
          ? "a child, among their own"
          : `${p.partners ? (p.partners > 1 ? `${p.partners} partners` : "a partner") : "no partner"}, ${p.young ? many(p.young, "young one", "young ones") : "no young"} living`;
    case "faith":
      return l.barred
        ? "their realm forbids the faith their land keeps"
        : l.faith
          ? "their land keeps a faith"
          : "their land keeps no faith of its own";
    case "knowing":
      return l.lettered ? "their land writes" : "nothing in their land is written";
  }
}

function wantsBlocks(p: SelfRead): Block[] {
  const top = p.wants[0]!;
  return [
    {
      type: "bars",
      title: "What they want, and how far it is met",
      wrap: true,
      unit: "share",
      bars: p.wants.map((w) => ({
        label: [`${WANT_WORDS[w.kind].icon} ${WANT_WORDS[w.kind].label}: ${metWord(w)}`],
        ref: "concept:self-wants",
        value: Math.round(w.pressing * 100) / 100,
      })),
    },
    {
      type: "text",
      lines: [
        [
          top.pressing >= 0.15
            ? `What presses most: ${WANT_WORDS[top.kind].label.toLowerCase()}, ${wantWhy(p, top)}.`
            : "Nothing presses hard on them now.",
        ],
        ...p.wants
          .slice(1)
          .filter((w) => w.pressing >= 0.2)
          .slice(0, 2)
          .map(
            (w) => [`Then ${WANT_WORDS[w.kind].label.toLowerCase()}: ${wantWhy(p, w)}.`] as Line,
          ),
      ],
    },
  ];
}

// —— What they are like ——————————————————————————————————————————————————————————————————————————————————————————

function characterBlocks(p: SelfRead): Block[] {
  const marked = SELF_TRAITS.map((t) => ({ t, v: p.traits[t], word: traitWord(t, p.traits[t]) }))
      .filter((x) => x.word !== null)
      .sort((a, b) => Math.abs(b.v - 0.5) - Math.abs(a.v - 0.5)),
    why: string[] = [],
    w = p.land.ways,
    n = p.land.nature;
  if (n.hive) why.push("They are of a hive, and a hive's are much alike.");
  else if (n.social >= 0.75) why.push("Their kind lives close, and keeps its temper.");
  if (n.span >= 120) why.push("Their kind lives long, and is slow to anger.");
  const strong = (
    [
      ["valour", "valour"],
      ["piety", "piety"],
      ["openness", "openness to the new"],
      ["tradition", "the old ways"],
      ["hierarchy", "rank"],
      ["trade", "trade"],
      ["kinship", "kin"],
    ] as const
  ).filter(([k]) => Math.abs(w[k] - 0.5) >= 0.15);
  if (strong.length)
    why.push(
      `They were raised among a people of ${strong
        .slice(0, 3)
        .map(([k, word]) => `${w[k] > 0.5 ? "much" : "little"} ${word}`)
        .join(", ")}.`,
    );
  if (p.youth.hunger >= 0.3) why.push("Their young years were hungry ones.");
  if (p.youth.danger >= 0.3) why.push("They grew up among war, raids or fire.");
  return [
    marked.length
      ? {
          type: "chips",
          title: "What they are like",
          chips: marked.slice(0, 4).map((x) => ({
            icon: SELF_TRAIT_WORDS[x.t].icon,
            name: x.word!.replace(/^./, (c) => c.toUpperCase()),
            ref: "concept:self-character",
            words: SELF_TRAIT_WORDS[x.t].what,
          })),
        }
      : {
          type: "text",
          title: "What they are like",
          lines: [["Much as most of their people are."]],
        },
    {
      type: "bars",
      title: "Their bent, against the middle of their people (50%)",
      unit: "share",
      bars: SELF_TRAITS.map((t: SelfTrait) => ({
        label: [`${SELF_TRAIT_WORDS[t].icon} ${t[0]!.toUpperCase()}${t.slice(1)}`],
        ref: "concept:self-character",
        value: Math.round(p.traits[t] * 100) / 100,
      })),
    },
    ...(why.length ? [{ type: "text" as const, lines: why.map((x) => [x] as Line) }] : []),
  ];
}

// —— How they bear what they have lived ——————————————————————————————————————————————————————————————————————————

/** What weighs on them and what holds them up (rules/self.ts mindOf): a reading of their own life, kept nowhere. */
function mindBlocks(p: SelfRead): Block[] {
  const m = p.mind,
    first = p.who.name.split(" ")[0]!,
    state = MIND_STATES[mindState(m.burden)]!,
    weighs = MIND_WEIGHTS.filter((k) => m.weights[k] >= 0.05).sort(
      (a, b) => m.weights[b] - m.weights[a],
    ),
    holds = MIND_HOLDS.filter((k) => m.holds[k] >= 0.05).sort((a, b) => m.holds[b] - m.holds[a]),
    why: Record<string, string> = {
      loss: p.land.nature.hive
        ? "a hive bears a death as one, and one of it is little bowed"
        : "those of their near kin who have died, the latest the heaviest",
      war: "the war, fire and raiding of their young years, their grown years and their land now; the bold carry it lighter",
      want: "the hungry years they have known, how their land ate last year, and a day that leaves nothing over",
      place: "a low place where rank has set hard, or a faith their realm forbids",
    };
  return [
    {
      type: "facts",
      title: "How they bear what they have lived",
      rows: [
        stat("They are", p.who.alive ? state : `${state} (as they were at the end)`, {
          parts: [
            { label: ["what weighs on them"], value: share(m.weight) },
            { label: ["what holds them up, which lightens it"], value: share(m.held) },
            {
              label: ["and how it sits on one of their temper and conscience"],
              value: share(m.burden),
            },
          ],
        }),
      ],
    },
    ...(weighs.length
      ? [
          {
            type: "bars" as const,
            title: "What weighs on them",
            wrap: true,
            unit: "share" as const,
            bars: weighs.map((k) => ({
              label: [`${MIND_WEIGHT_WORDS[k].icon} ${MIND_WEIGHT_WORDS[k].label}`],
              ref: "concept:self-wants",
              value: Math.round(m.weights[k] * 100) / 100,
            })),
          },
        ]
      : []),
    ...(holds.length
      ? [
          {
            type: "bars" as const,
            title: "What holds them up",
            wrap: true,
            unit: "share" as const,
            bars: holds.map((k) => ({
              label: [`${MIND_HOLD_WORDS[k].icon} ${MIND_HOLD_WORDS[k].label}`],
              ref: "concept:self-wants",
              value: Math.round(m.holds[k] * 100) / 100,
            })),
          },
        ]
      : []),
    {
      type: "text",
      lines: [
        [
          weighs.length
            ? `What weighs most on ${first}: ${why[weighs[0]!] ?? ""}.`
            : `Little has weighed on ${first}: their years were quiet ones and those near them live.`,
        ],
      ],
    } as Block,
  ];
}

/** How one of the middle of a land's people bears their years, for the land's page: a reading of the land's own numbers. */
export function landMindBlock(world: World, cell: number): Block {
  const m = landMind(world, cell, yearNow(world)),
    weighs = MIND_WEIGHTS.filter((k) => m.weights[k] >= 0.05).sort(
      (a, b) => m.weights[b] - m.weights[a],
    );
  return {
    type: "facts",
    title: "How its people bear their years",
    rows: [
      stat("One of the middle of them is", MIND_STATES[mindState(m.burden)]!, {
        parts: [
          { label: ["what weighs on them"], value: share(m.weight) },
          { label: ["what holds them up"], value: share(m.held) },
        ],
      }),
      ...weighs.map((k) =>
        stat(`${MIND_WEIGHT_WORDS[k].icon} ${MIND_WEIGHT_WORDS[k].label}`, share(m.weights[k])),
      ),
      ...(weighs.length
        ? []
        : [stat("What weighs on them", "little: quiet years, and enough to eat")]),
    ],
  };
}

// —— Their work over the years ———————————————————————————————————————————————————————————————————————————————————

function careerBlocks(p: SelfRead): Block[] {
  if (p.child)
    return [
      {
        type: "text",
        title: "Their work over the years",
        lines: [[`None yet: they take up work at ${p.land.adulthood}.`]],
      },
    ];
  const last = p.career.length - 1,
    items: Item[] = p.career.map((c, i) => {
      const to = c.to ?? (p.who.alive ? "now" : `${p.who.year}`),
        work = i === last ? workWord(c.occupation, p.who.trade) : workWord(c.occupation, null),
        seat =
          c.why === "seat"
            ? p.who.station === "ruler"
              ? "to rule"
              : p.who.station === "court"
                ? "to a seat at court"
                : `to their seat as ${work}`
            : null;
      return item(
        [
          `${c.from}–${to}: ${seat ? `${work}, came ${seat}` : work}, ${rankWord(c.rank)}`,
          c.why === "seat" ? "" : `; ${CAREER_WHY[c.why]}`,
        ],
        "concept:self-career",
        c.from,
      );
    });
  return [{ type: "list", title: "Their work over the years", items }];
}

// —— What they own and owe ————————————————————————————————————————————————————————————————————————————————————————

function wealthBlocks(world: World, p: SelfRead): Block[] {
  const h = p.holdings,
    goods = h.goods
      .map((v, g) => ({ v, name: GOODS[g]!.name }))
      .filter((x) => x.v >= 1)
      .sort((a, b) => b.v - a.v),
    they = p.mouths > 1 ? "Their household" : "They",
    rows: Stat[] = [
      stat(
        "All told",
        [
          `${coinWords(h.net)} coin, `,
          h.against >= 1.15
            ? `${h.against >= 10 ? Math.round(h.against) : h.against.toFixed(1)} times`
            : h.against <= 0.85
              ? `${Math.round(h.against * 100)} in a hundred of`
              : "about",
          " what the middle household of ",
          landLink(world, p.who.cell, true),
          " holds",
        ],
        { why: "concept:self-wealth" },
      ),
      ...(goods.length
        ? [
            stat(
              "Their stores",
              goods
                .slice(0, 3)
                .map((x) => `${x.name}, ${coinWords(x.v)}`)
                .join("; "),
            ),
          ]
        : []),
      stat(
        "Their roof",
        h.home > 0 ? `their own, worth ${coinWords(h.home)}` : "not theirs: they pay to live there",
      ),
      ...(h.coin >= 1 ? [stat("Coin put by", coinWords(h.coin))] : []),
      ...(h.debt >= 1 ? [stat("Owed the houses", coinWords(h.debt))] : []),
      ...(h.arrears >= 1 ? [stat("Run short and unpaid", coinWords(h.arrears))] : []),
      ...(h.common >= 1
        ? [stat("Held for all", `${coinWords(h.common)} a head, the realm's`)]
        : []),
    ];
  return [
    { type: "facts", title: "What they own and owe", rows },
    {
      type: "text",
      lines: [
        [
          `${they} ${p.mouths > 1 ? "is" : "are"} ${p.standing >= 0.9 ? "among the richest" : p.standing >= 0.65 ? "well off" : p.standing <= 0.15 ? "among the poorest" : p.standing <= 0.4 ? "poorer than most" : "of the middle"} in their land. There its richest tenth of households holds ${share(topTenth(h.alpha))} of what is privately held.`,
        ],
      ],
    },
  ];
}

// —— How their kind pairs ————————————————————————————————————————————————————————————————————————————————————————

function kinBlock(p: SelfRead): Block {
  const words = PAIRING_WORDS[p.land.pairing];
  return {
    type: "facts",
    title: "Their household",
    rows: [
      stat("Their kind", words.name, { why: "concept:self-pairing" }),
      stat(
        "Under their roof",
        p.land.pairing === "brood"
          ? "the hive's cell: those who work and raise a brood together"
          : p.land.pairing === "none"
            ? "they live alone, among those they work beside"
            : `${many(Math.round(p.mouths), "mouth", "mouths")}: ${p.partners ? (p.partners > 1 ? `${p.partners} partners` : "a partner") : "no partner"}, ${p.young ? many(p.young, "young one", "young ones") : "no young"}`,
      ),
      stat("Heirs", words.heirs),
    ],
  };
}

// —— The tab ————————————————————————————————————————————————————————————————————————————————————————————————————

/** Their life's tab (null: no one the game names, or they are of the levy alone). */
export function selfTab(world: World, ref: string, more: readonly Block[] = []): Tab | null {
  const p = selfOf(world, ref);
  if (!p) return null;
  const blocks: Block[] = [
    ...(p.who.alive ? wantsBlocks(p) : []),
    ...characterBlocks(p),
    ...mindBlocks(p),
    kinBlock(p),
    ...careerBlocks(p),
    ...(p.who.alive && !p.child ? wealthBlocks(world, p) : []),
    ...more,
    {
      type: "text",
      lines: [
        [
          `History counts ${p.who.station === "ruler" || p.who.station === "court" ? "a realm's" : "a land's"} people by work and by land, not one by one. What ${p.who.name.split(" ")[0]} is like, wants, has done and holds is read from their land's numbers and a key of their own: the same each time, and nothing of it kept.`,
        ],
      ],
    },
  ];
  return { id: "self", name: "Their life", blocks };
}

/** A person's page with their life's tab, after their overview (other pages as they are). */
export function withSelf(
  world: World,
  ref: string,
  page: PageModel,
  more: (p: SelfRead) => readonly Block[] = () => [],
): PageModel {
  if (!SELF_PAGES.test(ref) || (page.kind !== "person" && page.kind !== "agent")) return page;
  if (page.tabs.some((t) => t.id === "self")) return page;
  const p = selfOf(world, ref);
  if (!p) return page;
  const tab = selfTab(world, ref, more(p));
  if (!tab) return page;
  // (After their overview, their family and their body: the first of them all, on a phone, is who they are.)
  const tabs = [...page.tabs],
    at =
      Math.max(...["overview", "family", "body"].map((id) => tabs.findIndex((t) => t.id === id))) +
      1;
  tabs.splice(at, 0, tab);
  return { ...page, tabs };
}

// —— A town's people, read together ——————————————————————————————————————————————————————————————————————————

/** How many of a town's people its tab reads: its first lines' holders, those any device draws first. */
export const TOWN_SELVES = 24;

/** A town's Its people tab: what its named people want most, what they are like, their work, how their wealth lies (null: none). */
export function townPeopleTab(
  world: World,
  ref: string,
  more: (selves: readonly SelfRead[]) => readonly Block[] = () => [],
): Tab | null {
  const s = populationContext(world).settlements.get(ref as Ref);
  if (!s || s.population <= 0) return null;
  const all = townSelves(world, s, TOWN_SELVES),
    grown = all.filter((p) => !p.child);
  if (!grown.length) return null;
  const n = grown.length,
    mean = (f: (p: SelfRead) => number) => grown.reduce((a, p) => a + f(p), 0) / n,
    pressing = WANT_KINDS.map((k) => ({
      k,
      v: mean((p) => p.wants.find((w) => w.kind === k)?.pressing ?? 0),
    })).sort((a, b) => b.v - a.v),
    byWorth = [...grown].sort((a, b) => b.holdings.net - a.holdings.net),
    middle = byWorth[Math.floor(n / 2)]!.holdings.net,
    changed = grown.filter((p) => p.career.length > 1),
    whys = new Map<string, number>();
  for (const p of changed)
    for (const c of p.career.slice(1)) whys.set(c.why, (whys.get(c.why) ?? 0) + 1);
  const why = [...whys.entries()].sort((a, b) => b[1] - a[1])[0],
    words = new Map<string, number>();
  for (const p of grown)
    for (const t of SELF_TRAITS) {
      const w = traitWord(t, p.traits[t]);
      if (w) words.set(w, (words.get(w) ?? 0) + 1);
    }
  const common = [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
    land = grown[0]!.land,
    worthLine = (p: SelfRead) =>
      item(
        [
          link(p.who.name, p.who.ref),
          `, ${workWord(p.who.occupation, p.who.trade)}: ${coinWords(p.holdings.net)} coin${
            middle > 0 ? `, ${(p.holdings.net / middle).toFixed(1)} times the middle` : ""
          }`,
        ],
        p.who.ref,
      ),
    blocks: Block[] = [
      {
        type: "bars",
        title: "What its people want most",
        wrap: true,
        unit: "share",
        bars: pressing.map(({ k, v }) => ({
          label: [`${WANT_WORDS[k].icon} ${WANT_WORDS[k].label}`],
          ref: "concept:self-wants",
          value: Math.round(v * 100) / 100,
        })),
      },
      {
        type: "facts",
        title: "Who they are",
        rows: [
          stat(
            "Most marked",
            common.length
              ? common.map(([w, c]) => `${w} (${c} of ${n})`).join(", ")
              : "much as their people are",
            { why: "concept:self-character" },
          ),
          stat("Their kind", PAIRING_WORDS[land.pairing].name, { why: "concept:self-pairing" }),
          stat(
            "Changed their work",
            `${changed.length} of ${n}${why ? `, most ${CAREER_WHY[why[0] as keyof typeof CAREER_WHY]}` : ""}`,
            { why: "concept:self-career" },
          ),
          stat(
            "Wealth",
            `its land's richest tenth of households holds ${share(topTenth(grown[0]!.holdings.alpha))}`,
            { why: "concept:self-wealth" },
          ),
        ],
      },
      {
        type: "list",
        title: "The best and worst off of those named",
        items: [
          ...byWorth.slice(0, 3),
          ...byWorth.slice(-3).filter((p) => !byWorth.slice(0, 3).includes(p)),
        ].map(worthLine),
      },
      ...more(grown),
      {
        type: "text",
        lines: [
          [
            `Read of the first ${many(n, "of its people", "of its people")} its roll names, those any device draws first: each from their land's numbers and a key of their own, as their own pages tell them. History keeps none of it.`,
          ],
        ],
      },
    ];
  return { id: "people", name: "Its people", blocks };
}
