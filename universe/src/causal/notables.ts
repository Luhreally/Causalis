// Notable people in words (sim/notable/notables.ts): who someone is to their people, told from the greatest thing they did, never
// from a list of callings; their rising and their death; and why their people came to know them. Who, what and what came of it:
// never how any harm is done.
import { cellRef } from "../gen/index.ts";
import { type World, yearOfMoment } from "../kernel/index.ts";
import { DOMAIN, DOMAINS } from "../rules/index.ts";
import { NOTABLE_EVENTS, type Deed } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { principleName } from "./lore.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";

/** What of a notable their title is told from. */
export type Titled = {
  readonly many: boolean;
  readonly home: number;
  readonly deeds: readonly Deed[];
  readonly post?: { readonly kind: string; readonly of: string; readonly group?: string };
};

/** One who merely stood out among those who do the same, by domain: a body's, and a line's of a people who keep no one apart. */
const STOOD: readonly (readonly [string, string])[] = [
  ["a fighter known past", "a line of fighters known past"],
  ["one of the learned, whose word was sought past", "a line of the learned, sought past"],
  ["a maker whose works were known past", "a line of makers whose works were known past"],
  ["a holy one, heard past", "a line of the holy, heard past"],
  ["the richest of the traders of", "the richest line of the traders of"],
  ["one who moved the people of", "a line that moved the people of"],
  ["a healer sent for from past", "a line of healers sent for from past"],
  ["a judge whose rulings were followed past", "a line of judges whose rulings were followed past"],
  ["one who went farther than any of", "a line that went farther than any of"],
  ["a killer feared across", "a line of killers feared across"],
];

/** What a deed was, as it follows "the one who …" / "the line that …" (null: told another way). */
function did(world: World, d: Deed, land: string): string | null {
  const n = d.n ?? "";
  switch (d.w) {
    case "lore.found":
      return `first came upon ${principleName(n || null, world)} in ${land}`;
    case "lore.found-again":
      return `found ${principleName(n || null, world)} again in ${land}, when it had been lost`;
    case "knowledge.metalworking":
      return `first worked metal in ${land}`;
    case "knowledge.cultivation":
      return `first sowed and reaped in ${land}`;
    case "knowledge.herding":
      return `first kept herds in ${land}`;
    case "act.inspire":
    case "act.inspire-one":
    case "person.act":
      return `was shown what ${land} had not known`;
    case "lore.material-found":
      return `first made ${n ? n.replace(/-/g, " ") : "a new stuff"} in ${land}`;
    case "design.works":
    case "design.house":
    case "design.host":
      return `first laid out ${n || "a new design"} in ${land}`;
    case "town.temple":
      return `raised the temple of ${n || land}`;
    case "industry.works":
      return `raised the first works of ${land}`;
    case "belief.founded":
      return `first spoke the faith of ${n || land}`;
    case "belief.schism":
      return `led ${n || "the faithful"} out of the faith they were of`;
    case "strife.coup":
      return `seized the seat of ${n || land}`;
    case "strife.revolution":
      return `led the rising that made ${n || land}`;
    case "polity.seceded":
      return `led ${land} out of the realm that held it`;
    case "war.rebellion":
      return `raised ${land} against ${n || "the realm that took it"}`;
    case "order.revolt":
      return `led the bound of ${land} in revolt`;
    case "houses.demagogue":
      return `rose on the people's anger in ${land}`;
    case "order.elected":
      // (A group's name may carry its own "the": it read "spoke for the the army".)
      return `spoke for ${/^the /i.test(n) ? n : `the ${n || "people"}`} of ${land} and won its people's choice`;
    case "order.law":
      return `wrote the changed law of ${n || land}`;
    case "society.written":
      return `set down in writing who holds what in ${n || land}`;
    case "credit.founded":
      return `founded ${n || "a house of lending"}`;
    case "trade.sea-route":
      return `first carried ${n || "goods"} over the sea from ${land}`;
    case "province.peopled":
      return `led the first to settle ${land}`;
    case "space.crew":
      return `first went beyond the sky from ${land}`;
    case "space.voyage":
      return `sailed from ${land} for another star`;
    case "space.colony":
      return `led those of ${land} who settled another world`;
    case "strife.foiled":
      return `plotted against the seat of ${n || land} and was found out`;
    case "held.crime":
      return `ordered the killing of those who had yielded at ${n || land}`;
    case "held.cast":
      return `was tried by their own and cast down for a killing of those of ${n || "another realm"}`;
    case "held.censured":
      return `was named by their faith for a killing of those of ${n || "another realm"}`;
    case "houses.grifter":
      return `bought a way into the great of ${land} by fraud`;
    default:
      return null;
  }
}

const bestOf = (all: readonly Deed[], not: readonly Deed[]): number =>
  all.reduce((m, d) => (not.includes(d) ? m : Math.max(m, d.g)), 0);

/** Who a notable is to their people, in words: from the greatest thing they did. */
export function notableTitle(
  world: World,
  n: Titled,
  realm?: string | null,
  /** Their land as its people call it (its first town's name), where the caller has it. */
  at?: string | null,
): string {
  const land = at || landWords(world, cellRef(0, n.home)),
    who = n.many ? "the line that" : "the one who",
    wars = n.deeds.filter((d) => d.d === DOMAIN.war),
    won = wars.filter((d) => d.w === "war.battle won"),
    lost = wars.filter((d) => d.w === "war.battle lost");
  // (One who leads a fleet: by its meetings at sea.)
  const seaWon = wars.filter((d) => d.w === "war.fleet won"),
    seaLost = wars.filter((d) => d.w === "war.fleet lost");
  if (
    n.post?.kind === "fleet" ||
    ((seaWon.length || seaLost.length) && !won.length && !lost.length)
  ) {
    const fleet = realm ? `the fleet of ${realm}` : "a fleet",
      top = [...seaWon].sort((a, b) => b.g - a.g || b.y - a.y)[0];
    if (top)
      return seaWon.length > 1
        ? `victor of ${seaWon.length} meetings of fleets at the head of ${fleet}`
        : `who beat the fleet of ${top.n ?? "a foe"} at sea at the head of ${fleet}`;
    if (seaLost.length)
      return `who led ${fleet} and was beaten at sea by the fleet of ${seaLost[seaLost.length - 1]!.n ?? "a foe"}`;
    return n.post?.kind === "fleet" ? `admiral of ${fleet}` : `once admiral of ${fleet}`;
  }
  // (One who leads a host: by their battles.)
  if (wars.length && wars.reduce((s, d) => s + Math.abs(d.g), 0) >= bestOf(n.deeds, wars)) {
    const host = realm ? `the host of ${realm}` : "a host",
      at = (d: Deed) => (d.n ? `the battle of ${d.n}` : "a battle"),
      top = [...won].sort((a, b) => b.g - a.g)[0];
    if (top)
      return won.length > 1
        ? `victor of ${won.length} battles at the head of ${host}, the greatest of them ${at(top)}`
        : `victor of ${at(top)} at the head of ${host}`;
    if (lost.length) return `who led ${host} and was beaten at ${at(lost[lost.length - 1]!)}`;
    return n.post?.kind === "command" ? `commander of ${host}` : `once commander of ${host}`;
  }
  const top = [...n.deeds].sort((a, b) => b.g - a.g || a.y - b.y)[0];
  if (!top) return `one known to the people of ${land}`;
  const told = did(world, top, land);
  if (told) return `${who} ${told}`;
  return `${STOOD[top.d]?.[n.many ? 1 : 0] ?? "one known past"} ${land}`;
}

/** One deed as a line of a life: "first came upon the potter's wheel in the Vale". */
export function deedLine(
  world: World,
  d: Deed,
  home: number,
  many: boolean,
  at?: string | null,
): string {
  const land = at || landWords(world, cellRef(0, home));
  if (d.w === "took command") return `took command of the host of ${d.n ?? "their realm"}`;
  if (d.w === "took the fleet") return `took the fleet of ${d.n ?? "their realm"} to sea`;
  if (d.w === "war.battle won") return `won ${d.n ? `the battle of ${d.n}` : "a battle"}`;
  if (d.w === "war.fleet won") return `beat the fleet of ${d.n ?? "a foe"} at sea`;
  if (d.w === "war.fleet lost") return `was beaten at sea by the fleet of ${d.n ?? "a foe"}`;
  if (d.w === "war.battle lost")
    return `was beaten at ${d.n ? `the battle of ${d.n}` : "a battle"}`;
  if (d.w === "stood out")
    return `came to be known as ${STOOD[d.d]?.[many ? 1 : 0] ?? "one known past"} ${land}`;
  return did(world, d, land) ?? `did a thing of ${DOMAINS[d.d] ?? "note"} in ${land}`;
}

/** How one of name ended, in words. */
export const NOTABLE_ENDS: Readonly<Record<string, string>> = {
  age: "died in the fullness of their years",
  ills: "died of the common ills of their time",
  battle: "fell in battle",
  taken: "was taken in battle and not seen again",
  sickness: "died of the sickness in their land",
  purge: "fell with the seat they served",
  struck: "was struck down by a hand no one saw",
  killed: "was killed",
};

type Told = {
  name?: string;
  domain?: string;
  what?: string;
  of?: string;
  how?: string;
  age?: number;
  many?: boolean;
  at?: string;
} | null;
const year = (t: number) => `year ${yearOfMoment(t)}`;
const toldDeed = (x: Told): Deed => ({
  y: 0,
  d: Math.max(0, (DOMAINS as readonly string[]).indexOf(x?.domain ?? "")),
  w: x?.what ?? "stood out",
  e: null,
  g: 1,
  ...(x?.of ? { n: x.of } : {}),
});
const cellAt = (place: string | null): number => (place ? Number(place.split(":")[2]) : 0);

registerEventWords(NOTABLE_EVENTS.arose.type, (world, e) => {
  const x = e.data as Told;
  return `${x?.name ?? "Someone"} of ${x?.at ?? landWords(world, e.place)} came to be known: ${notableTitle(world, { many: !!x?.many, home: cellAt(e.place), deeds: [toldDeed(x)] }, null, x?.at)}, ${year(e.t)}`;
});
registerEventWords(NOTABLE_EVENTS.died.type, (world, e) => {
  const x = e.data as Told,
    deed = toldDeed(x),
    title =
      deed.w === "war.battle won" || deed.w === "war.battle lost" || deed.w === "took command"
        ? "who led a host"
        : notableTitle(
            world,
            { many: !!x?.many, home: cellAt(e.place), deeds: [deed] },
            null,
            x?.at,
          );
  return `${x?.name ?? "One of name"}, ${title}, ${NOTABLE_ENDS[x?.how ?? ""] ?? "was gone"}${x?.age ? ` at ${x.age}` : ""}, ${year(e.t)}`;
});
registerDecisionWords(
  "notable.arose",
  (_, d) =>
    `Whether one of a land's people stood far enough past the rest of those who do the same to be known by name (${(d.outcome as { domain?: string } | null)?.domain ?? "a thing done"})`,
);
