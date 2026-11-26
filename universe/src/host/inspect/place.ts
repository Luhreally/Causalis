// The pages of a place (town mode; host/place.ts): one of its people, leading with their four needs and why they do
// what they do, then their home, their work, their household and its pantry, what they carry; and one of its lots,
// leading with what it holds good by good and what each is made of here, then who works in it, lives in it and is in it
// now. One the god game names (a holder of a line of the town's roster) has one page, the god game's, with these laid
// at its head while the town is kept. Read of the place as kept: a page asks nothing of it and moves nothing.
import { DAY, YEAR, type Ref, type World } from "../../kernel/index.ts";
import { FOODS, GOODS, OCC, SKILL_LEVELS } from "../../rules/index.ts";
import {
  SITE_TONNES,
  asksOf,
  lifeOf,
  marketGoodRef,
  populationContext,
  PRIO_KINDS,
} from "../../sim/index.ts";
import {
  PLACE_WALLS_REF,
  placeLotRef,
  type Block,
  type Item,
  type Line,
  type PageModel,
  type Stat,
} from "../../bridge/index.ts";
import {
  placeKind,
  ACT,
  ACT_WORDS,
  AT,
  BOUND_SITE,
  CAUSE,
  MOOD_UNHEEDING,
  MOOD_WORDS,
  IDLE_WORTH,
  BOUND_ARMS,
  hapTold,
  leans,
  placeTemper,
  NEED_WORDS,
  PLACE_MOST,
  hapWords,
  ordersOf,
  placeIndexOf,
  placeLot,
  placePerson,
  placeSites,
  placesOf,
  pressOf,
  siteStage,
  type Place,
  hazardOf,
  placePrio,
  placeSkill,
  skillHazard,
  skillWorth,
  HAP,
  placeMate,
} from "../place.ts";
import {
  ailWords,
  byOrder,
  careWords,
  healthWords,
  markWords,
  goneNames,
  lotWords,
  siteOf,
  placeStuff,
  placeWho,
  placedHolder,
  tradeWords,
  whyWords,
  OCCUPATION_WORK,
  placeDay,
  placeNamed,
} from "../placeplan.ts";
import { askRef, builtOf } from "./asks.ts";
import { buildingRef, lotRef, townPartOf } from "./fabric.ts";
import { townLink } from "./names.ts";
import { link, many, stat, yearNow } from "./words.ts";

const pct = (x: number) => `${Math.round(x * 100)}%`,
  amount = (x: number) => (x >= 100 ? `${Math.round(x)}` : x >= 10 ? x.toFixed(1) : x.toFixed(2)),
  /** A need as a bar of ten: so much of it full. */
  bar = (x: number) => {
    const n = Math.max(0, Math.min(10, Math.round(x * 10)));
    return `${"▮".repeat(n)}${"▯".repeat(10 - n)} ${pct(x)}`;
  },
  FIFTH_WORDS = [
    "the poorest fifth",
    "the second fifth",
    "the middle fifth",
    "the fourth fifth",
    "the richest fifth",
  ];

function unknown(world: World, ref: string, town: string | null, words: string): PageModel {
  return {
    ref,
    kind: "unknown",
    icon: "❔",
    title: "No one kept here",
    subtitle: [words],
    color: null,
    place: town ? { scale: "village", town } : null,
    stats: [],
    tabs: [{ id: "overview", name: "Overview", blocks: [{ type: "text", lines: [[words]] }] }],
    followable: false,
    year: yearNow(world),
  };
}

/** A lot of a place as a link to its page here. */
const lotLink = (place: Place, lot: number) =>
  link(lotWords(place, lot), placeLotRef(place.town, lot));

/** A stock as rows: each good held, how much, what it is made of here; the good's own page behind it. */
function stockRows(world: World, place: Place, stock: readonly number[]): Stat[] {
  const of = placeStuff(world, place),
    forbidden = ordersOf(world, place.town)?.forbidden ?? [],
    rows: Stat[] = [];
  stock.forEach((x, g) => {
    if (x <= 0) return;
    const made = of(g);
    rows.push(
      stat(
        cap(GOODS[g]!.name),
        [
          `${amount(x)} ${GOODS[g]!.food ? "person-months" : "units"}`,
          made ? ` · ${made}` : "",
          forbidden.includes(g) ? " · not to be sold, by your order" : "",
        ],
        { why: marketGoodRef(place.cell, g) },
      ),
    );
  });
  return rows;
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** One's temper, said: the leanings that mark them out, and what each thing weighs with them against most. */
export function temperWords(place: Place, i: number): string {
  const t = placeTemper(place, i),
    marks: string[] = [],
    mark = (x: number, high: string, low: string) => {
      if (x >= 0.62) marks.push(high);
      else if (x <= 0.38) marks.push(low);
    },
    of = (x: number) => `${Math.round(leans(x) * 100)}`;
  mark(t.kin, "close to their kin", "their own person");
  mark(t.bidden, "biddable", "wilful");
  mark(t.sociable, "fond of company", "solitary");
  mark(t.thrifty, "thrifty", "open-handed");
  mark(t.bold, "bold", "timid");
  return `${marks.length ? cap(marks.join(", ")) : "Much as most of their people are"}: half their people's ways, half their own nature. Against a hundred for most, a death at home weighs ${of(t.kin)} with them, an order ${of(1 - t.bidden)}, a friend ${of(t.sociable)}, a full pantry ${of(t.thrifty)}, want and a home lost ${of(1 - t.bold)}.`;
}

/**
 * A household's line, as a place can read it: its pairs, their young (the eldest first), its other grown; then what has
 * befallen it since the town was entered, each on its day: its births, its dead and their burials, its pairings, who of
 * it came of age, who came and who left.
 */
function houseLine(world: World, place: Place, h: number): Item[] {
  const p = place.people,
    life = lifeOf(world),
    who = placeWho(world, place),
    named = placeNamed(world, place),
    of: number[] = [],
    age = (i: number) => Math.floor((place.t / DAY - p.born[i]!) / 365),
    one = (i: number): Line => [link(who(i).name, who(i).ref), ` (${age(i)})`],
    items: Item[] = [];
  for (let i = 0; i < p.n; i++) if (p.house[i] === h) of.push(i);
  of.sort((a, b) => p.born[a]! - p.born[b]! || p.id[a]! - p.id[b]!);
  const inPair = new Set<number>();
  for (const i of of) {
    const m = placeMate(place, i),
      j = m && !m.promised ? placeIndexOf(place, m.id) : -1;
    if (j < 0 || p.house[j] !== h || inPair.has(i)) continue;
    inPair.add(i).add(j);
    items.push({ line: ["A pair: ", ...one(i), " and ", ...one(j)] });
  }
  const young = of.filter((i) => age(i) < life.adulthood),
    rest = of.filter((i) => age(i) >= life.adulthood && !inPair.has(i)),
    list = (label: string, ids: number[]): void => {
      if (!ids.length) return;
      const line: Line[number][] = [label];
      ids.forEach((i, k) => line.push(...(k ? [", "] : []), ...one(i)));
      items.push({ line });
    };
  list("Its young: ", young);
  list("Its other grown: ", rest);
  // What has befallen it, the latest first: by who of it now, and by its name for one gone with a telling.
  const ids = new Set(of.map((i) => p.id[i]!)),
    key = place.houses.key[h],
    kinds: readonly number[] = [
      HAP.born,
      HAP.died,
      HAP.starved,
      HAP.struckDead,
      HAP.fell,
      HAP.famine,
      HAP.plague,
      HAP.paired,
      HAP.buried,
      HAP.ofAge,
      HAP.came,
      HAP.left,
    ];
  let told = 0;
  for (let k = place.log.length - 1; k >= 0 && told < 12; k--) {
    const x = place.log[k]!;
    if (!kinds.includes(x.what)) continue;
    if (!(ids.has(x.id) || (x.k !== undefined && x.k === key))) continue;
    items.push({
      line: [`${cap(placeDay(x.t))}: ${named(x.id) ?? "one of it"} ${hapTold(place, x, named)}`],
    });
    told++;
  }
  return items;
}

/** One's skill at their trade, said, with what it bears on (null: they keep no trade). */
export function skillLine(world: World, place: Place, i: number): string | null {
  const p = place.people,
    occ = p.sexOcc[i]! & 15;
  if (occ === OCC.dependent) return null;
  const s = placeSkill(place, i),
    worth = Math.round(skillWorth(s.level) * 100),
    hurt = skillHazard(s.level),
    risks = hazardOf(place, occ, p.craft[i]!) > 0;
  // (What it bears on here: what an hour at the fields, the herds or a craft wins or makes, and how often its tools hurt.)
  const makes = occ === OCC.farmer || occ === OCC.herder || occ === OCC.crafter,
    master = SKILL_LEVELS[SKILL_LEVELS.length - 1]!.toLocaleString("en-US");
  return `${cap(s.words)} at ${OCCUPATION_WORK[occ] ?? "their work"}: ${s.hours.toLocaleString("en-US")} hours given to it. ${
    !makes
      ? `A master has given it ${master} hours`
      : s.level >= SKILL_LEVELS.length - 1
        ? `An hour of theirs wins or makes all a master's does${risks ? ", and they are hurt at it no oftener" : ""}`
        : `An hour of theirs wins or makes ${worth} in a hundred of what a master's does${risks ? `, and they are hurt at it ${Math.round(hurt * 10) / 10} times as often` : ""}; a master has given it ${master} hours`
  }. It grows with every hour at their own trade, and begins again at a new one.`;
}

/** One's priorities by your order, said (null: none set). */
function prioLine(world: World, place: Place, i: number): string | null {
  const kinds = placePrio(world, place, place.people.id[i]!);
  if (!kinds) return null;
  const order = ["", "third", "second", "first"],
    said = PRIO_KINDS.map((name, k) => [kinds[k] ?? 0, name] as const)
      .filter(([x]) => x > 0)
      .sort((a, b) => b[0] - a[0])
      .map(([x, name]) => `${name} ${order[x]}`),
    never = PRIO_KINDS.filter((_, k) => !(kinds[k] ?? 0));
  const by = byOrder(place, `prio:${place.people.id[i]!}`);
  return `${by[0]!.toUpperCase()}${by.slice(1)}: ${said.join(", ")}${never.length ? `; never ${never.join(", ")}` : ""}. The trade set highest is theirs; when it has nothing for them they turn to the next that has, as one new to it.`;
}

/** What a place tells of one of its people: their needs and the why first, then what they hold and who they live with. */
function personBlocks(
  world: World,
  place: Place,
  i: number,
): { needs: Stat[]; now: Stat; blocks: Block[] } | null {
  const p = place.people,
    id = p.id[i]!,
    r = placePerson(world, place, id);
  if (!r) return null;
  const life = lifeOf(world),
    who = placeWho(world, place),
    child = r.age < life.adulthood,
    doing = `${r.act === ACT.abed && r.eta > 0 ? "Hurt or sick" : cap(ACT_WORDS[r.act]!)}${r.eta > 0 ? `, ${r.act === ACT.abed ? "brought home to lie abed, to" : "walking to"} ${lotWords(place, r.to)}` : r.act === ACT.sleep || r.act === ACT.eat ? "" : ` at ${lotWords(place, r.at)}`}`,
    needs: Stat[] = NEED_WORDS.map((w, q) => stat(cap(w), bar(r.needs[q]!))),
    lackDays = Math.floor(p.lack[i]! / 144),
    kin: Item[] = r.household.map((k) => {
      const j = placeIndexOf(place, k),
        age = (place.t / DAY - p.born[j]!) / 365,
        w = who(j);
      return {
        line: [
          link(w.name, w.ref),
          `, ${Math.floor(age)}, ${tradeWords(p.sexOcc[j]! & 15, age < life.adulthood)}`,
        ],
      };
    }),
    pantry = new Array<number>(GOODS.length).fill(0);
  FOODS.forEach((g, k) => (pantry[g] = r.pantry[k]!));
  const fi = p.friend[i] ? placeIndexOf(place, p.friend[i]!) : -1,
    friend = fi >= 0 ? who(fi) : null;
  // What befell them, each on its day: and what befell another that was theirs too (a child born to them, their pairing).
  const named = placeNamed(world, place),
    happened = place.log
      .filter((x) => x.id === id || ((x.what === HAP.born || x.what === HAP.paired) && x.a === id))
      .map((x): Item => ({
        line: [
          `${cap(placeDay(x.t))}: ${
            x.id === id
              ? hapTold(place, x, named)
              : x.what === HAP.born
                ? `${named(x.id) ?? "a child"} was born to them`
                : `they and ${named(x.id) ?? "another"} were paired, and are one household`
          }`,
        ],
      })),
    mate = placeMate(place, i),
    mi = mate ? placeIndexOf(place, mate.id) : -1,
    line = houseLine(world, place, p.house[i]!);
  return {
    needs,
    now: stat("Now", doing),
    blocks: [
      {
        type: "facts",
        title: "Needs",
        rows: [
          ...needs.map((n, q) => ({
            ...n,
            value: [`${bar(r.needs[q]!)}, pressing ${pct(pressOf(r.needs[q]!))}`],
          })),
          stat(
            "Mood",
            `${p.mood[i]! >= 25 ? "Glad" : p.mood[i]! >= -15 ? "Even" : p.mood[i]! >= MOOD_UNHEEDING ? "Low" : "Too low to heed an order"} (${p.mood[i]! > 0 ? "+" : ""}${p.mood[i]}): ${
              MOOD_WORDS.filter(([bit]) => p.moodWhy[i]! & bit)
                .map(([, words]) => words)
                .join("; ") || "nothing bears on it now"
            }. It moves what their work is worth to them by ${Math.round(p.mood[i]! / 4)} in a hundred.`,
          ),
          stat("Temper", temperWords(place, i)),
          // (In a land of more than one people: whose they are. Their needs are read off their own people's body.)
          ...(placeKind(world, place, i)
            ? [
                stat(
                  "People",
                  `Of ${placeKind(world, place, i)!.name}: their hunger, their rest, the cold they feel and the load they carry are their own people's body's`,
                ),
              ]
            : []),
          ...(markWords(world, place, i) ? [stat("Bears", `${markWords(world, place, i)}.`)] : []),
          ...(p.health[i]
            ? [
                stat(
                  "Health",
                  `${healthWords(world, place, i) ?? ailWords(place, i)}. ${careWords(place)}`,
                  p.health[i] === 2 && place.ills[p.cause[i]! - CAUSE.sickness]
                    ? { why: place.ills[p.cause[i]! - CAUSE.sickness]!.split("|")[1]! }
                    : {},
                ),
              ]
            : []),
          ...(lackDays > 0
            ? [
                stat(
                  "In want",
                  `${lackDays} ${lackDays === 1 ? "day" : "days"}: their work is worth less for it, and they sicken`,
                ),
              ]
            : []),
        ],
      },
      {
        type: "text",
        title: "Why",
        lines: [
          [whyWords(world, place, i)],
          [
            r.worth > 0
              ? `Each need presses as its fullness cubed. A need is served when it presses harder than the next hour's work is worth to them (${pct(r.worth)} by day; less in the dark) and than rest is worth (${pct(IDLE_WORTH)}). Their work's worth is what their trade earns here against the town's other trades.`
              : `Each need presses as its fullness cubed. They keep no trade, so a need is served when it presses harder than rest is worth (${pct(IDLE_WORTH)}).`,
          ],
        ],
      },
      {
        type: "facts",
        title: "In the town",
        rows: [
          stat("Now", doing),
          stat("Home", [lotLink(place, r.home)]),
          ...(mate && mi >= 0
            ? [
                stat(
                  mate.promised ? "Promised to" : "Paired with",
                  mate.promised
                    ? [
                        link(who(mi).name, who(mi).ref),
                        ", their friend: they are paired on a day of the weeks to come",
                      ]
                    : [link(who(mi).name, who(mi).ref)],
                ),
              ]
            : []),
          ...(skillLine(world, place, i) ? [stat("Skill", skillLine(world, place, i)!)] : []),
          ...(prioLine(world, place, i) ? [stat("Priorities", prioLine(world, place, i)!)] : []),
          ...(p.bound[i]
            ? [
                stat(
                  "By your order",
                  p.bound[i] === BOUND_ARMS
                    ? ["Standing to arms in the square, in the hours their work would have had"]
                    : p.bound[i] === BOUND_SITE
                      ? ["One of the crew at ", lotLink(place, r.work)]
                      : p.bound[i] === 255
                        ? ["Put at ", lotLink(place, r.work)]
                        : [`Held to work as ${tradeWords(p.bound[i]! - 1, false)}`],
                ),
              ]
            : []),
          ...(friend
            ? [stat("Friend", [link(friend.name, friend.ref), ", met in company in the square"])]
            : []),
          stat("Work", [
            cap(tradeWords(r.occupation, child)),
            r.craft ? `: ${r.craft}` : "",
            r.occupation !== OCC.dependent ? " at " : "",
            r.occupation !== OCC.dependent ? lotLink(place, r.work) : "",
          ]),
        ],
      },
      {
        type: "facts",
        title: "Holds",
        rows: [
          stat(
            "In hand",
            r.carry ? `${amount(r.carry.amount)} of ${GOODS[r.carry.good]!.name}` : "nothing",
            r.carry ? { why: marketGoodRef(place.cell, r.carry.good) } : {},
          ),
          ...stockRows(world, place, pantry).map((row) => ({
            ...row,
            label: `Pantry: ${row.label.toLowerCase()}`,
          })),
          ...(pantry.every((x) => x <= 0) ? [stat("Pantry", "bare")] : []),
          stat(
            "Household's year",
            `${Math.round(r.means)} in grain, of ${FIFTH_WORDS[r.fifth]} here`,
          ),
        ],
      },
      ...(kin.length ? [{ type: "list" as const, title: "Household", items: kin }] : []),
      ...(line.length
        ? [{ type: "list" as const, title: "Their household's line", items: line }]
        : []),
      ...(happened.length
        ? [{ type: "list" as const, title: "Since the town was entered", items: happened }]
        : []),
    ],
  };
}

/**
 * The god game's page of one of a town's named people (a holder of a line of its roster), with what the place tells of
 * them laid at its head while the town is kept and they are of it: one person, one page.
 */
export function withPlace(world: World, ref: string, page: PageModel): PageModel {
  const at = townPartOf(ref),
    place = at ? placesOf(world)?.get(at.town) : undefined;
  if (!at || !place || at.rest.length < 2) return page;
  const i = placedHolder(place, at.rest[0]!, at.rest[1]!),
    told = i >= 0 ? personBlocks(world, place, i) : null;
  if (!told || !page.tabs.length) return page;
  const [first, ...rest] = page.tabs;
  return {
    ...page,
    stats: [...told.needs, told.now, ...page.stats],
    tabs: [{ ...first!, blocks: [...told.blocks, ...first!.blocks] }, ...rest],
  };
}

/**
 * The page of one of a realm's key figures (its ruler, an heir, a keeper), with what the place tells of them at its head
 * while the town they live in is kept and they are one of its people (host/place.ts placeFigure).
 */
export function withPlaceFigure(world: World, ref: string, page: PageModel): PageModel {
  for (const place of placesOf(world)?.places ?? []) {
    const at = place.figRef.indexOf(ref);
    if (at < 0) continue;
    const i = placeIndexOf(place, place.figId[at]!),
      told = i >= 0 ? personBlocks(world, place, i) : null;
    if (!told || !page.tabs.length) return page;
    const [first, ...rest] = page.tabs;
    return {
      ...page,
      stats: [...told.needs, told.now, ...page.stats],
      tabs: [{ ...first!, blocks: [...told.blocks, ...first!.blocks] }, ...rest],
    };
  }
  return page;
}

/** The page of one of a place's people: `plc:<town>:<id>`. */
export function placePersonPage(
  world: World,
  ref: string,
  named: (ref: string) => PageModel,
): PageModel {
  const at = townPartOf(ref),
    place = at ? placesOf(world)?.get(at.town) : undefined,
    s = at ? populationContext(world).settlements.get(at.town) : undefined;
  if (!at || !place || !s)
    return unknown(
      world,
      ref,
      at?.town ?? null,
      "This town is not kept in detail now: enter it to meet its people.",
    );
  const id = at.rest[0] ?? -1,
    i = placeIndexOf(place, id),
    r = i >= 0 ? placePerson(world, place, id) : null,
    told = r ? personBlocks(world, place, i) : null,
    year = yearNow(world);
  if (!r || !told) {
    const gone = place.log.filter((x) => x.id === id).at(-1),
      name = goneNames(world, place)(id);
    return {
      ...unknown(
        world,
        ref,
        s.ref,
        gone
          ? `${name ?? "They"} ${hapTold(place, gone)} in year ${Math.floor(gone.t / YEAR)}.`
          : "No one of this town is kept by that number.",
      ),
      ...(name ? { title: name, icon: "🕯️" } : {}),
    };
  }
  // (One the god game names has the god game's page, the place's telling at its head.)
  const who = placeWho(world, place)(i);
  if (who.ref !== ref && who.ref.startsWith("folk:")) return named(who.ref);
  const child = r.age < lifeOf(world).adulthood;
  return {
    ref,
    kind: "person",
    icon: child ? "🧒" : "🧑",
    title: who.name,
    subtitle: [
      `${cap(tradeWords(r.occupation, child))}, ${Math.floor(r.age)}, of `,
      townLink(world, s.ref),
    ],
    color: null,
    place: { scale: "village", town: s.ref },
    stats: [...told.needs, told.now],
    tabs: [{ id: "overview", name: "Overview", blocks: told.blocks }],
    followable: false,
    year,
  };
}

/** The page of one of a place's lots, its square or its fields: `plcl:<town>:<lot + 3>`. */
export function placeLotPage(world: World, ref: string): PageModel {
  const at = townPartOf(ref),
    place = at ? placesOf(world)?.get(at.town) : undefined,
    s = at ? populationContext(world).settlements.get(at.town) : undefined;
  if (!at || !place || !s)
    return unknown(
      world,
      ref,
      at?.town ?? null,
      "This town is not kept in detail now: enter it to see what its buildings hold.",
    );
  const lot = at.rest[0] === PLACE_WALLS_REF ? AT.walls : (at.rest[0] ?? 0) - 3,
    r = placeLot(place, lot),
    p = place.people,
    life = lifeOf(world),
    whoOf = placeWho(world, place),
    year = yearNow(world),
    who = (ids: readonly number[], most = 40): Item[] =>
      ids.slice(0, most).map((id) => {
        const j = placeIndexOf(place, id),
          age = (place.t / DAY - p.born[j]!) / 365,
          w = whoOf(j);
        return {
          line: [
            link(w.name, w.ref),
            `, ${tradeWords(p.sexOcc[j]! & 15, age < life.adulthood)}, ${ACT_WORDS[p.act[j]!]}`,
          ],
        };
      }),
    more = (ids: readonly number[], most = 40): Line[] =>
      ids.length > most ? [[`and ${ids.length - most} more`]] : [],
    title = cap(lotWords(place, lot).replace(/^the /, "")),
    site = placeSites(world, place).find((x) => x.lot === lot),
    ask = site ? asksOf(world).ofTown(place.town)[site.n] : undefined,
    stuff = site ? builtOf(world, place.cell) : "",
    tonnes = (x: number) => (x >= 10 ? `${Math.round(x)}` : x.toFixed(1)),
    monthsOf = (x: number) =>
      x < 1.5
        ? "about a month"
        : x < 18
          ? `about ${Math.round(x)} months`
          : `about ${Math.round(x / 12)} years`,
    // A site: how far it has got, what the rest of it wants, who works it. The bill is the world's own (sim/town/asks.ts).
    siteBlocks: Block[] = site
      ? [
          {
            type: "facts",
            title: "Going up",
            rows: [
              stat("So far", `${pct(site.share)} done: ${siteStage(site.share, site.kind)}`),
              stat(
                "Worked by",
                site.inHand
                  ? `its own people, ${byOrder(place, `site:${site.n}`)}: ${site.crew.length} of ${site.hands} hands, ${site.busy} at it now`
                  : `the town's month, ${site.hands} hands, as in the world's own reckoning`,
              ),
              ...(site.stopped
                ? [
                    stat(
                      "Stopped",
                      "as its land's month stops it: fighting on its land, the ground's shaking, or nothing in store to feed its hands",
                    ),
                  ]
                : site.raised
                  ? [
                      stat(
                        "Done here",
                        "its land is told at the month's turn, or on leaving, and then it stands",
                      ),
                    ]
                  : [stat("At this rate", `${monthsOf(site.months)} more`)]),
              stat(
                cap(stuff),
                site.inHand
                  ? `${tonnes(site.wants)} tonnes still wanted; ${tonnes(site.stuff)} lying on the site, ${tonnes(site.brought)} brought so far, a load at a time from outside the town`
                  : `${tonnes(site.wants)} tonnes still wanted`,
              ),
              stat(
                "Tools",
                `${amount(site.toolsWanted)} more to be worn out${site.inHand ? `; ${amount(site.tools)} on the site, brought from the market by its carriers` : ", out of its land's stores"}`,
                {
                  why: marketGoodRef(
                    place.cell,
                    GOODS.findIndex((g) => g.id === "tools"),
                  ),
                },
              ),
              stat(
                "Food",
                `${amount(site.food)} person-months over what its hands would eat at home: the work makes them hungry half again as fast`,
              ),
              ...(ask
                ? [stat("The asking", [link("how it was asked and answered", askRef(ask))])]
                : []),
            ],
          },
          {
            type: "text",
            lines: [
              [
                site.inHand
                  ? `Its bill is the world's own: ${SITE_TONNES} tonnes of ${stuff} to each person-month of raising, a measure of tools worn out every forty, and half a person-month of food over the usual to each. What its crew does here is told to its land at the month's turn, or on leaving, and its land's month puts no hands of its own to it for the time told: nothing is raised twice. Give it back on the Work sheet and it goes up by the town's month as before.`
                  : `It goes up by the town's own month, as in the world's reckoning. Take it in hand on the Work sheet to put a crew of your own choosing to it: they carry its ${stuff} in, build it and are fed for it here, and its land is told what they did.`,
              ],
            ],
          },
        ]
      : [],
    own =
      lot >= 0
        ? r.kind
          ? buildingRef(place.town, { at: lot, start: r.start })
          : lotRef(place.town, lot)
        : null,
    rows = stockRows(world, place, r.stock),
    stopped = !!ordersOf(world, place.town)?.shut.includes(lot),
    // (What it holds first: its greatest stocks, then who is about it.)
    held = r.stock
      .map((x, g) => [x, g] as const)
      .filter(([x]) => x > 0)
      .sort((a, b) => b[0] - a[0])
      .slice(0, 3)
      .map(([x, g]) => stat(cap(GOODS[g]!.name), amount(x))),
    stats: Stat[] = [
      ...(held.length ? held : [stat("Holds", "nothing now")]),
      ...(site
        ? [stat("Going up", `${pct(site.share)}, ${siteStage(site.share, site.kind)}`)]
        : []),
      ...(stopped ? [stat("Work", "stopped by your order")] : []),
      ...(r.kind && lot >= 0 ? [stat("Working here", `${r.working.length}`)] : []),
      ...(r.households.length ? [stat("Living here", `${r.living.length}`)] : []),
      stat("Here now", `${r.here.length}`),
    ],
    blocks: Block[] = [
      ...siteBlocks,
      rows.length
        ? { type: "facts" as const, title: r.kind ? "Holds" : "Pantries hold", rows }
        : {
            type: "text" as const,
            title: "Holds",
            lines: [
              [
                lot === AT.square
                  ? "Nothing now: the town's goods lie in its granary, its market and its workshops, and its square holds only what has no building to lie in."
                  : "Nothing now.",
              ],
            ],
          },
      {
        type: "facts",
        rows: [
          ...(r.kind && lot >= 0
            ? [stat("Working here", many(r.working.length, "person", "people"))]
            : []),
          ...(r.households.length
            ? [
                stat("Households", `${r.households.length}`),
                stat("Living here", `${r.living.length}`),
              ]
            : []),
          stat("Here now", `${r.here.length}`),
          stat("Town", [townLink(world, s.ref)]),
          ...(own
            ? [
                stat("The building", [
                  link(r.kind ? "how it was raised and what it is" : "the lot and its home", own),
                ]),
              ]
            : []),
        ],
      },
      {
        type: "text",
        lines: [
          [
            lot === AT.square
              ? "The square: those who want company come here."
              : lot === AT.fields
                ? "The fields and pastures outside the town: its farmers and herders work here and bring in what they win a load at a time."
                : site && lot === AT.walls
                  ? "The site of its walls: they stand on no lot, and go up a length at a time about their ring. Its crew works at the length the work has come to; nothing is kept here but the tools they wear."
                  : site
                    ? "A site: nothing is made or kept here until it stands, but the tools its crew wears."
                    : r.kind
                      ? "What lies here is the town's share of its land's stocks, as the world reckons them, laid where it is worked and kept; what is made and eaten here is counted, and the rest comes and goes by the land's own reckoning each month."
                      : "A home: each household's pantry holds its food, eaten from at every meal and filled from the town's stores and its own fields.",
          ],
          ...(place.people.n >= PLACE_MOST
            ? [
                [
                  `The town is greater than is kept one by one: ${PLACE_MOST} of its people are, by its heart's homes.`,
                ],
              ]
            : []),
        ],
      },
      ...(r.working.length
        ? [
            { type: "list" as const, title: "Work here", items: who(r.working) },
            ...(more(r.working).length ? [{ type: "text" as const, lines: more(r.working) }] : []),
          ]
        : []),
      ...(r.living.length
        ? [
            { type: "list" as const, title: "Live here", items: who(r.living) },
            ...(more(r.living).length ? [{ type: "text" as const, lines: more(r.living) }] : []),
          ]
        : []),
      ...(r.here.length
        ? [{ type: "list" as const, title: "Here now", items: who(r.here, 24) }]
        : []),
    ];
  return {
    ref,
    kind: "building",
    icon: lot === AT.fields ? "🌾" : lot === AT.square ? "⛲" : site ? "🏗️" : r.kind ? "🏛️" : "🏠",
    title: site ? `${siteOf(title)} of ${s.name}, going up` : `${title} of ${s.name}`,
    subtitle: ["In ", townLink(world, s.ref as Ref)],
    color: null,
    place: { scale: "village", town: s.ref },
    stats,
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year,
  };
}
