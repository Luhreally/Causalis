// A town's water, drains and power as networks, on its page (the audit's "infrastructure as networks", page side): where each
// comes from, what carries it, whom it reaches and where it falls short. It reads, it never touches: its buildings as the town's
// fabric keeps them, what its land knows, the share of its land's townspeople whose water is drained and kept clean
// (sim/society/care.ts), and what drives its land's work (sim/economy/energy.ts). Nothing is kept and nothing is drawn in the
// town: a number a land and the buildings standing, told as the network they make. A people of the water has no wells and no
// drains to dig: its water is the sea about it, said as that.
import type { Ref, World } from "../../kernel/index.ts";
import type { Block, Stat } from "../../bridge/index.ts";
import { CARRIERS, CARRIER_WORDS, SOURCE_WORDS } from "../../rules/index.ts";
import {
  CARE_ROW,
  CARE_STORE,
  energyPerHead,
  loreOf,
  populationContext,
  societyStore,
  townsOf,
} from "../../sim/index.ts";
import { count, share, stat } from "./words.ts";

const WIRED = [
  "electricity",
  "sea-electricity",
  "graphite-dynamos",
  "ground-dynamos",
  "polymer-wire",
];

/** A town's networks: its water, its drains, its power (null: an empty town). */
export function townNetworksBlocks(
  world: World,
  town: { readonly ref: string; readonly cell: number; readonly population: number },
): Block[] {
  if (town.population <= 0) return [];
  const ctx = populationContext(world),
    lore = loreOf(world),
    known = (id: string) => lore.get(town.cell, id),
    fabric = townsOf(world).get(town.ref as Ref),
    standing = new Map<string, number>();
  for (const c of fabric?.civics ?? [])
    if (c.fell === null) standing.set(c.kind as string, (standing.get(c.kind as string) ?? 0) + 1);
  const has = (kind: string) => standing.get(kind) ?? 0,
    water = ctx.medium === "water",
    care = societyStore(world, CARE_STORE)?.get(town.cell),
    drained = (care?.[CARE_ROW.drained] ?? 0) / 1000,
    sanitation = known("sanitation"),
    aqueducts = known("aqueducts"),
    energy = energyPerHead(world, town.cell);

  // Water: where it comes from, what brings it, whom it reaches.
  const waterRows: Stat[] = water
    ? [stat("Comes from", "the sea they live in: no one fetches it")]
    : [
        stat(
          "Comes from",
          has("well")
            ? `${count(has("well"))} ${has("well") === 1 ? "well" : "wells"} dug in the town${aqueducts ? ", and water led in from higher ground" : ""}`
            : aqueducts
              ? "water led in from higher ground"
              : "the nearest stream, spring or pool, fetched by hand",
          aqueducts ? { why: aqueducts.event } : {},
        ),
        stat(
          "Carried by",
          sanitation
            ? "pipes under its streets"
            : aqueducts
              ? "channels to its fountains, then by hand"
              : "those who fetch it",
          sanitation ? { why: sanitation.event } : {},
        ),
        ...(has("baths")
          ? [stat("Its baths", `${count(has("baths"))}, fed by the same water`)]
          : []),
      ];

  // Drains: what becomes of what is thrown out.
  const drainRows: Stat[] = water
    ? [stat("Drains", "none to dig: the water about them carries off what they cast out")]
    : sanitation
      ? [
          stat("Its waste goes", "into drains under its streets, away from its water", {
            why: sanitation.event,
          }),
          stat("Of this land's townspeople, drained and clean-watered", share(drained), {
            parts: [
              {
                label: ["those of its land who live in its towns, once it knows how"],
                value: share(drained),
              },
            ],
          }),
        ]
      : [
          stat("Its waste goes", "into its streets and ditches, and so into its water"),
          stat(
            "What that costs",
            "its crowds breed sickness the more: no one here knows better yet",
          ),
        ];

  // Power: what drives its work, what carries it, how far it meets what is wanted.
  const powerRows: Stat[] = [];
  if (energy) {
    const wired = WIRED.map(known).find((k) => k),
      top = CARRIERS.map((c) => ({ c, kw: energy.carriers[c] }))
        .filter((x) => x.kw > 0)
        .sort((a, b) => b.kw - a.kw)
        .slice(0, 3);
    powerRows.push(
      stat("Its work is driven by", SOURCE_WORDS[energy.drives]),
      stat(
        "It draws on",
        top.map((x) => `${CARRIER_WORDS[x.c].icon} ${CARRIER_WORDS[x.c].name}`).join(", ") ||
          "its people's own strength",
      ),
      stat(
        "Carried by",
        wired
          ? has("power") || has("fusion")
            ? "wires from its power house to its works and homes"
            : "wires, from wherever its land makes its power"
          : energy.drives === "none"
            ? "backs and beasts: each does their own work"
            : "shafts and belts: its works stand where the power is",
        wired ? { why: wired.event } : {},
      ),
      stat("Of the work wanted, had", share(energy.workCover)),
      stat("Of the heat wanted, had", share(energy.heatCover)),
      stat(
        "A head",
        `${energy.power >= 10 ? Math.round(energy.power) : energy.power.toFixed(2)} kW`,
      ),
    );
    if (has("power") || has("fusion"))
      powerRows.push(
        stat(
          "Its power houses",
          `${count(has("power") + has("fusion"))}${has("fusion") ? ", a held flame among them" : ""}`,
        ),
      );
  }
  return [
    { type: "facts", title: "Its water", rows: waterRows },
    { type: "facts", title: "Its drains", rows: drainRows },
    ...(powerRows.length ? [{ type: "facts" as const, title: "Its power", rows: powerRows }] : []),
    {
      type: "text",
      lines: [
        [
          "Read off what its land knows, the buildings standing in it and its land's own numbers: the water and the drains are a share of its land's townspeople, the power its land's a head. Its pipes and wires are not laid lot by lot.",
        ],
      ],
    },
  ];
}
