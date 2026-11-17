// Materials on the pages (Materials round): what a land makes and could come to next, with what shuts the rest; a stuff's
// figures as it is worked, read from its atoms (rules/materials.ts), and what this world's warmth and air do to it; an
// element's atom. Every figure is the rule's own reading, never reckoned anew here; what a land has made is its store's
// (sim/lore/materials.ts). What a stuff is and does, never how a weapon is made of it.
import {
  ATOMS,
  MATERIAL_WAYS,
  PACKING,
  bandGapOf,
  metalFigures,
  oxideRatio,
  purityNeeded,
  atomsPerM3,
  rustRate,
  stiffnessOf,
  findSubstance,
  liningOn,
  OXIDE_LINES,
  REDUCERS,
  SLAG_C,
  reductionC,
  smeltHeat,
  smeltOf,
  type Reaction,
  type Reducer,
  type Worked,
} from "../../rules/index.ts";
import { meansNumbers, worldChemistry } from "../../gen/index.ts";
import {
  crystalNeed,
  homePlanet,
  compassReach,
  concreteBuilt,
  frameStuffOf,
  makingHeat,
  materialsOf,
  populationContext,
  waysAt,
} from "../../sim/index.ts";
import type { World } from "../../kernel/index.ts";
import type { Block, Item, Stat } from "../../bridge/index.ts";
import { count, item, link, part, stat, yearNow } from "./words.ts";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const substRef = (id: string) => `subst:${id}`;

/** This world's warmth (K), its air's free oxygen (its share) and whether its seas are water. */
function airOf(world: World): {
  readonly kelvin: number;
  readonly o2: number;
  readonly wet: boolean;
} {
  const g = homePlanet(world).generated,
    n = meansNumbers(g);
  return {
    kelvin: g.planet.meanTemperature + 273.15,
    o2: n.freeOxygen ? worldChemistry(g).o2 : 0,
    wet: n.seaIsWater,
  };
}

const rustWords = (um: number) =>
  um <= 0
    ? "never, under this world's air"
    : um < 1
      ? `${Math.round(um * 100) / 100} µm a year: its oxide closes over it`
      : `${Math.round(um)} µm a year`;

/** A land's making on its page: what it makes, what it could come to next, what shuts the rest, how pure it refines. */
export function landMakingBlocks(world: World, cell: number): Block[] {
  const store = materialsOf(world);
  if (!store) return [];
  const ctx = populationContext(world),
    row = store.get(cell);
  if (!row && !(ctx.provinces.get(cell)?.total() ?? 0)) return [];
  const { open, shut } = waysAt(ctx, cell),
    need = crystalNeed(ctx),
    made: Item[] = MATERIAL_WAYS.flatMap((w, i) =>
      row && row.made & (1 << i)
        ? [item(`${cap(w.name)}: ${w.words}`, row.event ?? null, row.years[i] || undefined)]
        : [],
    );
  if (!made.length && !open.length && !row) return [];
  const rows: Stat[] = [
    stat("Its hottest fire", `${count(Math.round(makingHeat(ctx, cell)))} °C`),
    stat("Ways it makes stuffs", `${made.length} of ${MATERIAL_WAYS.length}`),
    stat("It refines to", row ? `${(row.purity / 100).toFixed(1)} nines` : "nothing yet", {
      parts: [part("of a thousand million atoms, nine nines is one foreign", "")],
    }),
    ...(need
      ? [
          stat("A switch here wants", [
            `${need.nines.toFixed(1)} nines of `,
            link(findSubstance(need.subst)?.name ?? need.subst, substRef(need.subst)),
            ` (gap ${need.gap} eV)`,
          ]),
        ]
      : []),
  ];
  const blocks: Block[] = [{ type: "facts", title: "Making", rows }];
  // (What its made stuffs do elsewhere: its furnaces' walls, its towns in a quake, its ships, its flyers.)
  const g = homePlanet(world).generated,
    lining = liningOn(worldChemistry(g)),
    year = yearNow(world),
    framed = concreteBuilt(world, cell, year),
    frame = frameStuffOf(world, cell),
    doing: Stat[] = [
      stat("Its furnaces' walls", `${lining.name}, holding ${count(lining.holdsC)} °C`, {
        parts: [part("the best refractory its rocks give, softening a little below its melt", "")],
      }),
      ...(framed > 0
        ? [
            stat(
              "Built in reinforced concrete",
              `${Math.round(100 * framed)}%, standing in a quake`,
            ),
          ]
        : []),
      ...(compassReach(world, cell) > 1
        ? [
            stat(
              "Its ships",
              "carry half again as far, the needle finding north out of sight of land",
            ),
          ]
        : []),
      ...(frame
        ? [
            stat(
              "Its flyers and rockets",
              `framed in ${frame === "glass-fibre" ? "glass fibre" : "light alloy"}, lighter, carrying more`,
            ),
          ]
        : []),
    ];
  blocks.push({ type: "facts", title: "What its stuffs do", rows: doing });
  if (made.length) blocks.push({ type: "list", title: "What it makes", items: made });
  if (open.length)
    blocks.push({
      type: "list",
      title: "What it could come to next",
      items: open.map(([w, heat]) =>
        item(`${cap(w.name)}: ${w.words}${heat > 0 ? ` (wants ${count(heat)} °C)` : ""}`),
      ),
    });
  if (shut.length)
    blocks.push({
      type: "list",
      title: "Not yet",
      items: shut.slice(0, 5).map(([w, why]) => item(`${cap(w.name)}: ${why}`)),
      ...(shut.length > 5 ? { more: shut.length - 5 } : {}),
    });
  return blocks;
}

const WORKINGS: readonly (readonly [Worked, string])[] = [
  ["cast", "As cast"],
  ["annealed", "Softened"],
  ["hammered", "Hammered cold"],
  ["forged", "Forged"],
  ["quenched", "Quenched"],
  ["tempered", "Tempered"],
];

/** A stuff's figures as a material: a metal by how it is worked, and on this world; a diamond-like crystal's gap and the purity a switch of it wants here. */
export function materialTab(world: World, id: string): Block[] {
  const s = findSubstance(id);
  if (!s) return [];
  const here = airOf(world),
    blocks: Block[] = [],
    base = metalFigures(s.formula, "annealed", 288);
  if (base) {
    const iron = base.carbonWt > 0 || s.formula.Fe !== undefined;
    blocks.push({
      type: "table",
      title: "As it is worked (at 15 °C, read from its atoms)",
      columns: ["Worked", "Hardness (HV)", "Strength (MPa)", "Toughness (MPa√m)"],
      fit: true,
      rows: WORKINGS.filter(([w]) => iron || (w !== "quenched" && w !== "tempered")).map(
        ([w, name]) => {
          const f = metalFigures(s.formula, w, 288)!;
          return {
            cells: [
              [name],
              [count(f.hv)],
              [count(f.strength)],
              [`${f.toughness}${f.brittle ? ", brittle" : ""}`],
            ],
          };
        },
      ),
    });
    const onWorld = metalFigures(s.formula, "annealed", here.kelvin)!,
      host = Object.entries(s.formula).sort((a, b) => b[1] - a[1])[0]![0],
      rows: Stat[] = [
        stat("Weight", `${count(base.density)} kg/m³`, {
          parts: [part("its atoms' mass over the room their packing takes", "")],
        }),
        stat("Melts near", `${count(base.meltC)} °C`),
        stat("Stiffness", `${count(base.stiffness)} GPa`, {
          parts: [part("the bond energy held in each atom's room", "")],
        }),
        stat("Carries current", `${base.conductivity} MS/m at 15 °C`),
        ...(base.brittleC !== null ? [stat("Brittle below", `${count(base.brittleC)} °C`)] : []),
        stat(
          `Here, at ${Math.round(here.kelvin - 273.15)} °C`,
          `${count(onWorld.strength)} MPa${onWorld.brittle ? ": brittle, it breaks before it bends" : ""}`,
        ),
        stat("Rusts", rustWords(rustRate(host, here.o2, here.wet))),
        ...(base.moment > 0 ? [stat("A magnet", `${base.moment} Bohr magnetons an atom`)] : []),
      ];
    blocks.push({ type: "facts", title: "What it is as a metal", rows });
  }
  const gap = bandGapOf(s.formula);
  if (gap !== null)
    blocks.push({
      type: "facts",
      title: "As a crystal that switches",
      rows: [
        stat("Band gap, from its bond", `${gap} eV`, {
          parts: [
            part(
              "diamond's gap at its bond, falling with the bond's length, widened by the pull between its two atoms",
              "",
            ),
          ],
        }),
        stat(
          `A switch of it here wants`,
          `${purityNeeded(gap, Math.max(20, here.kelvin), atomsPerM3(id)).toFixed(1)} nines`,
        ),
      ],
    });
  return blocks;
}

const LATTICE_WORDS: Readonly<Record<string, string>> = {
  fcc: "close-packed in faces",
  bcc: "packed about a centre",
  hcp: "close-packed in layers",
  tetragonal: "packed in stretched cubes",
  diamond: "each atom bound to four",
  other: "in a lattice of its own",
  molecular: "as molecules",
};

/** An element's atom on its page, and what it is as a material pure on this world. */
export function atomBlocks(world: World, symbol: string): Block[] {
  const a = ATOMS[symbol];
  if (!a) return [];
  const here = airOf(world),
    rows: Stat[] = [
      stat("Its charge", `${a.z}`),
      stat("Its pull on electrons", `${a.chi} (Pauling)`),
      stat("Its size", `${a.r} pm`),
      stat("How fast it holds its neighbours", `${a.ecoh} eV an atom`),
      stat("Pure, it packs", LATTICE_WORDS[a.lattice] ?? a.lattice, {
        parts: [part(`${Math.round(PACKING[a.lattice] * 100)}% of its room filled`, "")],
      }),
    ];
  const blocks: Block[] = [{ type: "facts", title: "Its atom", rows }];
  if (a.metal) {
    const f = metalFigures({ [symbol]: 1 }, "annealed", here.kelvin)!,
      pb = oxideRatio(a);
    blocks.push({
      type: "facts",
      title: `Pure, at this world's ${Math.round(here.kelvin - 273.15)} °C`,
      rows: [
        stat("Weight", `${count(f.density)} kg/m³`),
        stat("Stiffness", `${count(Math.round(stiffnessOf(a)))} GPa`),
        stat("Strength", `${count(f.strength)} MPa${f.brittle ? ", brittle" : ""}`),
        stat("Carries current", `${f.conductivity} MS/m`),
        ...(pb !== null
          ? [
              stat(
                "Its oxide",
                pb < 1
                  ? "torn open: the air reaches it"
                  : pb <= 2
                    ? "closes over it"
                    : "swells and flakes away",
                {
                  parts: [part(`${pb.toFixed(2)} times the room of the metal it took`, "")],
                },
              ),
              stat("Rusts", rustWords(rustRate(symbol, here.o2, here.wet))),
            ]
          : []),
        ...(f.moment > 0 ? [stat("A magnet", `${f.moment} Bohr magnetons an atom`)] : []),
      ],
    });
  }
  return blocks;
}

/** A smelt's heat on its reaction's page, read off Ellingham's lines: where each reducer takes its metal's oxygen, and what must run. */
export function smeltBlocks(r: Reaction): Block[] {
  const s = smeltOf(r),
    ox = s ? OXIDE_LINES[s.metal] : undefined,
    heat = smeltHeat(r);
  if (!s || !ox || heat === null) return [];
  const metal =
      findSubstance(r.outputs.find(([id]) => findSubstance(id)?.formula[s.metal])?.[0] ?? "")
        ?.name ?? s.metal,
    meltC = Math.round(ATOMS[s.metal]!.meltK - 273.15),
    rows: Stat[] = s.self
      ? [stat("Its oxygen", "its ore's own sulphur burns, and takes none from a fire")]
      : (Object.keys(REDUCERS) as Reducer[]).map((by) => {
          const t = reductionC(s.metal, by);
          return stat(
            `${REDUCERS[by].words[0]!.toUpperCase()}${REDUCERS[by].words.slice(1)} takes it`,
            t === null ? "never, at any heat" : t === 0 ? "at any heat" : `from ${count(t)} °C`,
            {
              parts: [
                part(
                  `the free energy of ${ox.oxide} against the reducer's own, with some to spare`,
                  "",
                ),
              ],
            },
          );
        });
  rows.push(
    stat(
      `The ${metal} gathered`,
      meltC < SLAG_C
        ? `runs at its melt, ${count(meltC)} °C`
        : `freed from a running slag, ${count(SLAG_C)} °C`,
    ),
  );
  if (s.slag)
    rows.push(stat("A slag must run", `of the ore's iron and silica, at ${count(SLAG_C)} °C`));
  rows.push(stat("So it wants", `${count(heat)} °C`));
  return [{ type: "facts", title: "Why so hot (read off the oxide's free energy)", rows }];
}
