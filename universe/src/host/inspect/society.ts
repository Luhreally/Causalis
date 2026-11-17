// The society sweep on the pages (sim/society): a land's Lives tab (its care of its sick and its old, who does what, what its holders
// have put into its land, what it eats and how it keeps it, what it wears, how it rests and plays) and a realm's Laws tab (how far its
// law is written, how safe a holding is from its ruler, how far deals are held to, what it pays its old and for its poor's care).
// Every number is a store's, read, never reckoned anew. Phone first: facts blocks, a breakdown one tap down.
import type { World } from "../../kernel/index.ts";
import type { Block, Stat } from "../../bridge/index.ts";
import {
  GAME_WORDS,
  KEEPING_MEANS,
  gamesIn,
  tableWords,
  type KeepingMean,
} from "../../rules/index.ts";
import {
  CARE_ROW,
  CARE_STORE,
  DRESS_ROW,
  DRESS_STORE,
  HOLDINGS,
  HOLDINGS_STORE,
  LAW_ROW,
  LAW_STORE,
  LEISURE_ROW,
  LEISURE_STORE,
  OLD_ROW,
  OLD_STORE,
  PROVISION,
  PROVISION_STORE,
  ROLE_ROW,
  ROLES_STORE,
  TABLE,
  TABLE_STORE,
  populationContext,
  societyStore,
  type Polity,
} from "../../sim/index.ts";
import { count, part, stat } from "./words.ts";

const pc = (x: number) => `${Math.round(x * 100)}%`,
  per = (thousandths: number) => pc(thousandths / 1000),
  one = (x: number) => (Math.round(x * 10) / 10).toFixed(1),
  grain = (n: number) => `${count(Math.round(n))} grain's worth a year`;

/** The words for each means of keeping food. */
const KEEPING_WORDS: Readonly<Record<KeepingMean, string>> = {
  drying: "dried in warm dry air",
  frost: "laid by in the winter's frost",
  salt: "salted from the sea",
  smoke: "smoked over its woods' fires",
  ferment: "brewed and fermented",
  spice: "cooked with what grows hot about it",
};

/** A land's Lives tab: its care, its old, its roles, its holdings, its table, its dress, its rest (none where nothing is kept). */
export function landLivesBlocks(world: World, cell: number): Block[] {
  const blocks: Block[] = [];
  const care = societyStore(world, CARE_STORE)?.get(cell);
  if (care)
    blocks.push({
      type: "facts",
      title: "Care of the sick",
      rows: [
        stat("Spent on the sick", `${pc(care[CARE_ROW.spend]! / 10_000)} of what households have`),
        stat("Healers", `${one(care[CARE_ROW.healers]! / 10)} in a thousand of its people`),
        stat("Within reach of a healer", per(care[CARE_ROW.reach]!)),
        stat("Tended by one when sick", per(care[CARE_ROW.access]!), {
          parts: [
            part("the temple's alms pay for", per(care[CARE_ROW.alms]!)),
            part("its realm pays for", per(care[CARE_ROW.publicCare]!)),
            part("kin tend the rest, at", "a third of a healer's tending"),
          ],
        }),
        stat("Living near a hospital", per(care[CARE_ROW.hospitals]!)),
        stat("What it knows of healing would spare", `${per(care[CARE_ROW.known]!)} of its deaths`),
        stat("Deaths its care spares", per(care[CARE_ROW.spared]!)),
        ...(care[CARE_ROW.drained]! > 0
          ? [stat("Of its people, drained and clean-watered", per(care[CARE_ROW.drained]!))]
          : []),
      ],
    });
  const old = societyStore(world, OLD_STORE)?.get(cell);
  if (old) {
    const life = populationContext(world).life,
      from = life.bands[old[OLD_ROW.band]!] ?? 0;
    blocks.push({
      type: "facts",
      title: "The old",
      rows: [
        stat("Frail (from the age of " + from + ")", `${per(old[OLD_ROW.share]!)} of its people`),
        stat("Grown for each frail one", one(old[OLD_ROW.support]! / 10)),
        stat("Kept in their age", per(1000 - old[OLD_ROW.neglected]!), {
          parts: [
            part("by their kin", per(old[OLD_ROW.kin]!)),
            part("by the temple's alms", per(old[OLD_ROW.temple]!)),
            part("by what they put by", per(old[OLD_ROW.savings]!)),
            part("by a pension", per(old[OLD_ROW.pension]!)),
          ],
        }),
        stat("No one keeps", per(old[OLD_ROW.neglected]!)),
        stat("The frail die", `${one(old[OLD_ROW.press]! / 1000)} times as often as kept`),
        stat("Kept by other than their children", per(old[OLD_ROW.security]!)),
        stat("Children more a mother wants for her age", one(old[OLD_ROW.want]! / 1000)),
      ],
    });
  }
  const roles = societyStore(world, ROLES_STORE)?.get(cell);
  if (roles)
    blocks.push({
      type: "facts",
      title: "Who does what",
      rows: [
        stat("How far the sexes' bodies differ", per(roles[ROLE_ROW.dimorphism]!)),
        stat("A mother's bearing years her young hold", per(roles[ROLE_ROW.held]!)),
        stat("What its fields ask of strength", per(roles[ROLE_ROW.strength]!)),
        stat("A bearer's work beyond the home", `${per(roles[ROLE_ROW.norm]!)} of another's`, {
          parts: [part("what its work would have of her now", per(roles[ROLE_ROW.target]!))],
        }),
        stat("What a child costs its mother's work", one(roles[ROLE_ROW.forgone]! / 1000)),
        stat("Bearers among those who rule", per(roles[ROLE_ROW.rule]!)),
      ],
    });
  const held = societyStore(world, HOLDINGS_STORE)?.get(cell);
  if (held)
    blocks.push({
      type: "facts",
      title: "What is held",
      rows: [
        stat(
          "Its fields yield more for what its holders put into them",
          pc(held[HOLDINGS.improved]! / 10_000),
          {
            parts: [part("worth putting in, as things stand", pc(held[HOLDINGS.target]! / 10_000))],
          },
        ),
        stat("How safe a holding is", pc(held[HOLDINGS.secure]! / 10_000)),
        stat("What a tiller keeps of what he puts in", pc(held[HOLDINGS.tenure]! / 10_000)),
        stat("Deals held to", per(held[HOLDINGS.deals]!)),
      ],
    });
  const table = societyStore(world, TABLE_STORE)?.get(cell);
  if (table) {
    const means = Object.fromEntries(
        KEEPING_MEANS.map((k, i) => [k, table[TABLE.means + i]! / 1000]),
      ) as Record<KeepingMean, number>,
      kept = KEEPING_MEANS.filter((k) => means[k] >= 0.3);
    const words = tableWords(
      {
        grain: table[TABLE.grain]! / 1000,
        meat: table[TABLE.meat]! / 1000,
        wild: table[TABLE.wild]! / 1000,
      },
      means,
      populationContext(world).medium === "water",
    );
    blocks.push({
      type: "facts",
      title: "The table",
      rows: [
        stat("They eat", words.join("; ") || "what they can"),
        stat(
          "Of their food",
          `grain ${per(table[TABLE.grain]!)}, flesh and milk ${per(table[TABLE.meat]!)}, the wild's ${per(table[TABLE.wild]!)}`,
        ),
        stat(
          "Kept",
          kept.map((k) => KEEPING_WORDS[k]).join(", ") || "as it comes, and soon eaten",
          {
            parts: KEEPING_MEANS.map((k) => part(KEEPING_WORDS[k], pc(means[k]))),
          },
        ),
        stat("Spoiling its own means spare", per(table[TABLE.kept]!)),
      ],
    });
  }
  const dress = societyStore(world, DRESS_STORE)?.get(cell);
  if (dress) {
    const stuff = [
      ["wool", dress[DRESS_ROW.wool]!],
      ["hides", dress[DRESS_ROW.hides]!],
      ["woven fibre", dress[DRESS_ROW.fibre]!],
    ] as const;
    blocks.push({
      type: "facts",
      title: "Dress",
      rows: [
        stat("Warmth they need of clothes", per(dress[DRESS_ROW.need]!)),
        stat("What their own coat leaves to clothes", per(dress[DRESS_ROW.coat]!)),
        stat(
          "Made of",
          stuff
            .filter(([, x]) => x >= 100)
            .map(([w, x]) => `${w} (${per(x)})`)
            .join(", ") || "what comes to hand",
        ),
        stat("How far clothes show who one is", per(dress[DRESS_ROW.display]!)),
        stat("Clothes wanted", `${per(dress[DRESS_ROW.wanted]!)} of the old measure`),
        ...(dress[DRESS_ROW.dyed]! ? [stat("Dyed", "in colours its dyers make")] : []),
      ],
    });
  }
  const rest = societyStore(world, LEISURE_STORE)?.get(cell);
  if (rest) {
    const games = gamesIn(rest[LEISURE_ROW.games]!).map((g) => GAME_WORDS[g]);
    blocks.push({
      type: "facts",
      title: "Rest and feasts",
      rows: [
        stat("A working day", `${one(rest[LEISURE_ROW.hours]! / 10)} hours`),
        stat("Their bread costs", `${per(rest[LEISURE_ROW.need]!)} of what their work earns`),
        stat("Holy days a year", count(rest[LEISURE_ROW.holy]!)),
        stat("Feast days a year", count(rest[LEISURE_ROW.feasts]!)),
        stat("They play", games.join(", ") || "little"),
        stat("Grievance their feasts ease a year", pc(rest[LEISURE_ROW.relief]! / 10_000)),
      ],
    });
  }
  return blocks;
}

/** A realm's Laws tab: its law and what it provides (none where nothing is kept). */
export function realmLawBlocks(world: World, r: Polity): Block[] {
  const blocks: Block[] = [];
  const law = societyStore(world, LAW_STORE)?.get(r.ref);
  if (law) {
    const names = [
      "ruled by force, its people unheard",
      "its officers bought",
      "its law written, which binds the ruler too",
      "its treasury short",
    ];
    const rows: Stat[] = [
      stat("Its law written", per(law[LAW_ROW.written]!)),
      stat("Its ruler takes what is held", `${per(law[LAW_ROW.risk]!)} likely`, {
        parts: names.map((n, i) => part(n, pc(law[LAW_ROW.parts + i]! / 1000))),
      }),
      stat("A holding safe", per(law[LAW_ROW.secure]!)),
      stat("Deals held to", per(law[LAW_ROW.deals]!), {
        parts: [
          part("by its courts", per(law[LAW_ROW.byCourts]!)),
          part("among kin and those who know each other", per(law[LAW_ROW.byKin]!)),
        ],
      }),
      stat("Its courts judge", `${per(law[LAW_ROW.courts]!)} of its disputes`),
      stat("A tiller keeps of what he puts into his land", per(law[LAW_ROW.tenure]!)),
    ];
    blocks.push({ type: "facts", title: "Its law", rows });
  }
  const pro = societyStore(world, PROVISION_STORE)?.get(r.ref);
  if (pro)
    blocks.push({
      type: "facts",
      title: "What it provides",
      rows: [
        stat("Its frail", `${per(pro[PROVISION.old]!)} of its people`),
        stat("Its old paid a pension", per(pro[PROVISION.pension]!)),
        stat("Pensions cost it", grain(pro[PROVISION.pensionCost]!)),
        stat("Its people no healer tends", per(pro[PROVISION.untended]!)),
        stat("Of their care it pays for", per(pro[PROVISION.publicCare]!)),
        stat("Their care costs it", grain(pro[PROVISION.careCost]!)),
        stat(
          "Keeps a roll of who is owed",
          pro[PROVISION.roll]
            ? "yes: it writes and keeps clerks"
            : "no: it lacks writing or clerks",
        ),
      ],
    });
  return blocks;
}
