// A realm's Houses tab (round H, sim/order/houses.ts): who its ruler must pay (its selectorate and winning coalition, the loyalty
// norm, how much of what the seat hands out goes as favours), its great houses by power and what each holds, what they take (the
// skim, the rents of licences and farms, offices held by kin and by titled houses), how its estates pass, the demagogue or grifter
// risen from outside, and how the holds of its houses ended. Phone first: a few facts, one set of bars, one table that fits.
import type { World } from "../../kernel/index.ts";
import type { Block, Item, Row, Stat } from "../../bridge/index.ts";
import { HOUSES } from "../../rules/index.ts";
import { housesOf, originOf, type HouseRecord, type Polity } from "../../sim/index.ts";
import { grainSum } from "../../causal/index.ts";
import { realmColor } from "../colors.ts";
import { count, item, link, many, part, share, stat } from "./words.ts";
import { landLink } from "./names.ts";

/** Whence a house rose, said short for its row. */
const FROM: Readonly<Record<string, string>> = {
  crown: "the ruler's family",
  "the court": "the court",
  "the army": "the army",
  "the temple": "the temple",
  traders: "the traders",
  crafters: "the crafters",
  farmers: "landholders",
  herders: "herd-holders",
  demagogue: "a demagogue",
  grifter: "a grifter",
  cadet: "a younger line",
};

/** How a hold ended, in words. */
const HOW: Readonly<Record<string, string>> = {
  purged: "purged by the crown",
  overthrown: "overthrown with the court",
  wed: "wed into",
  "died out": "died out, no heir left",
  faded: "faded from the great",
  exposed: "its grift found out",
};

const grain = (n: number) => `${grainSum(Math.max(0, Math.round(n)))} grain's worth`,
  th = (n: number) => share(n / 1000);

/** A house's name as its row and its bars say it. */
function houseLine(h: HouseRecord, v: readonly HouseRecord[]): string {
  const of = h.of !== undefined ? v.find((x) => x.id === h.of) : undefined;
  return `${h.name}${originOf(h) === "cadet" ? (of ? " (younger)" : " (a younger line)") : ""}${h.crown ? " 👑" : ""}`;
}

/** A realm's Houses tab: none where nothing is reckoned yet. */
export function realmHousesBlocks(world: World, r: Polity): Block[] {
  const v = housesOf(world)?.of(r.ref);
  if (!v) return [];
  const blocks: Block[] = [];
  // Who its ruler must pay.
  const rows: Stat[] = [
    stat("Those with a say in who rules", many(v.selectorate, "person", "people"), {
      parts: [part("of its working people", share(v.all > 0 ? v.selectorate / v.all : 0))],
    }),
    stat("The fewest whose backing is enough", many(v.winning, "person", "people"), {
      parts: [
        part("of those with a say", share(v.selectorate > 0 ? v.winning / v.selectorate : 0)),
        ...v.members.map(([g, x]) => part(`of ${g}`, th(x))),
      ],
    }),
    stat(
      "Loyalty to the seat",
      `${th(v.loyalty)}: one of them left out by a rival would be left with nothing`,
    ),
    stat(
      "What the seat hands out as favours",
      `${th(v.favours)}, the rest on what all share (roads, order, relief)`,
    ),
  ];
  blocks.push({ type: "facts", title: "Who its ruler must pay", rows });
  // Its great houses, by power.
  const houses = [...v.houses].sort((a, b) => b.power - a.power || a.id - b.id);
  if (houses.length) {
    blocks.push({
      type: "bars",
      title: "Its great houses, by power",
      bars: houses.map((h) => ({
        label: [link(houseLine(h, v.houses), h.event)],
        ref: h.event,
        value: h.power / 1000,
        ...(h.crown ? { color: realmColor(r.ref) } : {}),
      })),
      unit: "share",
      wrap: true,
    });
    const table: Row[] = houses.map((h) => ({
      ref: h.event,
      cells: [
        [link(houseLine(h, v.houses), h.event)],
        [FROM[originOf(h)] ?? originOf(h)],
        [grainSum(h.wealth)],
        [th(h.offices)],
        [h.grants || h.farm ? `${th(h.grants)} · ${th(h.farm)}` : "none"],
        [`${h.since}`],
      ],
      keys: [h.name, h.origin, h.wealth, h.offices, h.grants + h.farm, h.since],
    }));
    blocks.push({
      type: "table",
      title: "What each holds",
      columns: ["House", "Risen from", "Wealth", "Offices", "Licences · customs", "Since"],
      rows: table,
      few: HOUSES.most,
      fit: true,
    });
    const crown = houses.find((h) => h.crown);
    blocks.push({
      type: "facts",
      title: "Their lines",
      rows: houses.map((h) =>
        stat(
          houseLine(h, v.houses),
          [
            `${h.titled ? "titled, " : ""}generation ${h.generation}${h.heirs ? `, ${many(h.heirs, "heir", "heirs")} at the last death` : ""}, seated in `,
            landLink(world, h.seat),
          ],
          {
            why: h.event,
            parts: [
              part("takes in a year", grain(h.income)),
              ...(h.land ? [part("of its land's rent", th(h.land))] : []),
              ...(crown && h !== crown
                ? [part("its power beside the crown's", share(h.power / Math.max(1, crown.power)))]
                : []),
            ],
          },
        ),
      ),
    });
  }
  // What they take, and what it does.
  const take: Stat[] = [
    stat("Skimmed between its lands and its seat", `${grain(v.skim)} a year`),
    stat("Rents of the licences and customs it grants", `${grain(v.rents)} a year`, {
      parts: [part("of what its people earn", th(v.burden))],
    }),
    stat("Offices held by the houses' kin", th(v.nepotism), {
      parts: [part("by titled houses, theirs by birth", th(v.hereditary))],
    }),
    stat(
      "How an estate passes",
      v.parted >= 500
        ? `parted among the heirs (${th(v.parted)} shared out)`
        : `kept whole for one heir (${th(1000 - v.parted)} kept)`,
    ),
    ...(v.rival > 0
      ? [stat("A house that outweighs the crown", `${th(v.rival)}: a coup could ride it`)]
      : []),
    ...(v.following >= 20
      ? [stat("A demagogue's following", `${th(v.following)} of its people`)]
      : []),
    ...(v.grift >= 20 ? [stat("A grifter's cut of what is skimmed", th(v.grift))] : []),
  ];
  blocks.push({ type: "facts", title: "What they take", rows: take });
  // How their holds ended.
  if (v.gone.length) {
    const items: Item[] = [...v.gone]
      .reverse()
      .map((g) =>
        item(
          [
            `Year ${g.year}: `,
            link(`the house of ${g.name}`, g.event),
            ` (${FROM[HOUSE_ORIGIN(g.origin)] ?? "the court"}, since ${g.since}), ${HOW[g.how] ?? g.how}${g.into ? ` the house of ${g.into}` : ""}`,
          ],
          g.event,
          g.year,
        ),
      );
    blocks.push({ type: "list", title: "How their holds ended", items });
  }
  if (!houses.length)
    blocks.push({
      type: "text",
      lines: [
        [
          `No great house holds power in it now: ${count(v.selectorate)} have a say, and favours do not gather in few hands.`,
        ],
      ],
    });
  return blocks;
}

const HOUSE_ORIGIN = (o: number): string => originOf({ origin: o });
