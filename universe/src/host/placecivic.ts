// A town's works and orders (town mode, R6), as Classic's civic inspectors had them: what is going up, each with how far
// it has got, its crew and what bounds it (host/place.ts placeSites); what its land is coming to know (sim/lore findableAt:
// what it may find next, with what each asks of its world's matter, and what it came to know last) and its learned; and
// its management, every standing order given it (sim/town/managed.ts), said. Read only.
import { YEAR, type World } from "../kernel/index.ts";
import { GOODS } from "../rules/index.ts";
import { academyOf, findableAt, loreOf, populationContext } from "../sim/index.ts";
import { placeCivicRef, placeLotRef, type PlaceInspectCivic } from "../bridge/index.ts";
import { ordersOf, placeSites, type Place } from "./place.ts";
import { lotWords } from "./placeplan.ts";

/** The most of what its land may find next, and of what it came to know last, told. */
const FINDABLE_TOLD = 8,
  KNOWN_TOLD = 6;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const words = (id: string) => id.replace(/[-_]/g, " ");

/** A town's works and orders (R6). */
export function placeCivic(world: World, place: Place): PlaceInspectCivic {
  const sites = placeSites(world, place).map((s) => ({
      name: cap(words(s.kind)),
      ref: placeLotRef(place.town, s.lot),
      share: Math.round(s.share * 100),
      words: `${s.inHand ? `${s.hands} at it of the ${s.most} it could take` : "not in hand"}; ${s.answer}`,
    })),
    ctx = populationContext(world),
    cell = place.cell,
    year = Math.floor(place.t / YEAR),
    findable = findableAt(ctx, cell)
      .slice(0, FINDABLE_TOLD)
      .map((p) => ({
        name: cap(p.name),
        words: [
          p.needs.length ? `built on ${p.needs.map(words).join(", ")}` : "built on nothing known",
          ...(p.asks?.length
            ? [`asks of its world's matter: ${p.asks.map(words).join(", ")}`]
            : []),
          ...(p.seen
            ? [`opened by having lived through ${p.seen === "quake" ? "a quake" : "a long dry"}`]
            : []),
        ].join("; "),
      })),
    known = loreOf(world)
      .of(cell)
      .sort((a, b) => b[1].year - a[1].year || a[0].localeCompare(b[0]))
      .slice(0, KNOWN_TOLD)
      .map(([id, k]) => `${cap(words(id))}, year ${k.year}`),
    academy = academyOf(world, cell),
    learned = academy
      ? `${Math.round(academy.learned * 1000) / 10}% of its land learned past their letters, of the ${Math.round(academy.target * 1000) / 10}% its patrons keep (${academy.houses} houses of learning)`
      : "No higher learning weighed in its land yet",
    o = ordersOf(world, place.town),
    orders: [string, string][] = [];
  if (o) {
    orders.push([
      "Granary",
      o.hold ? `Holds back ${o.hold} months of its people's food` : "Holds nothing back",
    ]);
    if (o.forbidden.length)
      orders.push([
        "Market",
        `Lets none go of ${o.forbidden.map((g) => GOODS[g]?.name ?? "?").join(", ")}`,
      ]);
    if (o.shut.length)
      orders.push(["Work stopped", o.shut.map((lot) => lotWords(place, lot)).join("; ")]);
    if (o.held.length) orders.push(["Held against", o.held.join(", ")]);
    orders.push(["Shelter", o.shelter >= 0 ? cap(lotWords(place, o.shelter)) : "None opened"]);
    if (o.prio?.length)
      orders.push(["Work by name", `${o.prio.length / 2} of its people given priorities`]);
    if (o.bills?.length)
      orders.push([
        "Bills",
        Array.from({ length: o.bills.length / 2 }, (_, k) => {
          const g = GOODS[o.bills![2 * k]!]?.name ?? "?",
            n = o.bills![2 * k + 1]!;
          return n ? `hold ${n} of ${g}` : `make no ${g}`;
        }).join("; "),
      ]);
    if (o.refuse?.length) orders.push(["Stores refuse", `${o.refuse.length / 2} goods`]);
    if (o.zones?.length) orders.push(["Zones", `${o.zones.length / 2} lots zoned`]);
    orders.push([
      "Guard's post",
      o.post !== undefined ? cap(lotWords(place, o.post)) : "The square",
    ]);
    orders.push(["Gate", o.gate === 0 ? "Shut to newcomers" : "Open"]);
    if (o.freed?.length) orders.push(["Freed by your word", `${o.freed.length}`]);
  }
  return {
    kind: "civic",
    ref: placeCivicRef(place.town),
    name: "Its works and orders",
    icon: "🏛️",
    sub: `${sites.length} going up · ${findable.length} it may find next · ${o ? "under your orders" : "as its land runs it"}`,
    sites,
    findable,
    known,
    learned,
    orders,
    managed: !!o,
    year,
  };
}
