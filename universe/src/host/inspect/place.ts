// The pages of a place (town mode, first slice; host/place.ts): one of its people — their needs and what decided what
// they are doing, their home, their work, their household and its pantry, what they carry — and one of its lots: a
// building with what it holds good by good and what each is made of here, who works in it and who is in it now; a home
// with its households. Read of the place as kept: a page asks nothing of it and moves nothing.
import { DAY, YEAR, type Ref, type World } from "../../kernel/index.ts";
import { FOODS, GOODS, OCC } from "../../rules/index.ts";
import { lifeOf, marketGoodRef, populationContext } from "../../sim/index.ts";
import {
  placeLotRef,
  placePersonRef,
  type Block,
  type Item,
  type Line,
  type PageModel,
  type Stat,
} from "../../bridge/index.ts";
import { townStuff } from "../chain.ts";
import {
  ACT,
  ACT_WORDS,
  AT,
  IDLE_WORTH,
  NEED_WORDS,
  PLACE_MOST,
  hapWords,
  placeIndexOf,
  placeLot,
  placePerson,
  placesOf,
  pressOf,
  type Place,
} from "../place.ts";
import { lotWords, placeNames, tradeWords, whyWords } from "../placeplan.ts";
import { buildingRef, lotRef, townPartOf } from "./fabric.ts";
import { townLink } from "./names.ts";
import { link, many, stat, yearNow } from "./words.ts";

const pct = (x: number) => `${Math.round(x * 100)}%`,
  amount = (x: number) => (x >= 100 ? `${Math.round(x)}` : x >= 10 ? x.toFixed(1) : x.toFixed(2)),
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

/** What each good is made of in a place's land, as its making chain names it (none: it is what it is). */
function stuffOf(world: World, place: Place): (good: number) => string | null {
  let stuff: ReturnType<typeof townStuff> | null = null;
  const of = () => (stuff ??= townStuff(world, place.cell, Math.floor(place.t / YEAR)));
  return (good) => {
    const id = GOODS[good]?.id;
    if (id === "tools") return of().tool.name;
    if (id === "clothing") return of().cloth.name;
    if (id === "pottery") return of().clay.name;
    if (id === "copper" || id === "tin" || id === "iron")
      return of().ore?.yields === id ? `smelted from ${of().ore!.name}` : null;
    return null;
  };
}

/** A lot of a place as a link to its page here. */
const lotLink = (place: Place, lot: number) =>
  link(lotWords(place, lot), placeLotRef(place.town, lot));

/** A stock as rows: each good held, how much, what it is made of here; the good's own page behind it. */
function stockRows(world: World, place: Place, stock: readonly number[]): Stat[] {
  const of = stuffOf(world, place),
    rows: Stat[] = [];
  stock.forEach((x, g) => {
    if (x <= 0) return;
    const made = of(g);
    rows.push(
      stat(
        cap(GOODS[g]!.name),
        [`${amount(x)} ${GOODS[g]!.food ? "person-months" : "units"}`, made ? ` · ${made}` : ""],
        { why: marketGoodRef(place.cell, g) },
      ),
    );
  });
  return rows;
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** The page of one of a place's people: `plc:<town>:<id>`. */
export function placePersonPage(world: World, ref: string): PageModel {
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
    r = placePerson(world, place, id),
    year = yearNow(world);
  if (!r) {
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
  const names = placeNames(world, place),
    life = lifeOf(world),
    child = r.age < life.adulthood,
    i = placeIndexOf(place, id),
    p = place.people,
    name = names(id, r.sex, r.houseKey),
    doing = `${cap(ACT_WORDS[r.act]!)}${r.eta > 0 ? `, walking to ${lotWords(place, r.to)}` : r.act === ACT.sleep || r.act === ACT.eat ? "" : ` at ${lotWords(place, r.at)}`}`,
    needRows: Stat[] = NEED_WORDS.map((w, q) =>
      stat(cap(w), `${pct(r.needs[q]!)} full, pressing ${pct(pressOf(r.needs[q]!))}`),
    ),
    kin: Item[] = r.household.map((k) => {
      const j = placeIndexOf(place, k),
        age = (place.t / DAY - p.born[j]!) / 365,
        sex = p.sexOcc[j]! >> 4;
      return {
        line: [
          link(names(k, sex, r.houseKey), placePersonRef(place.town, k)),
          `, ${Math.floor(age)}, ${tradeWords(p.sexOcc[j]! & 15, age < life.adulthood)}`,
        ],
      };
    }),
    pantry = new Array<number>(GOODS.length).fill(0);
  FOODS.forEach((g, k) => (pantry[g] = r.pantry[k]!));
  const stats: Stat[] = [
      stat("Age", `${Math.floor(r.age)}`),
      stat("Work", [
        cap(tradeWords(r.occupation, child)),
        r.craft ? `: ${r.craft}` : "",
        r.occupation !== OCC.dependent ? " at " : "",
        r.occupation !== OCC.dependent ? lotLink(place, r.work) : "",
      ]),
      stat("Now", doing),
      stat("Home", [lotLink(place, r.home)]),
    ],
    happened = place.log
      .filter((x) => x.id === id)
      .map((x): Item => ({ line: [`Year ${Math.floor(x.t / YEAR)}: ${hapWords(x.what)}`] })),
    blocks: Block[] = [
      { type: "facts", rows: [...stats, stat("Town", [townLink(world, s.ref)])] },
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
      { type: "facts", title: "Needs", rows: needRows },
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
    ];
  return {
    ref,
    kind: "person",
    icon: child ? "🧒" : "🧑",
    title: name,
    subtitle: [`${cap(tradeWords(r.occupation, child))} of `, townLink(world, s.ref)],
    color: null,
    place: { scale: "village", town: s.ref },
    stats,
    tabs: [{ id: "overview", name: "Overview", blocks }],
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
    names = placeNames(world, place),
    p = place.people,
    life = lifeOf(world),
    year = yearNow(world),
    who = (ids: readonly number[], most = 40): Item[] =>
      ids.slice(0, most).map((id) => {
        const j = placeIndexOf(place, id),
          age = (place.t / DAY - p.born[j]!) / 365;
        return {
          line: [
            link(
              names(id, p.sexOcc[j]! >> 4, place.houses.key[p.house[j]!]!),
              placePersonRef(place.town, id),
            ),
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
    stats: Stat[] = [
      stat("Holds", rows.length ? many(rows.length, "kind of good", "kinds of goods") : "nothing"),
      ...(r.kind ? [stat("Working here", `${r.working.length}`)] : []),
      ...(r.households.length
        ? [stat("Households", `${r.households.length}`), stat("Living here", `${r.living.length}`)]
        : []),
      stat("Here now", `${r.here.length}`),
    ],
    blocks: Block[] = [
      {
        type: "facts",
        rows: [
          ...stats,
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
              ? "The square: what the town holds that has no building to lie in lies here, and those who want company come."
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
      ...(rows.length
        ? [{ type: "facts" as const, title: r.kind ? "Stocks" : "Pantries", rows }]
        : []),
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
