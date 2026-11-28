// What a town lives on (town mode, R5), as Classic's settlement chemistry and production had it: all it holds by the
// stuff it is (each good's unit weight and its parts by substance, rules/matter.ts GOOD_MATTER), what it made and used
// today, its water (O8's reading of what is at hand), its fuel, its people's poisons, the vulnerabilities its own
// readings name (food short, no water at hand, sickness, the hurt, the homeless, what strikes it now), and how steady it
// is (its people's mood, those past heeding, and its month's births, deaths, comings and goings). Read only.
import { DAY, type World } from "../kernel/index.ts";
import { GOODS, GOOD_MATTER, findSubstance, needsOf } from "../rules/index.ts";
import { worldLife } from "../gen/index.ts";
import { homePlanet } from "../sim/index.ts";
import { placeMakingRef, placeLotRef, PLACE_AT, type PlaceInspectMaking } from "../bridge/index.ts";
import { HAP, MOOD_UNHEEDING, hapIsDeath, type Place } from "./place.ts";
import { dangersSheet, stocksSheet } from "./placeplan.ts";
import { placeBelow } from "./placebelow.ts";
import { colourOf, wayOf } from "./placeinventory.ts";

/** The most stuffs told by name (the rest summed). */
const STUFFS_TOLD = 10;
/** Days of food under which a town is short (two months). */
const FOOD_SHORT = 60;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What a town lives on (R5). */
export function placeMaking(world: World, place: Place): PlaceInspectMaking {
  const stocks = stocksSheet(world, place),
    dangers = dangersSheet(world, place),
    below = placeBelow(world, place),
    life = worldLife(homePlanet(world).generated),
    p = place.people,
    kg = new Map<string, { kg: number; colour: string }>();
  for (const r of stocks.rows) {
    const g = GOODS[r.good],
      m = g ? GOOD_MATTER[g.id] : undefined,
      way = m ? wayOf(m.ways, r.stuff ?? "") : null;
    if (!m || !way || !(r.held > 0)) continue;
    for (const [id, share] of way.parts) {
      const name = cap(findSubstance(id)?.name ?? id),
        w = r.held * m.unitKg * share,
        was = kg.get(name);
      if (was) was.kg += w;
      else kg.set(name, { kg: w, colour: colourOf(id) });
    }
  }
  const all = [...kg].sort((a, b) => b[1].kg - a[1].kg || a[0].localeCompare(b[0])),
    stuffs = all.slice(0, STUFFS_TOLD).map(([name, x]) => ({
      name,
      kg: Math.round(x.kg),
      colour: x.colour,
    })),
    rest = all.slice(STUFFS_TOLD).reduce((s, [, x]) => s + x.kg, 0);
  // (What it made and used today, good by good: the most made first.)
  const making = stocks.rows
    .filter((r) => r.made > 0 || r.used > 0 || r.came > 0)
    .sort((a, b) => b.made - a.made || b.used - a.used)
    .slice(0, 10)
    .map((r) => ({
      name: cap(r.stuff ? `${r.name} (${r.stuff})` : r.name),
      made: round(r.made),
      used: round(r.used),
      came: round(r.came),
    }));
  // (Its fuel: what it holds of what burns, by weight; else its hearths burn wood of its land's woods.)
  const fuel = stocks.rows
    .filter((r) => GOODS[r.good]?.id === "coal" || GOODS[r.good]?.id === "oil")
    .filter((r) => r.held > 0)
    .map(
      (r) =>
        `${cap(r.name)}: ${Math.round(r.held * (GOOD_MATTER[GOODS[r.good]!.id]?.unitKg ?? 0)).toLocaleString("en-US")} kg held`,
    );
  // (Named vulnerabilities, each from a reading of its own.)
  let sick = 0,
    unheeding = 0,
    mood = 0;
  for (let i = 0; i < p.n; i++) {
    if (p.health[i] === 2) sick++;
    if (p.mood[i]! < MOOD_UNHEEDING) unheeding++;
    mood += p.mood[i]!;
  }
  mood = p.n ? mood / p.n : 0;
  const vulnerable: { name: string; words: string; ref: string | null }[] = [];
  if (stocks.foodDays < FOOD_SHORT)
    vulnerable.push({
      name: "Food short",
      words: `${Math.round(stocks.foodDays)} days' food in its stores and pantries`,
      ref: placeLotRef(place.town, PLACE_AT.square),
    });
  if (!below.water && !below.undersea && !below.wells)
    vulnerable.push({ name: "No water at hand", words: below.words, ref: null });
  if (sick >= Math.max(2, p.n * 0.02))
    vulnerable.push({ name: "Sickness", words: `${sick} of its ${p.n} sick`, ref: null });
  if (dangers.hurt.length)
    vulnerable.push({ name: "The hurt", words: `${dangers.hurt.length} lying hurt`, ref: null });
  if (dangers.homeless.households)
    vulnerable.push({
      name: "Homeless",
      words: `${dangers.homeless.households} households, ${dangers.homeless.people} people, without their home`,
      ref: null,
    });
  // (What bears on it now, as its Dangers sheet says; not the line that says nothing does.)
  for (const x of dangers.now.filter((d) => d.icon !== "🕊️"))
    vulnerable.push({ name: `${x.icon} Now`, words: x.words, ref: x.ref });
  if (unheeding)
    vulnerable.push({
      name: "Too unhappy",
      words: `${unheeding} too unhappy to follow orders`,
      ref: null,
    });
  // (How steady it is: its month's happenings, as its log tells them.)
  const from = place.t - 30 * DAY,
    month = { born: 0, died: 0, came: 0, left: 0, broke: 0 };
  for (let k = place.log.length - 1; k >= 0 && place.log[k]!.t >= from; k--) {
    const x = place.log[k]!;
    if (x.what === HAP.born) month.born++;
    else if (hapIsDeath(x.what)) month.died++;
    else if (x.what === HAP.came) month.came++;
    else if (x.what === HAP.left) month.left++;
    else if (x.what === HAP.broke) month.broke++;
  }
  const strain = vulnerable.length + (mood < 0 ? 2 : 0) + (month.broke > 2 ? 1 : 0),
    steady = strain === 0 ? "steady" : strain <= 2 ? "strained" : "failing";
  return {
    kind: "making",
    ref: placeMakingRef(place.town),
    name: "What the town lives on",
    icon: "⚗️",
    sub: `${p.n} people · ${Math.round(stocks.foodDays)} days of food · ${steady}`,
    stuffs,
    rest: Math.round(rest),
    making,
    water: below.words,
    fuel: fuel.length ? fuel : ["None held: its hearths burn wood of its land's woods"],
    poisons: (() => {
      const n = needsOf(life).poisons;
      return n.length
        ? `${cap(n.join(" and "))} poison its people`
        : "Nothing of its world's own air and water poisons its people";
    })(),
    vulnerable,
    steady,
    stability: [
      [
        "Mood",
        `${mood >= 0 ? "+" : ""}${Math.round(mood)} on the mean; ${unheeding} past heeding an order`,
      ],
      [
        "This month",
        `${month.born} born, ${month.died} dead, ${month.came} come, ${month.left} gone`,
      ],
      ["Broke down", `${month.broke} this month, their mood too low to bear`],
    ],
  };
}
const round = (x: number) => Math.round(x * 10) / 10;
