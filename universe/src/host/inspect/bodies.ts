// A realm's and a land's Institutions tab, a body's page and the ledger's (the institutions, sim/order/institutions.ts): who
// does what there ("who keeps order", "who makes its iron", "who teaches"), each body with its head, its hands, who keeps it and
// whom it answers to; what is wanted and what is paid for; and how their holds ended. A body's title and its line of what it is
// are read off its basis (rules/institutions.ts instTitle, basisWords): nothing here names a kind. Who, what, cost and effect:
// never how. Phone first: a few facts, one table that fits.
import type { Ref, World } from "../../kernel/index.ts";
import type { Block, Item, PageModel, Stat } from "../../bridge/index.ts";
import {
  ANSWERS_WORDS,
  DOES,
  DOES_ASKS,
  DOES_ROWS,
  DOES_WANTS,
  FUND_WORDS,
  INST,
  INST_ANSWERS,
  INST_DOES,
  INST_FORMED,
  INST_FUNDS,
  ORG_STANDING,
  basisWords,
  madeWords,
  type InstDoes,
} from "../../rules/index.ts";
import {
  BODY_ACT_YEARS,
  beliefOf,
  bodiesOf,
  notablesOf,
  bodyLandsStore,
  BODY_ROW,
  bodyTitle,
  doesOf,
  politiesOf,
  populationContext,
  workedName,
  type Body,
  type Polity,
} from "../../sim/index.ts";
import { bodyWords, grainSum } from "../../causal/index.ts";
import { realmColor } from "../colors.ts";
import { bodiesAll, bodiesIn, bodyNews, bodyOf, bodyRef } from "../bodies.ts";
import { claimOf, count, item, link, many, part, share, stat, yearAt, yearNow } from "./words.ts";
import { faithLink, landLink, realmLink } from "./names.ts";
import { listedOf } from "./ledger-kit.ts";

const th = (n: number) => share(n / 1000),
  grain = (n: number) => `${grainSum(Math.max(0, Math.round(n)))} grain's worth`,
  cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** The page a body's head has, where they live at its home's first town (host/inspect/notables.ts). */
export const bodyHeadRef = (event: string): string => `note:head:${event}`;
/** A body's head by their page: themselves where the world keeps them by name (sim/notable/heads.ts), else the body's own. */
export function headRefOf(world: World, g: { readonly event: string; readonly headId?: string }): string {
  const m = g.headId ? /^note:named:(\d+)$/.exec(g.headId) : null,
    kept = m ? notablesOf(world) : null;
  return m && kept && (kept.get(Number(m[1])) || kept.goneOf(Number(m[1]))) ? g.headId! : bodyHeadRef(g.event);
}

const titleNow = (world: World, g: Readonly<Body>): string =>
  bodyTitle(populationContext(world), g as Body);
const nameNow = (world: World, g: Readonly<Body>): string => bodyWords(g.name, titleNow(world, g));
const bodyLink = (world: World, g: Readonly<Body>) =>
  link(cap(nameNow(world, g)), bodyRef(g.event));

/** What a body's head is called, by what it does: master, captain, judge, rector. */
export function headTitle(does: InstDoes, title: string): string {
  switch (does) {
    case "make":
      return "Master";
    case "craft":
      return "Master";
    case "bargain":
      return "Speaker";
    case "order":
      return "Captain";
    case "judge":
      return "First judge";
    case "teach":
      return /university|academy|college/.test(title) ? "Rector" : "Head";
    case "heal":
      return "First physician";
    case "worship":
      return "High priest";
    case "word":
      return "Editor";
    case "insure":
      return "First underwriter";
    default:
      return "Head";
  }
}

const madeName = (good: number): string => madeWords(workedName(good));

/** Who keeps a body, as a line: the payer in words, and the house or faith by name where one does. */
function keptBy(world: World, r: Polity | null, g: Readonly<Body>): Stat {
  const fund = INST_FUNDS[g.fund] ?? "dues",
    faith = fund === "tithes" && g.keeper ? beliefOf(world).get(g.keeper as Ref) : undefined,
    of =
      fund === "patron" && g.keeper && r
        ? [link(`the house of ${g.keeper}`, `${r.ref}#houses`)]
        : faith
          ? [faithLink(world, faith.ref)]
          : fund === "customers" && g.keeper && r
            ? ["owned by ", link(`the house of ${g.keeper}`, `${r.ref}#houses`)]
            : [];
  return stat("Kept by", cap(FUND_WORDS[fund]), {
    parts: [
      ...(of.length ? [part(of, "")] : []),
      part("answers to", ANSWERS_WORDS[INST_ANSWERS[g.answers] ?? "members"]),
      part("how its realm holds it", ORG_STANDING[g.standing] ?? "let be"),
    ],
  });
}

/** What is told of a body beside its hands: how honest, how well run, what it holds. */
function besides(g: Readonly<Body>): string {
  const q = g.quality / 1000;
  if (g.does === DOES.order || g.does === DOES.judge)
    return q >= 0.7 ? "honest" : q >= 0.45 ? "some of it bought" : "bought";
  return q >= 0.8 ? "well run" : q >= 0.65 ? "run well enough" : "poorly run";
}

/** The bodies of a list, by what they do: "Who keeps order: the Vav watch (46 hands), …". */
function whoDoes(world: World, bodies: readonly Readonly<Body>[], here: string): Block | null {
  const rows: Stat[] = [];
  for (let d = 0; d < INST_FORMED; d++) {
    const of = bodies.filter((g) => g.does === d).sort((a, b) => b.staff - a.staff || a.id - b.id);
    if (!of.length) continue;
    const does = INST_DOES[d]!,
      // ("Who makes its iron" where one good is all its works make.)
      goods = new Set(of.map((g) => g.of)),
      ask =
        d === DOES.make && goods.size === 1 && of[0]!.of >= 0
          ? `Who makes its ${madeName(of[0]!.of)}`
          : DOES_ASKS[does];
    rows.push(
      stat(
        `${ask}${here}`,
        of.flatMap((g, i) => [
          ...(i ? [", "] : []),
          bodyLink(world, g),
          ` (${many(g.staff, d === DOES.craft || d === DOES.bargain ? "member" : "hand", d === DOES.craft || d === DOES.bargain ? "members" : "hands")})`,
        ]),
        { why: of[0]!.event },
      ),
    );
  }
  return rows.length ? { type: "facts", title: "Who does what", rows } : null;
}

const HOW: Readonly<Record<string, string>> = {
  failed: "failed, what its customers paid no longer keeping it",
  withered: "withered, what was paid for it no longer keeping its hands",
  suppressed: "put down by its seat",
  "taken over": "taken over by",
  merged: "merged into",
  "lost with its land": "lost with its land",
};

// —— A realm's Institutions tab ————————————————————————————————————————————————————————————————————————————

/** A realm's Institutions tab: none where nothing is reckoned. */
export function realmBodiesBlocks(world: World, r: Polity): Block[] {
  const v = bodiesOf(world)?.of(r.ref);
  if (!v) return [];
  const blocks: Block[] = [],
    bodies = [...v.bodies].sort((a, b) => a.does - b.does || b.staff - a.staff || a.id - b.id),
    who = whoDoes(world, bodies, "");
  if (who) blocks.push(who);
  if (bodies.length)
    blocks.push({
      type: "table",
      title: "Each body",
      columns: ["Body", "Head", "Hands", "Kept by", "Since"],
      rows: bodies.map((g) => ({
        ref: bodyRef(g.event),
        cells: [
          [bodyLink(world, g)],
          [g.leader.name],
          [count(g.staff)],
          [FUND_WORDS[INST_FUNDS[g.fund] ?? "dues"]],
          [`${g.since}`],
        ],
        keys: [g.name, g.leader.name, g.staff, INST_FUNDS[g.fund] ?? "", g.since],
      })),
      few: INST.most + 2,
      fit: true,
    });
  else
    blocks.push({
      type: "text",
      lines: [
        [
          "No body is kept here now: nothing its people want done is paid for by anyone who could keep the hands the work takes.",
        ],
      ],
    });
  // What is wanted, and what is paid for it.
  const wants = INST_DOES.slice(0, INST_FORMED)
    .map((does, d) => [does, v.need[d] ?? 0, v.paid[d] ?? 0] as const)
    .filter(([, need]) => need > 0)
    .sort((a, b) => b[1] - a[1]);
  if (wants.length)
    blocks.push({
      type: "facts",
      title: "What its people would pay to have done",
      rows: wants.map(([does, need, paid]) =>
        stat(DOES_WANTS[does], `${grain(need)} a year`, {
          parts: [
            part(
              "what its bodies are paid now",
              paid > 0 ? `${grain(paid)} a year` : "nothing: no body does it yet",
            ),
            part("the fewest hands the work takes", count(DOES_ROWS[does].least)),
          ],
        }),
      ),
    });
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
              link(cap(bodyWords(g.name, g.title)), bodyRef(g.rose)),
              ` (since ${g.since}), ${HOW[g.how] ?? g.how}${g.into ? ` the ${g.into}` : ""}`,
            ],
            g.event,
            g.year,
          ),
        ),
    });
  return blocks;
}

// —— A land's Institutions tab —————————————————————————————————————————————————————————————————————————————

/** A land's Institutions tab: who does what here, and what that does to it. None where no body holds any part of it. */
export function landBodiesBlocks(world: World, cell: number): Block[] {
  const here = bodiesIn(world, cell);
  if (!here.length) return [];
  const blocks: Block[] = [],
    who = whoDoes(
      world,
      here.map((x) => x.g),
      " here",
    ),
    row = bodyLandsStore(world)?.get(cell),
    year = yearNow(world);
  if (who) blocks.push(who);
  if (row) {
    const at = (k: number) => row[k]! / 1000,
      rows: Stat[] = [];
    if (row[BODY_ROW.works]! > 0)
      rows.push(
        stat("Of its crafters, under a works' roof", th(row[BODY_ROW.works]!), {
          parts: [part("works here", count(row[BODY_ROW.firms]!))],
        }),
      );
    if (row[BODY_ROW.strikeYear]! >= year && row[BODY_ROW.strike]! > 0)
      rows.push(
        stat(
          row[BODY_ROW.strikeYear]! === year ? "Its workers are out on strike" : "A strike called",
          `${th(row[BODY_ROW.strike]!)} of the year's craft lost`,
        ),
      );
    if (row[BODY_ROW.won]! > 0)
      rows.push(
        stat("Won by its workers striking", `${th(row[BODY_ROW.won]!)} more of their trade's rent`),
      );
    if (row[BODY_ROW.watch]! > 0)
      rows.push(
        stat("Its watch", `${th(row[BODY_ROW.watch]!)} of a full one`, {
          parts: [
            part(
              "how honest",
              at(BODY_ROW.honest) >= 0.7
                ? "honest"
                : at(BODY_ROW.honest) >= 0.45
                  ? "some of it bought"
                  : "bought",
            ),
          ],
        }),
      );
    if (row[BODY_ROW.court]! > 0)
      rows.push(
        stat("Its court's reach", th(row[BODY_ROW.court]!), {
          parts: [
            part("of its judging, bought", th(row[BODY_ROW.bought]!)),
            part("those it holds", count(row[BODY_ROW.held]!)),
          ],
        }),
      );
    if (row[BODY_ROW.higher]! > 0)
      rows.push(stat("Its higher learning's hold", th(row[BODY_ROW.higher]!)));
    if (row[BODY_ROW.heal]! > 0) rows.push(stat("Its healing's hold", th(row[BODY_ROW.heal]!)));
    if (row[BODY_ROW.word]! > 0 || row[BODY_ROW.kept]! > 0)
      rows.push(
        stat(
          "Of those who read here, reached by its voices",
          th(Math.max(row[BODY_ROW.word]!, row[BODY_ROW.kept]!)),
          {
            parts: [
              part("by voices that answer to their readers", th(row[BODY_ROW.word]!)),
              part("by voices a house keeps", th(row[BODY_ROW.kept]!)),
            ],
          },
        ),
      );
    if (rows.length) blocks.push({ type: "facts", title: "What they come to here", rows });
  }
  blocks.push({
    type: "table",
    title: "Each body here",
    columns: ["Body", "Head", "Hands", "Since"],
    rows: here.map(({ g }) => ({
      ref: bodyRef(g.event),
      cells: [[bodyLink(world, g)], [g.leader.name], [count(g.staff)], [`${g.since}`]],
      keys: [g.name, g.leader.name, g.staff, g.since],
    })),
    few: INST.most + 2,
    fit: true,
  });
  return blocks;
}

// —— A body's page —————————————————————————————————————————————————————————————————————————————————————————

/** What a body of each thing done is, and what it does to its land: who, what, cost and effect. */
const ABOUT: Readonly<Record<string, string>> = {
  make: "Crafters under one roof, working for wages for those who own it: each hand makes a little more than in a shop of its own, and what its owners keep goes to the house that owns it. Where two works sell the same good in one land they share its custom by their size and how well each is run; the lesser is taken over. It fails when what is sold no longer keeps its hands.",
  craft:
    "A trade's own people, bound by a roll and by dues, who say who may work it and at what price: its crafters ask as one, so its goods are the dearer, and a works finds it harder to set up beside it.",
  bargain:
    "Those who work for wages, bound together to ask more of them. Where their wage falls behind what a tiller earns and they are many enough to stop the works, they strike: part of a year's craft is lost; if the works give, their wage rises for years; if they are broken, many leave.",
  order:
    "Order kept for pay from the seat's treasury. Manned and paid, it makes the seat's hand the surer over its land, its roads safer from those who prey on them and deals the better kept; underpaid or bought, it does the opposite.",
  judge:
    "A court kept by the treasury: those who judge what is brought before it. Honest, deals are held where it reaches; bought, they are held the less. Those its law does not fine or kill, it holds.",
  teach:
    "A house that teaches for whoever keeps it: where it stands a land's young learn their letters as in a school, and one that inquires as well as teaches finds the more readily.",
  heal: "A house of healing: what its land knows of healing reaches more of its sick.",
  worship:
    "A faith's clergy in one land as a body with a head: kept by what its faithful give, it carries the faith's rites, and its alms spare a few of the land's deaths.",
  word: "Word carried to those who read. One that answers to its readers tells of its lands' grievance, and a seat is held the less rightful for it where its word is free; one a great house keeps speaks for those it is near. A seat that shuts the free word outlaws those it does not keep.",
  insure:
    "Those who share out the risk of loss among many who pay in against it: what its realm's traders pay against loss, kept as a body, and a few of its land's deaths spared when loss comes.",
};

function passedItems(
  world: World,
  news: (e: ReturnType<World["events"]["all"]>[number]) => boolean,
  since: number,
): Item[] {
  const all = world.events.all(),
    out: Item[] = [];
  for (let i = all.length - 1; i >= 0 && out.length < 12; i--) {
    const e = all[i]!;
    if (yearAt(e.t) < since) break;
    if (!news(e)) continue;
    const y = yearAt(e.t);
    out.push(item([`Year ${y}: `, link(claimOf(world, e.id), e.id)], e.id, y));
  }
  return out;
}

const ICONS: Readonly<Record<string, string>> = {
  make: "🏭",
  craft: "🔨",
  bargain: "✊",
  order: "👮",
  judge: "⚖️",
  teach: "🎓",
  heal: "⚕️",
  worship: "🛐",
  word: "📰",
  insure: "📜",
};

/** A body's page (`inst:<event>`). */
export function institutionPage(world: World, ref: string): PageModel {
  const g = bodyOf(world, ref);
  if (!g) throw new Error(`no body ${ref}`);
  const year = yearNow(world),
    r = g.realm,
    rec = g.record,
    since = rec?.since ?? g.gone?.since ?? yearAt(world.events.get(g.event)?.t ?? world.now),
    does = rec ? doesOf(rec) : (INST_DOES[g.gone?.does ?? 0] ?? "make"),
    of = rec && rec.of >= 0 ? workedName(rec.of) : "",
    facts: Stat[] = [
      ...(r ? [stat("Realm", [realmLink(world, r.ref)])] : []),
      stat(
        "What it is",
        rec
          ? basisWords(
              {
                does,
                fund: INST_FUNDS[rec.fund] ?? "dues",
                answers: INST_ANSWERS[rec.answers] ?? "members",
                standing: rec.standing,
              },
              of,
            )
          : `It ${does === "make" ? "made and sold goods" : "did what was wanted of it"}, while it stood.`,
        // (Of one whose hold ended, history keeps how it ended; its founding it lets go with its years.)
        { why: g.gone?.event ?? g.event },
      ),
      stat("Since", `year ${since}`, { why: g.gone?.event ?? g.event }),
    ];
  if (rec) {
    const head = headTitle(does, g.title);
    facts.push(
      stat(
        "Its head",
        [
          link(rec.leader.name, headRefOf(world, rec)),
          `, ${head.toLowerCase()}, born year ${rec.leader.born}, at its head since year ${rec.leader.since}`,
        ],
        { parts: [part("its heads so far", count(rec.leaders))] },
      ),
      stat("Its home", [landLink(world, rec.home)], {
        parts: rec.lands
          .filter((c) => c !== rec.home)
          .map((c) => part([landLink(world, c)], "it holds here too")),
      }),
      keptBy(world, r, rec),
    );
  }
  if (g.gone)
    facts.push(
      stat(
        "Its hold ended",
        [
          `in year ${g.gone.year}, `,
          link(
            `${HOW[g.gone.how] ?? g.gone.how}${g.gone.into ? ` the ${g.gone.into}` : ""}`,
            g.gone.event,
          ),
        ],
        { why: g.gone.event },
      ),
    );
  const blocks: Block[] = [{ type: "facts", rows: facts }];
  if (rec) {
    const dues = rec.fund === 0,
      rows: Stat[] = [
        stat(dues ? "Members" : "Hands", count(rec.staff)),
        stat("What it is paid", `${grain(rec.income)} a year`, {
          parts: [part("its purse", grain(rec.wealth))],
        }),
        stat(
          rec.does === DOES.order || rec.does === DOES.judge ? "How honest" : "How it is run",
          besides(rec),
          { parts: [part("of the best it could be", th(rec.quality))] },
        ),
        stat("Of what is paid for this in its home, its own", th(rec.share)),
      ];
    if (rec.does === DOES.judge && rec.held) rows.push(stat("Those it holds", count(rec.held)));
    if (rec.does === DOES.teach)
      rows.push(
        stat(
          "Higher learning",
          rec.higher ? "it inquires as well as teaches" : "it teaches letters",
        ),
      );
    if (rec.does === DOES.bargain) {
      if (rec.struck !== undefined) rows.push(stat("Last struck", `year ${rec.struck}`));
      if (rec.won) rows.push(stat("Won by striking", `${th(rec.won)} more of its trade's rent`));
    }
    if (rec.handUntil !== undefined && rec.handUntil >= year)
      rows.push(
        stat(
          "The god's hand",
          rec.hand === 1 ? "blessed" : rec.hand === -1 ? "cursed" : "kept from its seat's hand",
          { parts: [part("until", `year ${rec.handUntil}`)] },
        ),
      );
    blocks.push({ type: "facts", title: "What it holds", rows });
    blocks.push({ type: "text", lines: [[ABOUT[does] ?? ""]] });
    blocks.push({
      type: "tool",
      tool: "acts.body",
      args: { body: g.event, name: bodyWords(g.name, g.title), years: BODY_ACT_YEARS },
    });
  }
  const passed = passedItems(world, bodyNews(g), since);
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
    icon: ICONS[does] ?? "🏛️",
    title: cap(bodyWords(g.name, g.title)),
    subtitle: r
      ? [rec ? `${cap(g.title)} of ` : "Once a body of ", realmLink(world, r.ref)]
      : [cap(g.title)],
    color: r ? realmColor(r.ref) : null,
    place: rec ? { scale: "region", cell: rec.home } : null,
    stats: [
      ...(rec
        ? [
            stat("Head", [link(rec.leader.name, headRefOf(world, rec))]),
            stat(rec.fund === 0 ? "Members" : "Hands", count(rec.staff)),
          ]
        : []),
      stat("Since", `year ${since}`),
    ],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year,
  };
}

// —— The ledger's Institutions tab —————————————————————————————————————————————————————————————————————————

/** Every body of the world: how many of each title, the greatest listed, how the latest holds ended. */
export function institutionsLedger(world: World): Block[] {
  const all = bodiesAll(world);
  if (!all.length)
    return [
      {
        type: "text",
        lines: [
          [
            "No body is kept anywhere yet: nothing wanted is paid for by anyone who could keep the hands its work takes.",
          ],
        ],
      },
    ];
  const titles = new Map<string, { n: number; hands: number; does: number }>(),
    realms = new Set<string>();
  for (const { r, g } of all) {
    const t = titleNow(world, g),
      was = titles.get(t) ?? { n: 0, hands: 0, does: g.does };
    titles.set(t, { n: was.n + 1, hands: was.hands + g.staff, does: g.does });
    realms.add(r.ref);
  }
  const shown = [...all].sort((a, b) => b.g.staff - a.g.staff || a.g.id - b.g.id).slice(0, 120),
    blocks: Block[] = [
      {
        type: "facts",
        title: "All told",
        rows: [
          stat("Bodies kept", count(all.length), {
            parts: [part("realms that keep any", count(realms.size))],
          }),
          ...[...titles]
            .sort((a, b) => a[1].does - b[1].does || b[1].n - a[1].n)
            .slice(0, 24)
            .map(([t, x]) =>
              stat(cap(t), count(x.n), {
                parts: [part("hands or members each, about", count(Math.round(x.hands / x.n)))],
              }),
            ),
        ],
      },
      {
        type: "table",
        title: "Every body",
        columns: ["Body", "Does", "Realm", "Head", "Hands", "Kept by", "Since"],
        rows: shown.map(({ r, g }) => ({
          ref: bodyRef(g.event),
          cells: [
            [bodyLink(world, g)],
            [DOES_ASKS[doesOf(g)].replace(/^Who /, "")],
            [realmLink(world, r.ref)],
            [g.leader.name],
            [count(g.staff)],
            [FUND_WORDS[INST_FUNDS[g.fund] ?? "dues"]],
            [`${g.since}`],
          ],
          keys: [
            g.name,
            doesOf(g),
            r.town,
            g.leader.name,
            g.staff,
            INST_FUNDS[g.fund] ?? "",
            g.since,
          ],
        })),
        filter: 1,
      },
      ...listedOf(shown.length, all.length, "greatest bodies"),
    ];
  const gone: { r: Polity; g: NonNullable<ReturnType<typeof bodyOf>>["gone"] & object }[] = [],
    store = bodiesOf(world),
    polities = politiesOf(world);
  for (const ref of store?.realmsKept() ?? []) {
    const r = polities.get(ref);
    if (r) for (const g of store!.of(ref)!.gone) gone.push({ r, g });
  }
  if (gone.length) {
    gone.sort((a, b) => b.g.year - a.g.year || (a.r.ref < b.r.ref ? -1 : 1));
    blocks.push({
      type: "table",
      title: "How their holds ended, the latest first",
      columns: ["Body", "Realm", "Years", "How"],
      rows: gone.slice(0, 40).map(({ r, g }) => ({
        ref: bodyRef(g.rose),
        cells: [
          [link(cap(bodyWords(g.name, g.title)), bodyRef(g.rose))],
          [realmLink(world, r.ref)],
          [`${g.since}–${g.year}`],
          [`${HOW[g.how] ?? g.how}${g.into ? ` the ${g.into}` : ""}`],
        ],
        keys: [g.name, r.town, g.year, g.how],
      })),
      fit: true,
    });
  }
  return blocks;
}

/** A town's law page: the bodies that keep order and judge in its land, by name, with what its land's row holds of each. */
export function lawBodiesRows(world: World, cell: number): Stat[] {
  const here = bodiesIn(world, cell),
    row = bodyLandsStore(world)?.get(cell),
    watch = here.find((x) => x.g.does === DOES.order)?.g,
    court = here.find((x) => x.g.does === DOES.judge)?.g,
    rows: Stat[] = [];
  if (court)
    rows.push(
      stat("Its court", [bodyLink(world, court), `, under ${court.leader.name}`], {
        why: court.event,
        parts: [
          part("how honest", besides(court)),
          ...(row
            ? [
                part("its reach over this land", th(row[BODY_ROW.court]!)),
                part("those it holds of this land", count(row[BODY_ROW.held]!)),
              ]
            : []),
        ],
      }),
    );
  if (watch)
    rows.push(
      stat("Who keeps order", [bodyLink(world, watch), `, under ${watch.leader.name}`], {
        why: watch.event,
        parts: [
          part("how honest", besides(watch)),
          part("its hands", count(watch.staff)),
          ...(row ? [part("of a full watch for this land", th(row[BODY_ROW.watch]!))] : []),
        ],
      }),
    );
  return rows;
}
