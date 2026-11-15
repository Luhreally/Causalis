// node tools/finance-ab.ts <year> <seed> <variant>: one world run with one channel of a realm's money and fears turned off, to find
// which of them moves what (turn the one input off: E1's lesson). Variants: "all" (as the rules stand); "notrade" (a fear shuts no
// trade; "halftrade": half as much); "nohost" (a fear grows no host and sells no debt to arm); "noregard" (a fear and holdings move no realm's regard);
// "nopress" (a fear moves no realm's arms, voice or word, and draws no people); "nodebt" (no debt is sold at all); "none" (all five).
// Each fifty years: people, realms, the half-century's famines, wars and trade, food in store, what debt service moved, and how much
// trade fear shut. Only the constants of rules/finance.ts are changed, in this process alone.
import { YEAR, codeOf, seedFromText } from "../src/kernel/index.ts";
import { EARTHLIKE, FINANCE, FOODS, OPEN, keptLife } from "../src/rules/index.ts";
import * as sim from "../src/sim/index.ts";
import { TURNS } from "./calibration-bands.ts";

const [yearArg, s = "earth:first light", variant = "all"] = process.argv.slice(2),
  F = FINANCE as unknown as Record<string, unknown>,
  off: Record<string, () => void> = {
    notrade: () => (F.shuts = 0),
    halftrade: () => (F.shuts = 0.5),
    nohost: () => {
      F.fields = 0;
      F.armAt = 2;
    },
    noregard: () => {
      F.regard = 0;
      F.shared = 0;
    },
    nopress: () => {
      F.tightens = { word: 0, force: 0, voice: 0 };
      F.guards = { word: 0, force: 0, voice: 0 };
      F.follows = 0;
    },
    nodebt: () => (F.shut = 0),
  };
for (const v of variant === "none"
  ? ["notrade", "nohost", "noregard", "nopress", "nodebt"]
  : variant === "all"
    ? []
    : variant.split("+"))
  off[v]!();
const earth = s.startsWith("earth:"),
  text = earth ? s.slice(6) : s.startsWith("kept:") ? keptLife(s.slice(5)) : s,
  world = sim.makePopulationWorld(seedFromText(text), {
    prior: earth ? EARTHLIKE : OPEN,
    start: "spread",
  }),
  ctx = sim.populationContext(world),
  turns = new Map<string, number>();
console.log(`== ${s}, ${variant}`);
let read = 0,
  famines = 0,
  wars = 0,
  paid = 0,
  trade = 0,
  shutSum = 0,
  shutN = 0;
for (let y = 1; y <= Number(yearArg); y++) {
  world.runTo(y * YEAR);
  const log = world.events;
  let top = read;
  for (let i = log.count - 1; i >= 0; i--) {
    const e = log.at(i),
      code = codeOf(e.id);
    if (code <= read) break;
    if (code > top) top = code;
    if (e.type === "people.famine") famines++;
    else if (e.type === "war.declared") wars++;
    for (const turn of TURNS)
      if (!turns.has(turn.id)) {
        if (turn.event && e.type === turn.event) turns.set(turn.id, y);
        else if (
          turn.principle &&
          (e.data as { principle?: string } | null)?.principle === turn.principle
        )
          turns.set(turn.id, y);
      }
  }
  read = top;
  const store = sim.financeOf(world);
  for (const m of store?.all() ?? []) paid += m.paid;
  const markets = sim.marketsOf(world),
    realms = sim.politiesOf(world);
  for (const f of markets.flows) {
    trade += f.count;
    const a = realms.of(f.from)?.ref,
      b = realms.of(f.to)?.ref;
    if (store && a && b && a !== b) {
      shutSum += sim.fearShuts(store, a, b);
      shutN++;
    }
  }
  if (y % 50 === 0) {
    let people = 0,
      food = 0,
      eats = 0;
    for (const p of ctx.provinces.all()) {
      const mk = markets.get(p.cell);
      people += p.total();
      if (mk) {
        food += mk.food(FOODS);
        eats += sim.mouths(p, ctx.life);
      }
    }
    console.log(
      `  ${y}: people ${people}, realms ${realms.living().length}, famines ${famines}, wars ${wars}, trade ${trade}, months of food ${(food / Math.max(1, eats)).toFixed(1)}, debt service moved ${paid}, fear on trade across borders ${(shutSum / Math.max(1, shutN)).toFixed(3)} of ${shutN}`,
    );
    famines = wars = paid = trade = shutSum = shutN = 0;
  }
}
console.log(
  `  turning points: ${TURNS.map((t) => `${t.id} ${turns.get(t.id) ?? "—"}`).join(", ")}`,
);
