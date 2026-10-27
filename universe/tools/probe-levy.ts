// node tools/probe-levy.ts [seed] [year] [towns] — one battle a man a turn (Phase 55 M225's levy):
// over the largest towns at the turn of the year, the people their day draws (each town's watched
// families and its line holders, as wave 5 counted them) away with the levy, and of them those away
// for two battles or more at once; the wounds of the turn's battles, and of them those of a man told
// coming home from another battle (the homecoming tells the last column in); then over every line
// of those towns, the lines a year's levies took more than once in the roster's window, the holders
// with two fates in one year, and the wounded of the turn with another fate in it — and that asking
// moved nothing.
import { DAY, YEAR, seedFromText } from "../src/kernel/index.ts";
import { populationContext } from "../src/sim/index.ts";
import { EARTH } from "../src/host/planet.ts";
import { LINE, townRoster } from "../src/host/roster.ts";
import { villagePlan } from "../src/host/village.ts";
import { withWounds } from "../src/host/wounds.ts";

const seed = process.argv[2] ?? "first light",
  year = Number(process.argv[3] ?? 365),
  most = Number(process.argv[4] ?? 60);
const share = (n: number, of: number) =>
  `${n} of ${of} (${of > 0 ? ((100 * n) / of).toFixed(1) : "0.0"}%)`;
const world = EARTH.build(seedFromText(seed)),
  began = performance.now();
world.runTo(year * YEAR);
console.log(
  `${seed} at year ${year} (${((performance.now() - began) / 1000).toFixed(1)} s to make); the ${most} largest towns`,
);
const before = JSON.stringify(world.domainHashes()),
  towns = populationContext(world)
    .settlements.all()
    .filter((s) => s.population > 0)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
    .slice(0, most);

// The people their day draws, with their wounds and days away laid over them: away with the levy at
// the turn, away for two battles or more; the wounds of the turn, and those told coming home from a
// battle other than theirs (by line holders, then by people met).
type Count = { people: number; away: number; twice: number; wounds: number; other: number };
const drawn: Record<"held" | "met", Count> = {
    held: { people: 0, away: 0, twice: 0, wounds: 0, other: 0 },
    met: { people: 0, away: 0, twice: 0, wounds: 0, other: 0 },
  },
  told: string[] = [];
for (const s of towns) {
  const plan = withWounds(world, villagePlan(world, s.ref, undefined, 480));
  for (const p of plan.people) {
    const c = drawn[p.folk ? "held" : "met"];
    c.people++;
    const away = (p.away ?? []).filter((a) => a.until > world.now - 40 * DAY);
    if (!away.length) continue;
    c.away++;
    if (away.length > 1) c.twice++;
    const last = away.reduce((a, b) => (b.until > a.until ? b : a));
    for (const w of p.wounds ?? []) {
      if (w.from !== "battle" || w.at < world.now - 40 * DAY) continue;
      c.wounds++;
      if (w.event === last.event) continue;
      c.other++;
      if (told.length < 3)
        told.push(`${p.name} (${p.ref}): wounded at ${w.where}, told home from ${last.where}`);
    }
  }
}
for (const [who, c] of Object.entries(drawn))
  console.log(
    `  drawn, ${who === "held" ? "line holders" : "people met"}: ${c.people}; away with the levy ${c.away}, for two battles or more ${share(c.twice, c.away)}; wounds of the turn ${c.wounds}, told home from another battle ${share(c.other, c.wounds)}`,
  );
const all = { away: drawn.held.away + drawn.met.away, twice: drawn.held.twice + drawn.met.twice },
  hurt = {
    wounds: drawn.held.wounds + drawn.met.wounds,
    other: drawn.held.other + drawn.met.other,
  };
console.log(
  `  drawn, all: away with the levy for two battles or more ${share(all.twice, all.away)}; wounds told home from another battle ${share(hurt.other, hurt.wounds)}`,
);
for (const t of told) console.log(`    e.g. ${t}`);

// Every line of those towns, as their rosters fold them: of the levies of each year of the window,
// the lines taken (a line once a battle), and those taken by two battles of one year; the holders
// now with two fates of one year; the wounded of the turn with another fate at it.
let calls = 0,
  lines = 0,
  twice = 0,
  turnCalls = 0,
  turnTwice = 0,
  holders = 0,
  twoFates = 0,
  wounded = 0,
  woundedOther = 0;
const seen: string[] = [];
for (const s of towns) {
  const roster = townRoster(world, s.ref),
    byYear = new Map<number, Map<number, string[]>>();
  for (const rb of roster.battles) {
    let takenIn = byYear.get(rb.year);
    if (!takenIn) byYear.set(rb.year, (takenIn = new Map()));
    for (const m of rb.men) {
      calls++;
      if (rb.year === year - 1) turnCalls++;
      const at = takenIn.get(m.line);
      if (at) at.push(`${m.fate} at ${rb.event}:${rb.side}`);
      else takenIn.set(m.line, [`${m.fate} at ${rb.event}:${rb.side}`]);
    }
  }
  for (const [y, taken] of byYear)
    for (const [line, fates] of taken) {
      lines++;
      if (fates.length < 2) continue;
      twice++;
      if (y === year - 1) turnTwice++;
      if (seen.length < 3) seen.push(`${s.name} line ${line}, year ${y}: ${fates.join(", ")}`);
    }
  for (let k = 0; k < Math.ceil(s.population / LINE); k++) {
    const h = roster.holder(k);
    if (!h) continue;
    holders++;
    const years = new Map<number, number>();
    for (const f of h.fates) years.set(f.year, (years.get(f.year) ?? 0) + 1);
    if ([...years.values()].some((n) => n > 1)) twoFates++;
    for (const f of h.fates)
      if (f.year === year - 1 && (f.fate === "hurt" || f.fate === "maimed")) {
        wounded++;
        if (h.fates.some((g) => g.year === f.year && g.event !== f.event)) woundedOther++;
      }
  }
}
console.log(
  `  lines: ${calls} taken by the window's levies (${turnCalls} at the turn); of the lines a year's levies took, taken twice or more in one year ${share(twice, lines)} (at the turn ${turnTwice})`,
);
console.log(
  `  holders now: ${holders}, with two fates of one year ${twoFates}; wounded at the turn ${wounded}, with another fate at it ${woundedOther}`,
);
for (const t of seen) console.log(`    e.g. ${t}`);
console.log(`  domain hashes unchanged: ${JSON.stringify(world.domainHashes()) === before}`);
