// A land's energy on its page (Round A: energy as one budget): what it drew last year, carrier by carrier, a head; what drove
// its works and how much of what they wanted they had; its engines against Carnot's bound at what its stuffs bear; what it
// burned and felled, and what that sent up. Every number is its account's (sim/economy/energy.ts), read, never reckoned anew.
import {
  CARRIERS,
  CARRIER_WORDS,
  SOURCES,
  SOURCE_WORDS,
  carnot,
  craftShare,
  heldHeat,
  type Carrier,
  type Source,
} from "../../rules/index.ts";
import { energyBooks, energyPerHead, fumeOf } from "../../sim/index.ts";
import type { World } from "../../kernel/index.ts";
import type { Block, Stat } from "../../bridge/index.ts";
import { stat } from "./words.ts";

/** Kilowatts in words: watts under one, a kilowatt to two figures under ten. */
export function kwWords(kw: number): string {
  if (kw <= 0) return "none";
  if (kw < 1) return `${Math.max(1, Math.round(kw * 1000))} W`;
  if (kw < 10) return `${kw.toFixed(1)} kW`;
  return `${Math.round(kw).toLocaleString("en-US")} kW`;
}
const pc = (x: number) => `${Math.round(x * 100)}%`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A land under the energy lens, for the tooltip under the pointer: all it draws a head, the most of it, what drives its works. */
export function energyReading(
  world: World,
  cell: number,
): { line: string; stats: { label: string; value: string }[] } | null {
  const r = energyPerHead(world, cell);
  if (!r) return null;
  const top = CARRIERS.map((c) => [c, r.carriers[c]] as const).sort((a, b) => b[1] - a[1]);
  return {
    line: `Energy: ${kwWords(r.primary)} a head`,
    stats: [
      ...top
        .filter(([, kw]) => kw > 0.0005)
        .slice(0, 3)
        .map(([c, kw]) => ({ label: cap(CARRIER_WORDS[c].name), value: `${kwWords(kw)} a head` })),
      { label: "Its works run on", value: SOURCE_WORDS[r.drives] },
    ],
  };
}

/** What each carrier is, drawn: as food, fodder, heat or flow. */
const AS: Readonly<Record<Carrier, string>> = {
  muscle: "eaten",
  beasts: "eaten by its beasts that pull",
  wood: "burned",
  dung: "burned",
  flow: "turned by its wheels and turbines",
  wind: "turned by its sails and turbines",
  tide: "turned by its tide mills and turbines",
  ground: "drawn as heat",
  sun: "gathered as heat",
  buried: "burned",
  atom: "drawn as heat",
};

/** A land's Energy tab's blocks (none where it keeps no account). */
export function landEnergyBlocks(world: World, cell: number): Block[] {
  const e = energyBooks(world)?.get(cell),
    r = energyPerHead(world, cell);
  if (!e || !r) return [];
  const blocks: Block[] = [];
  // What it draws on, a head, the most first.
  const drawn = CARRIERS.map((c) => [c, r.carriers[c]] as const)
    .filter(([, kw]) => kw > 0.0005)
    .sort((a, b) => b[1] - a[1]);
  const rows: Stat[] = drawn.map(([c, kw]) =>
    stat(
      `${CARRIER_WORDS[c].icon} ${cap(CARRIER_WORDS[c].name)}`,
      `${kwWords(kw)} a head, ${AS[c]} (${pc(kw / Math.max(1e-9, r.primary))})`,
    ),
  );
  rows.push(stat("All told", `${kwWords(r.primary)} a head`));
  blocks.push({ type: "facts", title: "What it draws on", rows });

  // Its work: what drove it, what was wanted and had.
  const work: Stat[] = [
    stat("Its works run on", cap(SOURCE_WORDS[r.drives])),
    stat("Work turned", `${kwWords(r.work)} a head, muscle and all`),
  ];
  const by = SOURCES.map((s, i) => [s, e.by[i] ?? 0] as const).filter(
    ([s, kw]) => kw > 0 && s !== "none",
  );
  for (const [s, kw] of by.sort((a, b) => b[1] - a[1]))
    work.push(
      stat(`By ${SOURCE_WORDS[s as Source]}`, `${kwWords(kw / Math.max(1, e.people))} a head`),
    );
  if (e.workWanted > 0)
    work.push(
      stat(
        "Its works, carriers and homes had",
        `${pc(r.workCover)} of the work they wanted (${kwWords(e.workWanted / Math.max(1, e.people))} a head)`,
      ),
    );
  if (e.heatWanted > 0)
    work.push(
      stat(
        "Its hearths and smelters had",
        `${pc(r.heatCover)} of the heat they wanted (${kwWords(e.heatWanted / Math.max(1, e.people))} a head)`,
      ),
    );
  if (r.share > 0)
    work.push(
      stat(
        "Its engines turn",
        `${Math.round(r.share * 1000) / 10} in a hundred of the heat they burn into work`,
      ),
    );
  blocks.push({ type: "facts", title: "Its work", rows: work });

  // What it burned and felled, and what went up.
  const burned: Stat[] = [];
  if (e.coal) burned.push(stat("Coal", `${kwWords(e.coal / Math.max(1, e.people))} a head`));
  if (e.oil) burned.push(stat("Oil", `${kwWords(e.oil / Math.max(1, e.people))} a head`));
  if (e.gas)
    burned.push(stat("Gas drawn with its oil", `${kwWords(e.gas / Math.max(1, e.people))} a head`));
  if (e.own)
    burned.push(stat("Its world's own fuel", `${kwWords(e.own / Math.max(1, e.people))} a head`));
  if (e.felled)
    burned.push(
      stat(
        "Woods felled",
        `${kwWords(e.felled / Math.max(1, e.people))} a head past what its woods give`,
      ),
    );
  if (r.carbonKg > 0.5)
    burned.push(stat("Carbon sent up", `${Math.round(r.carbonKg)} kg a head a year`));
  if (r.sulphurKg > 0.5)
    burned.push(stat("Sulphur sent up", `${Math.round(r.sulphurKg)} kg a head a year`));
  const fume = fumeOf(world, cell);
  if (fume > 0.01)
    burned.push(stat("Its works' smoke", `${fume.toFixed(2)} kW of coal's smoke a head`));
  const without = Math.max(0, e.fuelWanted - e.coal - e.oil - e.gas);
  if (without > 0)
    burned.push(
      stat("Fuel it went without", `${kwWords(without / Math.max(1, e.people))} a head of heat`),
    );
  if (burned.length) blocks.push({ type: "facts", title: "What it burns", rows: burned });
  blocks.push({
    type: "text",
    lines: [
      [
        `Every number is last year's account. Its people eat a tenth of a kilowatt each and work with a fifth of it; heat engines turn no more of a heat into work than Carnot allows between the heat their stuffs bear (${Math.round(heldHeat(370))} °C for wrought iron's boilers, ${Math.round(heldHeat(800))} °C for steel's) and the cold they shed it to (${pc(carnot(heldHeat(800), 288))} for steel's on Earth), and a people's fits take them only part of that way (${pc(craftShare(0.1))} of it at a tenth of a millimetre, ${pc(craftShare(0.01))} at a hundredth).`,
      ],
    ],
  });
  return blocks;
}
