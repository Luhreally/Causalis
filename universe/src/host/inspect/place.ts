// The pages of a place (town mode; host/place.ts): one of its people, leading with their four needs and why they do
// what they do, then their home, their work, their household and its pantry, what they carry; and one of its lots,
// leading with what it holds good by good and what each is made of here, then who works in it, lives in it and is in it
// now. One the god game names (a holder of a line of the town's roster) has one page, the god game's, with these laid
// at its head while the town is kept. Read of the place as kept: a page asks nothing of it and moves nothing.
import { DAY, YEAR, type Ref, type World } from "../../kernel/index.ts";
import { FOODS, GOODS, OCC } from "../../rules/index.ts";
import { lifeOf, marketGoodRef, populationContext } from "../../sim/index.ts";
import {
  placeLotRef,
  type Block,
  type Item,
  type Line,
  type PageModel,
  type Stat,
} from "../../bridge/index.ts";
import {
  ACT,
  ACT_WORDS,
  AT,
  CAUSE,
  MOOD_UNHEEDING,
  MOOD_WORDS,
  IDLE_WORTH,
  NEED_WORDS,
  PLACE_MOST,
  hapWords,
  ordersOf,
  placeIndexOf,
  placeLot,
  placePerson,
  placesOf,
  pressOf,
  type Place,
} from "../place.ts";
import {
  ailWords,
  lotWords,
  placeStuff,
  placeWho,
  placedHolder,
  tradeWords,
  whyWords,
} from "../placeplan.ts";
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
    doing = `${cap(ACT_WORDS[r.act]!)}${r.eta > 0 ? `, walking to ${lotWords(place, r.to)}` : r.act === ACT.sleep || r.act === ACT.eat ? "" : ` at ${lotWords(place, r.at)}`}`,
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
  const happened = place.log
    .filter((x) => x.id === id)
    .map((x): Item => ({ line: [`Year ${Math.floor(x.t / YEAR)}: ${hapWords(x.what)}`] }));
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
          ...(p.health[i]
            ? [
                stat(
                  "Health",
                  `${ailWords(place, i)}: abed ${Math.ceil(p.ill[i]! / 144)} more ${Math.ceil(p.ill[i]! / 144) === 1 ? "day" : "days"}`,
                  p.cause[i]! >= CAUSE.sickness && place.ills[p.cause[i]! - CAUSE.sickness]
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
          ...(p.bound[i]
            ? [
                stat(
                  "By your order",
                  p.bound[i] === 255
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
    const gone = place.log.filter((x) => x.id === id).at(-1);
    return unknown(
      world,
      ref,
      s.ref,
      gone
        ? `They ${hapWords(gone.what)} in year ${Math.floor(gone.t / YEAR)}.`
        : "No one of this town is kept by that number.",
    );
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
  const lot = (at.rest[0] ?? 0) - 3,
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
      ...(stopped ? [stat("Work", "stopped by your order")] : []),
      ...(r.kind && lot >= 0 ? [stat("Working here", `${r.working.length}`)] : []),
      ...(r.households.length ? [stat("Living here", `${r.living.length}`)] : []),
      stat("Here now", `${r.here.length}`),
    ],
    blocks: Block[] = [
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
    icon: lot === AT.fields ? "🌾" : lot === AT.square ? "⛲" : r.kind ? "🏛️" : "🏠",
    title: `${title} of ${s.name}`,
    subtitle: ["In ", townLink(world, s.ref as Ref)],
    color: null,
    place: { scale: "village", town: s.ref },
    stats,
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year,
  };
}
